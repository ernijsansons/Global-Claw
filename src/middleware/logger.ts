/**
 * Logger Middleware for Global-Claw
 * Structured JSON logging with trace ID propagation
 *
 * IMPORTANT: Scrubs ?token= from access logs to prevent credential leakage
 */

import type { MiddlewareHandler } from "hono";
import type { Env } from "../types/env";

/**
 * Log entry structure
 */
interface LogEntry {
	timestamp: string;
	level: "info" | "warn" | "error";
	trace_id: string;
	method: string;
	path: string;
	status: number;
	duration_ms: number;
	ip?: string;
	user_agent?: string;
	tenant_id?: string;
	user_id?: string;
	error?: string;
}

/**
 * Scrub sensitive data from URL path
 * Removes token query parameters
 */
function scrubPath(path: string): string {
	// Remove ?token=xxx and &token=xxx patterns
	return path
		.replace(/[?&]token=[^&]*/g, (match, offset, str) => {
			// If this is the only/first param, check if there are more
			if (match.startsWith("?")) {
				const hasMore = str.indexOf("&", offset + match.length) !== -1;
				return hasMore ? "?" : "";
			}
			return "";
		})
		.replace(/\?&/, "?") // Clean up ?& if token was first param
		.replace(/\?$/, ""); // Remove trailing ?
}

/**
 * Generate a trace ID if not provided
 */
function generateTraceId(): string {
	return `gc-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
}

/**
 * Get client IP from headers (respecting Cloudflare headers)
 */
function getClientIp(c: { req: { header: (name: string) => string | undefined } }): string | undefined {
	return c.req.header("cf-connecting-ip") ?? c.req.header("x-forwarded-for")?.split(",")[0]?.trim();
}

/**
 * Logger middleware
 * Logs all requests with timing, scrubbed paths, and trace IDs
 */
export function loggerMiddleware(): MiddlewareHandler<{ Bindings: Env }> {
	return async (c, next) => {
		const startTime = Date.now();

		// Get or generate trace ID
		const traceId = c.req.header("x-trace-id") ?? generateTraceId();

		// Store trace ID in context for downstream use
		c.set("traceId", traceId);

		// Add trace ID to response headers
		c.header("X-Trace-ID", traceId);

		try {
			await next();

			const duration = Date.now() - startTime;
			const path = scrubPath(c.req.path + (c.req.url.includes("?") ? `?${c.req.url.split("?")[1]}` : ""));

			const logEntry: LogEntry = {
				timestamp: new Date().toISOString(),
				level: c.res.status >= 400 ? "warn" : "info",
				trace_id: traceId,
				method: c.req.method,
				path,
				status: c.res.status,
				duration_ms: duration,
				ip: getClientIp(c),
				user_agent: c.req.header("user-agent"),
			};

			// Add tenant/user context if available
			const tenantContext = c.get("tenant");
			if (tenantContext) {
				logEntry.tenant_id = tenantContext.tenant_id;
				logEntry.user_id = tenantContext.user_id;
			}

			// Log based on status
			if (c.res.status >= 500) {
				console.error(JSON.stringify(logEntry));
			} else if (c.res.status >= 400) {
				console.warn(JSON.stringify(logEntry));
			} else {
				console.info(JSON.stringify(logEntry));
			}
		} catch (error) {
			const duration = Date.now() - startTime;
			const path = scrubPath(c.req.path);

			const logEntry: LogEntry = {
				timestamp: new Date().toISOString(),
				level: "error",
				trace_id: traceId,
				method: c.req.method,
				path,
				status: 500,
				duration_ms: duration,
				ip: getClientIp(c),
				user_agent: c.req.header("user-agent"),
				error: error instanceof Error ? error.message : String(error),
			};

			console.error(JSON.stringify(logEntry));

			throw error;
		}
	};
}

// Extend Hono context to include our custom variables
declare module "hono" {
	interface ContextVariableMap {
		traceId: string;
	}
}
