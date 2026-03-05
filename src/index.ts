/**
 * Global-Claw Worker Entry Point
 * Main Hono router handling all API routes
 */

import { Hono } from "hono";
import type { ApiResponse, HealthCheckResult } from "./types";
import type { Env } from "./types/env";

// Import middleware
import {
	corsMiddleware,
	errorHandler,
	loggerMiddleware,
	rateLimitMiddleware,
	tenantContextMiddleware,
} from "./middleware";

// Import API routes
import { analytics, llmCost, overview } from "./api/dashboard";
import { integrations } from "./api/integrations";
import { memory } from "./api/memory";
import { partners } from "./api/partners";
import { providers } from "./api/providers";
import { routingRules } from "./api/routing-rules";
import { signup } from "./api/signup";
import { stripe } from "./api/stripe";
import { telegramApi } from "./api/telegram";
import { ws } from "./api/ws";
import { telegramWebhook } from "./telegram";

// Create Hono app with typed environment
const app = new Hono<{ Bindings: Env }>();

// ============================================================================
// Middleware Stack (applied in order per CLAUDE.md)
// ============================================================================

// 1. CORS - origin-reflection per environment
app.use("*", corsMiddleware());

// 2. Logger - structured JSON logging with trace ID
app.use("*", loggerMiddleware());

// 3. Rate limiting - KV-backed per-IP limiting
app.use("*", rateLimitMiddleware());

// 4. Tenant context - extract tenant from JWT/API key (doesn't require auth)
app.use("*", tenantContextMiddleware());

// 5. Error handler - catch all errors, return standard response
app.onError(errorHandler);

// ============================================================================
// Mount API Routes
// ============================================================================

app.route("/api/providers", providers);
app.route("/api/routing-rules", routingRules);
app.route("/api/signup", signup);
app.route("/api/stripe", stripe);
app.route("/api/partners", partners);
app.route("/api/dashboard", overview);
app.route("/api/dashboard", analytics);
app.route("/api/dashboard", llmCost);
app.route("/api", memory);
app.route("/api", integrations);
app.route("/api", telegramApi);
app.route("/api", ws);
app.route("/oauth", integrations);
app.route("/tg/webhook", telegramWebhook);

// ============================================================================
// Tenant Durable Object Control-Plane Routes
// Forward requests to the per-tenant TenantAgent DO
// ============================================================================

/**
 * Get or create a TenantAgent DO stub by tenant ID
 * Uses tenant ID as the DO name for consistent routing
 */
function getTenantAgentStub(env: Env, tenantId: string): DurableObjectStub {
	const doId = env.TENANT_AGENT.idFromName(tenantId);
	return env.TENANT_AGENT.get(doId);
}

// Forward all tenant-scoped routes to the TenantAgent DO
app.all("/api/tenants/:tenantId/*", async (c) => {
	const tenantId = c.req.param("tenantId");
	if (!tenantId) {
		return c.json({ success: false, error: { code: "VALIDATION_ERROR", message: "Missing tenantId" } }, 400);
	}

	// Verify tenant exists in D1 before forwarding
	const tenant = await c.env.DB.prepare("SELECT id, status FROM tenants WHERE id = ?").bind(tenantId).first();
	if (!tenant) {
		return c.json({ success: false, error: { code: "NOT_FOUND", message: "Tenant not found" } }, 404);
	}
	if (tenant.status === "suspended" || tenant.status === "deleted") {
		return c.json({ success: false, error: { code: "TENANT_INACTIVE", message: `Tenant is ${tenant.status}` } }, 403);
	}

	// Build the path to forward to the DO (strip /api/tenants/:tenantId prefix)
	const fullPath = c.req.path;
	const prefixToRemove = `/api/tenants/${tenantId}`;
	const doPath = fullPath.slice(prefixToRemove.length) || "/";

	// Create URL for DO request
	const doUrl = new URL(c.req.url);
	doUrl.pathname = doPath;

	// Forward headers, preserving auth and trace info
	const headers = new Headers(c.req.raw.headers);
	headers.set("X-Tenant-ID", tenantId);

	// Get DO stub and forward request
	const stub = getTenantAgentStub(c.env, tenantId);

	try {
		const doRequest = new Request(doUrl.toString(), {
			method: c.req.method,
			headers,
			body: c.req.method !== "GET" && c.req.method !== "HEAD" ? c.req.raw.body : undefined,
		});

		const doResponse = await stub.fetch(doRequest);

		// Return DO response with proper headers
		return new Response(doResponse.body, {
			status: doResponse.status,
			headers: doResponse.headers,
		});
	} catch (error) {
		console.error("DO request failed:", error);
		return c.json({ success: false, error: { code: "DO_ERROR", message: "Failed to reach tenant agent" } }, 503);
	}
});

