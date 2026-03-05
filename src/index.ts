/**
 * Global-Claw Worker Entry Point
 * Main Hono router handling all API routes
 */

import { Hono } from "hono";
import type { ApiResponse, HealthCheckResult } from "./types";
import type { Env } from "./types/env";

// Import API routes
import { providers } from "./api/providers";
import { routingRules } from "./api/routing-rules";

// Create Hono app with typed environment
const app = new Hono<{ Bindings: Env }>();

// ============================================================================
// Mount API Routes
// ============================================================================

app.route("/api/providers", providers);
app.route("/api/routing-rules", routingRules);

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
				"Content-Type": "application/json",
			},
		}),
	);
	const result = await response.json();
	return c.json(result, response.status as 200 | 400 | 401 | 403 | 404 | 500);
});

// ============================================================================
// Telegram Webhook Route
// POST /tg/webhook/:agentId - Receives Telegram updates for specific agent
// ============================================================================

app.post("/tg/webhook/:agentId", async (c) => {
	const agentId = c.req.param("agentId");
	if (!agentId) {
		return c.json({ success: false, error: { code: "VALIDATION_ERROR", message: "Missing agentId" } }, 400);
	}

	// Verify Telegram webhook secret
	const telegramSecret = c.req.header("X-Telegram-Bot-Api-Secret-Token");
	if (telegramSecret !== c.env.TELEGRAM_WEBHOOK_SECRET) {
		return c.json({ success: false, error: { code: "UNAUTHORIZED", message: "Invalid webhook secret" } }, 401);
	}

	// Look up which tenant owns this agent
	const agent = await c.env.DB.prepare("SELECT tenant_id FROM agents WHERE id = ?")
		.bind(agentId)
		.first<{ tenant_id: string }>();
	if (!agent) {
		return c.json({ success: false, error: { code: "NOT_FOUND", message: "Agent not found" } }, 404);
	}

	// Forward to the tenant's DO
	const stub = getTenantAgentStub(c.env, agent.tenant_id);
	const body = await c.req.json();

	const doResponse = await stub.fetch(
		new Request("https://do/telegram/webhook", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"X-Agent-ID": agentId,
			},
			body: JSON.stringify(body),
		}),
	);

	return new Response(doResponse.body, {
		status: doResponse.status,
		headers: doResponse.headers,
	});
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
	return c.json(
		{
			success: false,
			error: {
				code: "NOT_FOUND",
				message: `Route ${c.req.method} ${c.req.path} not found`,
			},
		},
		404,
	);
});

// ============================================================================
// Global Error Handler
// ============================================================================

app.onError((err, c) => {
	console.error("Unhandled error:", err);

	return c.json(
		{
			success: false,
			error: {
				code: "INTERNAL_ERROR",
				message: c.env.ENVIRONMENT === "production" ? "An unexpected error occurred" : err.message,
			},
		},
		500,
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
