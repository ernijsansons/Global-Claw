/**
 * Cryptographic utilities for Global-Claw
 * AES-256-GCM encryption/decryption for secrets at rest
 */

/**
 * Encrypt plaintext using AES-256-GCM
 * @param plaintext - The data to encrypt
 * @param keyBase64 - Base64-encoded 32-byte key (ENCRYPTION_KEY env var)
 * @returns Base64-encoded ciphertext with IV prepended
 */
export async function encrypt(plaintext: string, keyBase64: string): Promise<string> {
	const key = await importKey(keyBase64);
	const iv = crypto.getRandomValues(new Uint8Array(12)); // 96-bit IV for GCM
	const encoder = new TextEncoder();
	const data = encoder.encode(plaintext);

	const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, data);

	// Prepend IV to ciphertext
	const combined = new Uint8Array(iv.length + ciphertext.byteLength);
	combined.set(iv, 0);
	combined.set(new Uint8Array(ciphertext), iv.length);

	return btoa(String.fromCharCode(...combined));
}

/**
 * Decrypt ciphertext using AES-256-GCM
 * @param ciphertextBase64 - Base64-encoded ciphertext with IV prepended
 * @param keyBase64 - Base64-encoded 32-byte key (ENCRYPTION_KEY env var)
 * @returns Decrypted plaintext
 */
export async function decrypt(ciphertextBase64: string, keyBase64: string): Promise<string> {
	const key = await importKey(keyBase64);
	const combined = Uint8Array.from(atob(ciphertextBase64), (c) => c.charCodeAt(0));

	// Extract IV (first 12 bytes) and ciphertext (rest)
	const iv = combined.slice(0, 12);
	const ciphertext = combined.slice(12);

	const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext);

	const decoder = new TextDecoder();
	return decoder.decode(decrypted);
}

/**
 * Import a base64-encoded key for AES-256-GCM operations
 */
async function importKey(keyBase64: string): Promise<CryptoKey> {
	const keyData = Uint8Array.from(atob(keyBase64), (c) => c.charCodeAt(0));

	if (keyData.length !== 32) {
		throw new Error(`Invalid key length: expected 32 bytes, got ${keyData.length}`);
	}

	return crypto.subtle.importKey("raw", keyData, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

/**
 * Generate a secure random encryption key (for initial setup)
 * @returns Base64-encoded 32-byte key
 */
export function generateEncryptionKey(): string {
	const key = crypto.getRandomValues(new Uint8Array(32));
	return btoa(String.fromCharCode(...key));
}

/**
 * Hash a string using SHA-256 (for API key verification)
 * @param input - The string to hash
 * @returns Hex-encoded SHA-256 hash
 */
export async function sha256(input: string): Promise<string> {
	const encoder = new TextEncoder();
	const data = encoder.encode(input);
	const hashBuffer = await crypto.subtle.digest("SHA-256", data);
	const hashArray = new Uint8Array(hashBuffer);
	return Array.from(hashArray)
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("");
}

/**
 * Constant-time string comparison to prevent timing attacks
 */
export function constantTimeEqual(a: string, b: string): boolean {
	if (a.length !== b.length) {
		return false;
	}

	let result = 0;
	for (let i = 0; i < a.length; i++) {
		result |= a.charCodeAt(i) ^ b.charCodeAt(i);
	}
	return result === 0;
}
