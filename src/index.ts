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
