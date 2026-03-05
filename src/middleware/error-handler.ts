/**
 * Error Handler Middleware for Global-Claw
 * Standardized error responses
 *
 * All errors are converted to the standard API response format:
 * { success: false, error: { code: string, message: string, details?: object } }
 */

import type { ErrorHandler } from "hono";
import { AppError, RateLimitError, isAppError } from "../lib/errors";
import type { Env } from "../types/env";

/**
 * Global error handler
 * Catches all errors and returns standardized responses
 */
export const errorHandler: ErrorHandler<{ Bindings: Env }> = (err, c) => {
	// Get trace ID for correlation
	const traceId = c.get("traceId") ?? c.req.header("x-trace-id") ?? "unknown";

	// Determine if we should expose error details
	const isProduction = c.env.ENVIRONMENT === "production";

	// Convert to AppError if needed
	let appError: AppError;
	if (isAppError(err)) {
		appError = err;
	} else if (err instanceof Error) {
		// Unknown error - log it and return generic message in production
		console.error(
			JSON.stringify({
				timestamp: new Date().toISOString(),
				level: "error",
				trace_id: traceId,
				error: err.name,
				message: err.message,
				stack: err.stack,
			}),
		);

		appError = new AppError(isProduction ? "An unexpected error occurred" : err.message, "INTERNAL_ERROR", 500);
	} else {
		// Non-Error thrown
		console.error(
			JSON.stringify({
				timestamp: new Date().toISOString(),
				level: "error",
				trace_id: traceId,
				error: "UnknownError",
				message: String(err),
			}),
		);

		appError = new AppError("An unexpected error occurred", "INTERNAL_ERROR", 500);
	}

	// Set additional headers for rate limit errors
	if (appError instanceof RateLimitError && appError.retryAfter) {
		c.header("Retry-After", String(appError.retryAfter));
	}

	// Build response
	const response = {
		success: false as const,
		error: {
			code: appError.code,
			message: appError.message,
			...(appError.details && !isProduction && { details: appError.details }),
		},
		trace_id: traceId,
	};

	return c.json(response, appError.statusCode as 400 | 401 | 402 | 403 | 404 | 409 | 429 | 500 | 502 | 503);
};

/**
 * Not found handler
 * Returns 404 for unmatched routes
 */
export function notFoundHandler(c: {
	req: { method: string; path: string };
	json: (body: unknown, status: number) => Response;
	get: (key: string) => unknown;
}) {
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
}
