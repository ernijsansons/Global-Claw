/**
 * Error classes for Global-Claw
 * Structured error handling with consistent API responses
 */

/**
 * Base application error class
 * All custom errors extend this class
 */
export class AppError extends Error {
	public readonly code: string;
	public readonly statusCode: number;
	public readonly details?: Record<string, unknown>;

	constructor(message: string, code: string, statusCode: number, details?: Record<string, unknown>) {
		super(message);
		this.name = "AppError";
		this.code = code;
		this.statusCode = statusCode;
		this.details = details;

		// Maintains proper stack trace for where error was thrown (V8 only)
		const ErrorWithCapture = Error as typeof Error & {
			captureStackTrace?: (target: object, constructorOpt: new (...args: unknown[]) => unknown) => void;
		};
		if (ErrorWithCapture.captureStackTrace) {
			ErrorWithCapture.captureStackTrace(this, this.constructor as new (...args: unknown[]) => unknown);
		}
	}

	/**
	 * Convert to API error response format
	 */
	toJSON(): { code: string; message: string; details?: Record<string, unknown> } {
		return {
			code: this.code,
			message: this.message,
			...(this.details && { details: this.details }),
		};
	}
}

/**
 * Authentication error (401)
 */
export class AuthError extends AppError {
	constructor(message = "Authentication required", details?: Record<string, unknown>) {
		super(message, "UNAUTHORIZED", 401, details);
		this.name = "AuthError";
	}
}

/**
 * Invalid credentials error (401)
 */
export class InvalidCredentialsError extends AppError {
	constructor(message = "Invalid credentials", details?: Record<string, unknown>) {
		super(message, "INVALID_CREDENTIALS", 401, details);
		this.name = "InvalidCredentialsError";
	}
}

/**
 * Token expired error (401)
 */
export class TokenExpiredError extends AppError {
	constructor(message = "Token has expired", details?: Record<string, unknown>) {
		super(message, "TOKEN_EXPIRED", 401, details);
		this.name = "TokenExpiredError";
	}
}

/**
 * Authorization error (403)
 */
export class ForbiddenError extends AppError {
	constructor(message = "Access forbidden", details?: Record<string, unknown>) {
		super(message, "FORBIDDEN", 403, details);
		this.name = "ForbiddenError";
	}
}

/**
 * Insufficient permissions error (403)
 */
export class InsufficientPermissionsError extends AppError {
	constructor(message = "Insufficient permissions", details?: Record<string, unknown>) {
		super(message, "INSUFFICIENT_PERMISSIONS", 403, details);
		this.name = "InsufficientPermissionsError";
	}
}

/**
 * Resource not found error (404)
 */
export class NotFoundError extends AppError {
	constructor(resource = "Resource", id?: string, details?: Record<string, unknown>) {
		const message = id ? `${resource} with ID '${id}' not found` : `${resource} not found`;
		super(message, "NOT_FOUND", 404, details);
		this.name = "NotFoundError";
	}
}

/**
 * Validation error (400)
 */
export class ValidationError extends AppError {
	constructor(message = "Validation failed", details?: Record<string, unknown>) {
		super(message, "VALIDATION_ERROR", 400, details);
		this.name = "ValidationError";
	}
}

/**
 * Invalid input error (400)
 */
export class BadRequestError extends AppError {
	constructor(message = "Bad request", details?: Record<string, unknown>) {
		super(message, "BAD_REQUEST", 400, details);
		this.name = "BadRequestError";
	}
}

/**
 * Conflict error (409) - e.g., duplicate resource
 */
export class ConflictError extends AppError {
	constructor(message = "Resource conflict", details?: Record<string, unknown>) {
		super(message, "CONFLICT", 409, details);
		this.name = "ConflictError";
	}
}

/**
 * Rate limit exceeded error (429)
 */
export class RateLimitError extends AppError {
	public readonly retryAfter?: number;

	constructor(message = "Rate limit exceeded", retryAfter?: number, details?: Record<string, unknown>) {
		super(message, "RATE_LIMIT_EXCEEDED", 429, details);
		this.name = "RateLimitError";
		this.retryAfter = retryAfter;
	}
}

/**
 * Budget exceeded error (402)
 */
export class BudgetExceededError extends AppError {
	constructor(message = "Budget limit exceeded", details?: Record<string, unknown>) {
		super(message, "BUDGET_EXCEEDED", 402, details);
		this.name = "BudgetExceededError";
	}
}

/**
 * Service unavailable error (503)
 */
export class ServiceUnavailableError extends AppError {
	constructor(message = "Service temporarily unavailable", details?: Record<string, unknown>) {
		super(message, "SERVICE_UNAVAILABLE", 503, details);
		this.name = "ServiceUnavailableError";
	}
}

/**
 * LLM provider error (502)
 */
export class LLMProviderError extends AppError {
	constructor(provider: string, message = "LLM provider error", details?: Record<string, unknown>) {
		super(`${provider}: ${message}`, "LLM_PROVIDER_ERROR", 502, { provider, ...details });
		this.name = "LLMProviderError";
	}
}

/**
 * Internal server error (500)
 */
export class InternalError extends AppError {
	constructor(message = "Internal server error", details?: Record<string, unknown>) {
		super(message, "INTERNAL_ERROR", 500, details);
		this.name = "InternalError";
	}
}

/**
 * Type guard to check if an error is an AppError
 */
export function isAppError(error: unknown): error is AppError {
	return error instanceof AppError;
}

/**
 * Convert any error to an AppError
 */
export function toAppError(error: unknown): AppError {
	if (isAppError(error)) {
		return error;
	}

	if (error instanceof Error) {
		return new InternalError(error.message);
	}

	return new InternalError(String(error));
}