// Direct tenant binding endpoint (used by provisioning workflow)
app.post("/api/do/bind/:tenantId", async (c) => {
	// This endpoint is internal-only (provisioning/control plane)
	const internalAuth = c.req.header("X-DO-Auth");
	if (internalAuth !== c.env.JWT_SECRET) {
		return c.json({ success: false, error: { code: "UNAUTHORIZED", message: "Invalid internal auth" } }, 401);
	}

	const tenantId = c.req.param("tenantId");
	if (!tenantId) {
		return c.json({ success: false, error: { code: "VALIDATION_ERROR", message: "Missing tenantId" } }, 400);
	}

	// Get DO stub and call bind endpoint with tenant ID in header
	const stub = getTenantAgentStub(c.env, tenantId);
	const response = await stub.fetch(
		new Request("https://do/bind", {
			method: "POST",
			headers: {
				"X-Tenant-ID": tenantId,
				"X-DO-Auth": c.env.JWT_SECRET,
				"Content-Type": "application/json",
			},
		}),
	);
	const result = await response.json();
	return c.json(result, response.status as 200 | 400 | 401 | 403 | 404 | 500);
});

// ============================================================================
// Health Check Endpoint (Public)
// ============================================================================

app.get("/api/health", async (c) => {
	// Check D1 database
	let dbStatus: "ok" | "error" = "error";
	let dbLatency = 0;
	try {
		const dbStart = Date.now();
		await c.env.DB.prepare("SELECT 1").first();
		dbLatency = Date.now() - dbStart;
		dbStatus = "ok";
	} catch {
		dbStatus = "error";
	}

	// Determine overall status
	const status: "healthy" | "degraded" | "unhealthy" = dbStatus === "ok" ? "healthy" : "unhealthy";

	const result: HealthCheckResult = {
		status,
		database: { status: dbStatus, latency_ms: dbLatency },
		durable_objects: { status: "ok" }, // DO health checked on demand
		llm_providers: [], // LLM providers checked separately
		queues: { status: "ok" }, // Queues assumed ok if Worker is running
		r2: { status: "ok" }, // R2 checked on demand
		checked_at: new Date().toISOString(),
	};

	const response: ApiResponse<HealthCheckResult> = {
		success: true,
		data: result,
	};

	return c.json(response, status === "healthy" ? 200 : 503);
});

// ============================================================================
// Root Endpoint
// ============================================================================

app.get("/", (c) => {
	return c.json({
		success: true,
		data: {
			name: "Global-Claw API",
			version: "1.0.0",
			environment: c.env.ENVIRONMENT,
			docs: `${c.env.APP_URL}/api/docs`,
		},
	});
});

// ============================================================================
// 404 Handler
// ============================================================================

app.notFound((c) => {
	const traceId = c.get("traceId") ?? "unknown";
	return c.json(
		{
			success: false,
			error: {
				code: "NOT_FOUND",
				message: `Route ${c.req.method} ${c.req.path} not found`,
			},
			trace_id: traceId,
		},
		404,
	);
});

// ============================================================================
// Queue Consumer Handler
// ============================================================================

async function handleQueue(batch: MessageBatch, _env: Env): Promise<void> {
	for (const message of batch.messages) {
		try {
			const body = message.body as Record<string, unknown>;
			console.info(`Processing queue message: ${batch.queue}`, body);

			// TODO: Implement queue handlers for audit and notifications
			// For now, just acknowledge the message
			message.ack();
		} catch (error) {
			console.error("Failed to process queue message:", error);
			message.retry();
		}
	}
}

// ============================================================================
// Module Exports
// ============================================================================

export default {
	fetch: app.fetch,
	async queue(batch: MessageBatch, env: Env): Promise<void> {
		await handleQueue(batch, env);
	},
};

// Export Durable Object classes
export { TenantAgent } from "./agents/tenant-agent";

// Export Workflow classes
export { TenantProvisioningWorkflow } from "./workflows/provisioning";
