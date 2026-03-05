/**
 * Auth exports for Global-Claw
 * Re-exports all auth utilities for convenient importing
 */

export { createJWT, verifyJWT, createTokenPair, decodeJWT, TOKEN_EXPIRY } from "./jwt";
export type { JWTPayload } from "./jwt";

export {
	generateApiKey,
	hashApiKey,
	isValidApiKeyFormat,
	verifyApiKey,
	hasScope,
	API_SCOPES,
	API_KEY_PREFIX,
} from "./api-key";

export { requireAuth, requireRole, requireScope, optionalAuth, requireTenantAccess } from "./middleware";
