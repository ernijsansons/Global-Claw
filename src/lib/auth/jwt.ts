/**
 * JWT Utilities for Global-Claw
 * HMAC-SHA256 JWT creation and verification using Workers crypto.subtle
 */

import { AuthError, TokenExpiredError } from "../errors";

/**
 * JWT payload structure
 */
export interface JWTPayload {
	/** Subject - user ID */
	sub: string;
	/** Tenant ID */
	tid: string;
	/** User role in tenant */
	role: string;
	/** Subscription plan */
	plan?: string;
	/** Issued at (Unix timestamp) */
	iat: number;
	/** Expiration (Unix timestamp) */
	exp: number;
	/** Token type: 'access' or 'refresh' */
	type: "access" | "refresh";
}

/**
 * JWT header
 */
const JWT_HEADER = {
	alg: "HS256",
	typ: "JWT",
};

/**
 * Token expiration times
 */
export const TOKEN_EXPIRY = {
	ACCESS: 15 * 60, // 15 minutes
	REFRESH: 7 * 24 * 60 * 60, // 7 days
} as const;

/**
 * Base64url encode
 */
function base64urlEncode(data: Uint8Array | string): string {
	const str = typeof data === "string" ? data : new TextDecoder().decode(data);
	return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * Base64url decode
 */
function base64urlDecode(str: string): string {
	const padded = str + "=".repeat((4 - (str.length % 4)) % 4);
	return atob(padded.replace(/-/g, "+").replace(/_/g, "/"));
}

/**
 * Import HMAC key for signing/verification
 */
async function importKey(secret: string): Promise<CryptoKey> {
	const encoder = new TextEncoder();
	return crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [
		"sign",
		"verify",
	]);
}

/**
 * Create a signed JWT token
 */
export async function createJWT(
	payload: Omit<JWTPayload, "iat" | "exp">,
	secret: string,
	expiresIn: number = TOKEN_EXPIRY.ACCESS,
): Promise<string> {
	const now = Math.floor(Date.now() / 1000);

	const fullPayload: JWTPayload = {
		...payload,
		iat: now,
		exp: now + expiresIn,
	};

	// Encode header and payload
	const headerB64 = base64urlEncode(JSON.stringify(JWT_HEADER));
	const payloadB64 = base64urlEncode(JSON.stringify(fullPayload));
	const message = `${headerB64}.${payloadB64}`;

	// Sign
	const key = await importKey(secret);
	const encoder = new TextEncoder();
	const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(message));

	const signatureB64 = base64urlEncode(new Uint8Array(signature));

	return `${message}.${signatureB64}`;
}

/**
 * Verify and decode a JWT token
 * @throws AuthError if token is invalid
 * @throws TokenExpiredError if token is expired
 */
export async function verifyJWT(token: string, secret: string): Promise<JWTPayload> {
	const parts = token.split(".");
	if (parts.length !== 3) {
		throw new AuthError("Invalid token format");
	}

	const headerB64 = parts[0];
	const payloadB64 = parts[1];
	const signatureB64 = parts[2];

	if (!headerB64 || !payloadB64 || !signatureB64) {
		throw new AuthError("Invalid token format");
	}

	const message = `${headerB64}.${payloadB64}`;

	// Verify signature
	const key = await importKey(secret);
	const encoder = new TextEncoder();

	// Decode signature
	const signatureStr = base64urlDecode(signatureB64);
	const signature = Uint8Array.from(signatureStr, (c) => c.charCodeAt(0));

	const isValid = await crypto.subtle.verify("HMAC", key, signature, encoder.encode(message));

	if (!isValid) {
		throw new AuthError("Invalid token signature");
	}

	// Decode payload
	let payload: JWTPayload;
	try {
		payload = JSON.parse(base64urlDecode(payloadB64));
	} catch {
		throw new AuthError("Invalid token payload");
	}

	// Check expiration
	const now = Math.floor(Date.now() / 1000);
	if (payload.exp < now) {
		throw new TokenExpiredError();
	}

	return payload;
}

/**
 * Create access and refresh token pair
 */
export async function createTokenPair(
	userId: string,
	tenantId: string,
	role: string,
	plan: string | undefined,
	secret: string,
): Promise<{ accessToken: string; refreshToken: string }> {
	const basePayload = {
		sub: userId,
		tid: tenantId,
		role,
		plan,
	};

	const [accessToken, refreshToken] = await Promise.all([
		createJWT({ ...basePayload, type: "access" }, secret, TOKEN_EXPIRY.ACCESS),
		createJWT({ ...basePayload, type: "refresh" }, secret, TOKEN_EXPIRY.REFRESH),
	]);

	return { accessToken, refreshToken };
}

/**
 * Decode JWT without verification (for extracting claims before full validation)
 */
export function decodeJWT(token: string): JWTPayload | null {
	try {
		const parts = token.split(".");
		if (parts.length !== 3) return null;

		const payloadPart = parts[1];
		if (!payloadPart) return null;

		const payload = JSON.parse(base64urlDecode(payloadPart));
		return payload as JWTPayload;
	} catch {
		return null;
	}
}
