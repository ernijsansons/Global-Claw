/**
 * CORS Middleware for Global-Claw
 * Origin-reflection CORS per environment
 *
 * - Development: localhost origins
 * - Staging: allowlist *.workers.dev origins
 * - Production: global-claw.com
 */

import type { MiddlewareHandler } from "hono";
import { cors } from "hono/cors";
import type { Env } from "../types/env";

/**
 * Allowed origins per environment
 */
const ALLOWED_ORIGINS: Record<string, readonly string[]> = {
	development: ["http://localhost:3000", "http://localhost:5173", "http://localhost:8787", "http://127.0.0.1:3000"],
	staging: ["https://global-claw-dashboard.pages.dev", "https://global-claw-staging.workers.dev"],
	production: ["https://app.global-claw.com", "https://global-claw.com", "https://www.global-claw.com"],
};

/**
 * Check if origin is allowed for the given environment
 */
function isOriginAllowed(origin: string | undefined, env: string): boolean {
	if (!origin) return false;

	const allowedList = ALLOWED_ORIGINS[env] ?? ALLOWED_ORIGINS.production ?? [];

	// Exact match
	if (allowedList.includes(origin)) {
		return true;
	}

	// For staging, also allow any *.workers.dev origin
	if (env === "staging" && origin.endsWith(".workers.dev")) {
		return true;
	}

	// For staging, also allow any *.pages.dev origin
	if (env === "staging" && origin.endsWith(".pages.dev")) {
		return true;
	}

	return false;
}

/**
 * CORS middleware factory
 * Returns Hono CORS middleware configured for the current environment
 */
export function corsMiddleware(): MiddlewareHandler<{ Bindings: Env }> {
	return cors({
		origin: (origin, c) => {
			const env = c.env.ENVIRONMENT ?? "production";
			return isOriginAllowed(origin, env) ? origin : "";
		},
		allowHeaders: ["Content-Type", "Authorization", "X-API-Key", "X-Trace-ID"],
		allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
		exposeHeaders: ["X-Trace-ID", "X-RateLimit-Limit", "X-RateLimit-Remaining", "X-RateLimit-Reset"],
		maxAge: 86400, // 24 hours
		credentials: true,
	});
}
