/**
 * Tenant Context Middleware for Global-Claw
 * Extracts tenant context from JWT or API key
 *
 * Sets c.var.tenant with TenantContext if authenticated
 */

import type { MiddlewareHandler } from "hono";
import type { TenantContext, TenantRole } from "../types";
import type { Env } from "../types/env";

/**
 * Tenant context middleware
 * Extracts authentication info and sets tenant context
 *
 * This middleware does NOT require authentication - it just extracts
 * context if present. Use requireAuth middleware for protected routes.
 */
export function tenantContextMiddleware(): MiddlewareHandler<{ Bindings: Env }> {
	return async (c, next) => {
		// Try to extract tenant context from Authorization header or X-API-Key
		const authHeader = c.req.header("Authorization");
		const apiKeyHeader = c.req.header("X-API-Key");

		let tenantContext: TenantContext | undefined;

		if (authHeader?.startsWith("Bearer ")) {
			// JWT token - will be validated by auth middleware
			const token = authHeader.slice(7);
			tenantContext = await extractFromJwt(token, c.env);
		} else if (apiKeyHeader) {
			// API key - will be validated by auth middleware
			tenantContext = await extractFromApiKey(apiKeyHeader, c.env);
		}

		// Set tenant context if found (even if not fully validated yet)
		if (tenantContext) {
			c.set("tenant", tenantContext);
		}

		await next();
	};
}

/**
 * Extract tenant context from JWT token (without full validation)
 * Full validation happens in auth middleware
 */
async function extractFromJwt(token: string, _env: Env): Promise<TenantContext | undefined> {
	try {
		// Parse JWT payload (base64url decode middle part)
		const parts = token.split(".");
		if (parts.length !== 3) return undefined;

		const payloadPart = parts[1];
		if (!payloadPart) return undefined;

		const payload = JSON.parse(atob(payloadPart.replace(/-/g, "+").replace(/_/g, "/")));

		// Check required fields
		if (!payload.sub || !payload.tid) return undefined;

		return {
			user_id: payload.sub,
			tenant_id: payload.tid,
			role: payload.role as TenantRole,
			plan: payload.plan,
		};
	} catch {
		return undefined;
	}
}

/**
 * Extract tenant context from API key (without full validation)
 * Full validation happens in auth middleware
 */
async function extractFromApiKey(apiKey: string, _env: Env): Promise<TenantContext | undefined> {
	// API key format: gc_[live|test]_[32char]
	// We can't extract tenant info from the key itself
	// The auth middleware will look up the key and set full context
	if (!apiKey.startsWith("gc_")) return undefined;

	// Return partial context - auth middleware will fill in the rest
	return {
		user_id: "",
		tenant_id: "",
		role: "member" as TenantRole,
		api_key_id: `${apiKey.slice(0, 16)}...`, // Partial key for logging
	};
}

// Extend Hono context to include tenant
declare module "hono" {
	interface ContextVariableMap {
		tenant?: TenantContext;
	}
}
