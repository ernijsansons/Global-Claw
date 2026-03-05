/**
 * Rate Limiting Middleware for Global-Claw
 * KV-backed per-IP rate limiting
 *
 * Limits:
 * - Unauthenticated: 60 req/min
 * - Authenticated: 300 req/min
 */

import type { MiddlewareHandler } from "hono";
import { RateLimitError } from "../lib/errors";
import type { Env } from "../types/env";

/**
 * Rate limit configuration
 */
interface RateLimitConfig {
	/** Requests allowed per window */
	limit: number;
	/** Window size in seconds */
	window: number;
}

const UNAUTHENTICATED_LIMIT: RateLimitConfig = { limit: 60, window: 60 };
const AUTHENTICATED_LIMIT: RateLimitConfig = { limit: 300, window: 60 };

/**
 * Rate limit data stored in KV
 */
interface RateLimitData {
	count: number;
	resetAt: number;
}

/**
 * Get rate limit key for KV storage
 */
function getRateLimitKey(ip: string, isAuthenticated: boolean): string {
	const prefix = isAuthenticated ? "rl:auth:" : "rl:unauth:";
	return `${prefix}${ip}`;
}

/**
 * Get client IP from request
 */
function getClientIp(c: { req: { header: (name: string) => string | undefined } }): string {
	return c.req.header("cf-connecting-ip") ?? c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

/**
 * Rate limiting middleware factory
 */
export function rateLimitMiddleware(): MiddlewareHandler<{ Bindings: Env }> {
	return async (c, next) => {
		const kv = c.env.RATE_LIMIT_KV;
		const ip = getClientIp(c);

		// Check if authenticated (tenant context will be set by auth middleware)
		const isAuthenticated = c.get("tenant") !== undefined;
		const config = isAuthenticated ? AUTHENTICATED_LIMIT : UNAUTHENTICATED_LIMIT;

		const key = getRateLimitKey(ip, isAuthenticated);
		const now = Date.now();

		// Get current rate limit data
		let data: RateLimitData;
		const stored = await kv.get<RateLimitData>(key, "json");

		if (stored && stored.resetAt > now) {
			// Within current window
			data = stored;
		} else {
			// New window
			data = {
				count: 0,
				resetAt: now + config.window * 1000,
			};
		}

		// Check if limit exceeded
		if (data.count >= config.limit) {
			const retryAfter = Math.ceil((data.resetAt - now) / 1000);

			// Set rate limit headers
			c.header("X-RateLimit-Limit", String(config.limit));
			c.header("X-RateLimit-Remaining", "0");
			c.header("X-RateLimit-Reset", String(Math.ceil(data.resetAt / 1000)));
			c.header("Retry-After", String(retryAfter));

			throw new RateLimitError(`Rate limit exceeded. Try again in ${retryAfter} seconds.`, retryAfter);
		}

		// Increment count
		data.count++;

		// Store updated data with TTL matching the window
		const ttl = Math.ceil((data.resetAt - now) / 1000);
		await kv.put(key, JSON.stringify(data), { expirationTtl: Math.max(ttl, 1) });

		// Set rate limit headers
		c.header("X-RateLimit-Limit", String(config.limit));
		c.header("X-RateLimit-Remaining", String(Math.max(0, config.limit - data.count)));
		c.header("X-RateLimit-Reset", String(Math.ceil(data.resetAt / 1000)));

		await next();
	};
}
