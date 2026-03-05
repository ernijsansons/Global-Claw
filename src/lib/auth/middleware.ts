/**
 * Auth Middleware for Global-Claw
 * Resolves authentication from JWT or API key
 */

import type { MiddlewareHandler } from "hono";
import type { TenantContext, TenantRole } from "../../types";
import type { Env } from "../../types/env";
import { AuthError, ForbiddenError, InsufficientPermissionsError } from "../errors";
import { hasScope, verifyApiKey } from "./api-key";
import { verifyJWT } from "./jwt";

/**
 * Require authentication middleware
 * Validates JWT or API key and sets full tenant context
 *
 * @throws AuthError if no valid authentication
 */
export function requireAuth(): MiddlewareHandler<{ Bindings: Env }> {
	return async (c, next) => {
		const authHeader = c.req.header("Authorization");
		const apiKeyHeader = c.req.header("X-API-Key");

		let tenantContext: TenantContext | undefined;

		if (authHeader?.startsWith("Bearer ")) {
			// JWT authentication
			const token = authHeader.slice(7);
			const payload = await verifyJWT(token, c.env.JWT_SECRET);

			// Check token type
			if (payload.type !== "access") {
				throw new AuthError("Invalid token type. Use access token.");
			}

			// Look up full user and tenant info from database
			const userInfo = await c.env.DB.prepare(
				`
				SELECT
					u.id as user_id,
					u.email,
					tu.role,
					t.id as tenant_id,
					t.plan,
					t.status as tenant_status
				FROM users u
				JOIN tenant_users tu ON tu.user_id = u.id
				JOIN tenants t ON t.id = tu.tenant_id
				WHERE u.id = ? AND t.id = ?
			`,
			)
				.bind(payload.sub, payload.tid)
				.first<{
					user_id: string;
					email: string;
					role: TenantRole;
					tenant_id: string;
					plan: string;
					tenant_status: string;
				}>();

			if (!userInfo) {
				throw new AuthError("User or tenant not found");
			}

			if (userInfo.tenant_status !== "active") {
				throw new ForbiddenError("Tenant is not active");
			}

			tenantContext = {
				user_id: userInfo.user_id,
				tenant_id: userInfo.tenant_id,
				role: userInfo.role,
				plan: userInfo.plan,
				email: userInfo.email,
			};
		} else if (apiKeyHeader) {
			// API key authentication
			tenantContext = await verifyApiKey(apiKeyHeader, c.env.DB);
		} else {
			throw new AuthError("Authentication required");
		}

		// Set context
		c.set("tenant", tenantContext);

		await next();
	};
}

/**
 * Require specific role middleware
 * Must be used after requireAuth()
 *
 * @param allowedRoles - Roles that are allowed
 */
export function requireRole(...allowedRoles: TenantRole[]): MiddlewareHandler<{ Bindings: Env }> {
	return async (c, next) => {
		const tenant = c.get("tenant");

		if (!tenant) {
			throw new AuthError("Authentication required");
		}

		if (!allowedRoles.includes(tenant.role)) {
			throw new InsufficientPermissionsError(`Required role: ${allowedRoles.join(" or ")}`);
		}

		await next();
	};
}

/**
 * Require specific scope middleware
 * Must be used after requireAuth()
 * Only applies to API key authentication
 *
 * @param requiredScope - Scope that is required
 */
export function requireScope(requiredScope: string): MiddlewareHandler<{ Bindings: Env }> {
	return async (c, next) => {
		const tenant = c.get("tenant");

		if (!tenant) {
			throw new AuthError("Authentication required");
		}

		// If not API key auth, scopes don't apply (full access)
		if (tenant.role === "api_key" && !hasScope(tenant, requiredScope)) {
			throw new InsufficientPermissionsError(`Required scope: ${requiredScope}`);
		}

		await next();
	};
}

/**
 * Optional authentication middleware
 * Validates auth if present but doesn't require it
 * Useful for endpoints that behave differently when authenticated
 */
export function optionalAuth(): MiddlewareHandler<{ Bindings: Env }> {
	return async (c, next) => {
		const authHeader = c.req.header("Authorization");
		const apiKeyHeader = c.req.header("X-API-Key");

		try {
			if (authHeader?.startsWith("Bearer ")) {
				const token = authHeader.slice(7);
				const payload = await verifyJWT(token, c.env.JWT_SECRET);

				if (payload.type === "access") {
					c.set("tenant", {
						user_id: payload.sub,
						tenant_id: payload.tid,
						role: payload.role as TenantRole,
						plan: payload.plan,
					});
				}
			} else if (apiKeyHeader) {
				const context = await verifyApiKey(apiKeyHeader, c.env.DB);
				c.set("tenant", context);
			}
		} catch {
			// Silently ignore auth errors for optional auth
		}

		await next();
	};
}

/**
 * Require tenant match middleware
 * Ensures the authenticated user has access to the requested tenant
 *
 * @param tenantIdParam - Name of the route parameter containing tenant ID
 */
export function requireTenantAccess(tenantIdParam = "id"): MiddlewareHandler<{ Bindings: Env }> {
	return async (c, next) => {
		const tenant = c.get("tenant");

		if (!tenant) {
			throw new AuthError("Authentication required");
		}

		const requestedTenantId = c.req.param(tenantIdParam);

		if (requestedTenantId && requestedTenantId !== tenant.tenant_id) {
			// Check if user is a super admin (can access any tenant)
			// For now, just deny - super admin logic can be added later
			throw new ForbiddenError("Access to this tenant is not allowed");
		}

		await next();
	};
}
