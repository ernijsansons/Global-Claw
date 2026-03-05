/**
 * Crypto Unit Tests
 * Tests AES-256-GCM encryption/decryption and constant-time comparison
 */

import { describe, expect, it } from "vitest";
import { constantTimeEqual, decrypt, encrypt, generateEncryptionKey, sha256 } from "../../src/lib/crypto";

describe("Crypto Utilities", () => {
	describe("AES-256-GCM Encryption", () => {
		it("should encrypt and decrypt correctly", async () => {
			const key = generateEncryptionKey();
			const plaintext = "Hello, World!";

			const ciphertext = await encrypt(plaintext, key);
			const decrypted = await decrypt(ciphertext, key);

			expect(decrypted).toBe(plaintext);
		});

		it("should produce different ciphertext for same plaintext (random IV)", async () => {
			const key = generateEncryptionKey();
			const plaintext = "Same plaintext";

			const ciphertext1 = await encrypt(plaintext, key);
			const ciphertext2 = await encrypt(plaintext, key);

			expect(ciphertext1).not.toBe(ciphertext2);
		});

		it("should fail decryption with wrong key", async () => {
			const key1 = generateEncryptionKey();
			const key2 = generateEncryptionKey();
			const plaintext = "Secret data";

			const ciphertext = await encrypt(plaintext, key1);

			await expect(decrypt(ciphertext, key2)).rejects.toThrow();
		});

		it("should handle empty string", async () => {
			const key = generateEncryptionKey();
			const plaintext = "";

			const ciphertext = await encrypt(plaintext, key);
			const decrypted = await decrypt(ciphertext, key);

			expect(decrypted).toBe(plaintext);
		});

		it("should handle unicode characters", async () => {
			const key = generateEncryptionKey();
			const plaintext = "Sveiki, pasaule! Привет мир! Hello World!";

			const ciphertext = await encrypt(plaintext, key);
			const decrypted = await decrypt(ciphertext, key);

			expect(decrypted).toBe(plaintext);
		});

		it("should handle long strings", async () => {
			const key = generateEncryptionKey();
			const plaintext = "A".repeat(10000);

			const ciphertext = await encrypt(plaintext, key);
			const decrypted = await decrypt(ciphertext, key);

			expect(decrypted).toBe(plaintext);
		});

		it("should reject invalid key length", async () => {
			const shortKey = btoa("short");
			const plaintext = "Test";

			await expect(encrypt(plaintext, shortKey)).rejects.toThrow("Invalid key length");
		});
	});

	describe("Key Generation", () => {
		it("should generate 32-byte key", () => {
			const key = generateEncryptionKey();
			const decoded = atob(key);
			expect(decoded.length).toBe(32);
		});

		it("should generate unique keys", () => {
			const key1 = generateEncryptionKey();
			const key2 = generateEncryptionKey();
			expect(key1).not.toBe(key2);
		});
	});

	describe("SHA-256 Hashing", () => {
		it("should hash correctly", async () => {
			const hash = await sha256("test");
			expect(hash).toBe("9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08");
		});

		it("should produce different hashes for different inputs", async () => {
			const hash1 = await sha256("test1");
			const hash2 = await sha256("test2");
			expect(hash1).not.toBe(hash2);
		});

		it("should produce same hash for same input", async () => {
			const hash1 = await sha256("same");
			const hash2 = await sha256("same");
			expect(hash1).toBe(hash2);
		});

		it("should handle empty string", async () => {
			const hash = await sha256("");
			expect(hash).toBe("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
		});
	});

	describe("Constant-Time Comparison", () => {
		it("should return true for equal strings", () => {
			expect(constantTimeEqual("abc", "abc")).toBe(true);
		});

		it("should return false for different strings", () => {
			expect(constantTimeEqual("abc", "abd")).toBe(false);
		});

		it("should return false for different lengths", () => {
			expect(constantTimeEqual("abc", "abcd")).toBe(false);
		});

		it("should return true for empty strings", () => {
			expect(constantTimeEqual("", "")).toBe(true);
		});

		it("should handle special characters", () => {
			expect(constantTimeEqual("a=b&c=d", "a=b&c=d")).toBe(true);
			expect(constantTimeEqual("a=b&c=d", "a=b&c=e")).toBe(false);
		});

		it("should handle unicode", () => {
			expect(constantTimeEqual("Привет", "Привет")).toBe(true);
			expect(constantTimeEqual("Привет", "Привер")).toBe(false);
		});
	});
});
