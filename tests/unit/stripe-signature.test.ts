/**
 * Stripe Signature Verification Unit Tests
 * Tests HMAC-SHA256 signature verification and timestamp validation
 */

import { describe, expect, it } from "vitest";

/**
 * Verify Stripe webhook signature (copy of production logic for testing)
 */
async function verifyStripeSignature(
	payload: string,
	signature: string,
	secret: string,
): Promise<{ valid: boolean; timestamp?: number }> {
	const elements = signature.split(",");
	const signatureData: Record<string, string> = {};

	for (const element of elements) {
		const [key, value] = element.split("=");
		if (key && value) {
			signatureData[key] = value;
		}
	}

	const timestamp = signatureData.t;
	const v1Signature = signatureData.v1;

	if (!timestamp || !v1Signature) {
		return { valid: false };
	}

	const timestampNum = Number.parseInt(timestamp, 10);
	const now = Math.floor(Date.now() / 1000);
	if (Math.abs(now - timestampNum) > 300) {
		return { valid: false };
	}

	const signedPayload = `${timestamp}.${payload}`;
	const encoder = new TextEncoder();

	const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [
		"sign",
	]);

	const signatureBuffer = await crypto.subtle.sign("HMAC", key, encoder.encode(signedPayload));

	const expectedSignature = Array.from(new Uint8Array(signatureBuffer))
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("");

	if (expectedSignature.length !== v1Signature.length) {
		return { valid: false };
	}

	let result = 0;
	for (let i = 0; i < expectedSignature.length; i++) {
		result |= expectedSignature.charCodeAt(i) ^ v1Signature.charCodeAt(i);
	}

	return { valid: result === 0, timestamp: timestampNum };
}

/**
 * Create a valid Stripe signature for testing
 */
async function createStripeSignature(
	payload: string,
	secret: string,
	timestamp?: number,
): Promise<{ signature: string; timestamp: number }> {
	const ts = timestamp ?? Math.floor(Date.now() / 1000);
	const signedPayload = `${ts}.${payload}`;
	const encoder = new TextEncoder();

	const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [
		"sign",
	]);

	const signatureBuffer = await crypto.subtle.sign("HMAC", key, encoder.encode(signedPayload));

	const v1Signature = Array.from(new Uint8Array(signatureBuffer))
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("");

	return {
		signature: `t=${ts},v1=${v1Signature}`,
		timestamp: ts,
	};
}

describe("Stripe Signature Verification", () => {
	const testSecret = "whsec_test_secret_key_12345";

	describe("Valid Signatures", () => {
		it("should accept valid signature with current timestamp", async () => {
			const payload = '{"id":"evt_123","type":"test"}';
			const { signature } = await createStripeSignature(payload, testSecret);

			const result = await verifyStripeSignature(payload, signature, testSecret);

			expect(result.valid).toBe(true);
			expect(result.timestamp).toBeDefined();
		});

		it("should accept signature within 5-minute window (2 min ago)", async () => {
			const payload = '{"id":"evt_123","type":"test"}';
			const twoMinutesAgo = Math.floor(Date.now() / 1000) - 120;
			const { signature } = await createStripeSignature(payload, testSecret, twoMinutesAgo);

			const result = await verifyStripeSignature(payload, signature, testSecret);

			expect(result.valid).toBe(true);
		});

		it("should accept signature at boundary (4 min 59 sec ago)", async () => {
			const payload = '{"id":"evt_123","type":"test"}';
			const almostExpired = Math.floor(Date.now() / 1000) - 299;
			const { signature } = await createStripeSignature(payload, testSecret, almostExpired);

			const result = await verifyStripeSignature(payload, signature, testSecret);

			expect(result.valid).toBe(true);
		});
	});

	describe("Invalid Signatures", () => {
		it("should reject wrong signature value", async () => {
			const payload = '{"id":"evt_123","type":"test"}';
			const now = Math.floor(Date.now() / 1000);
			const fakeSignature = `t=${now},v1=0000000000000000000000000000000000000000000000000000000000000000`;

			const result = await verifyStripeSignature(payload, fakeSignature, testSecret);

			expect(result.valid).toBe(false);
		});

		it("should reject modified payload", async () => {
			const originalPayload = '{"id":"evt_123","type":"test"}';
			const { signature } = await createStripeSignature(originalPayload, testSecret);

			const modifiedPayload = '{"id":"evt_456","type":"test"}';
			const result = await verifyStripeSignature(modifiedPayload, signature, testSecret);

			expect(result.valid).toBe(false);
		});

		it("should reject wrong secret", async () => {
			const payload = '{"id":"evt_123","type":"test"}';
			const { signature } = await createStripeSignature(payload, testSecret);

			const result = await verifyStripeSignature(payload, signature, "wrong_secret");

			expect(result.valid).toBe(false);
		});
	});

	describe("Timestamp Replay Protection", () => {
		it("should reject timestamp too old (6 minutes ago)", async () => {
			const payload = '{"id":"evt_123","type":"test"}';
			const sixMinutesAgo = Math.floor(Date.now() / 1000) - 360;
			const { signature } = await createStripeSignature(payload, testSecret, sixMinutesAgo);

			const result = await verifyStripeSignature(payload, signature, testSecret);

			expect(result.valid).toBe(false);
		});

		it("should reject timestamp too new (6 minutes in future)", async () => {
			const payload = '{"id":"evt_123","type":"test"}';
			const sixMinutesAhead = Math.floor(Date.now() / 1000) + 360;
			const { signature } = await createStripeSignature(payload, testSecret, sixMinutesAhead);

			const result = await verifyStripeSignature(payload, signature, testSecret);

			expect(result.valid).toBe(false);
		});

		it("should reject timestamp exactly at boundary (5 min 1 sec ago)", async () => {
			const payload = '{"id":"evt_123","type":"test"}';
			const justExpired = Math.floor(Date.now() / 1000) - 301;
			const { signature } = await createStripeSignature(payload, testSecret, justExpired);

			const result = await verifyStripeSignature(payload, signature, testSecret);

			expect(result.valid).toBe(false);
		});
	});

	describe("Malformed Signatures", () => {
		it("should reject missing timestamp", async () => {
			const payload = '{"id":"evt_123","type":"test"}';
			const signature = "v1=abc123";

			const result = await verifyStripeSignature(payload, signature, testSecret);

			expect(result.valid).toBe(false);
		});

		it("should reject missing v1 signature", async () => {
			const payload = '{"id":"evt_123","type":"test"}';
			const signature = `t=${Math.floor(Date.now() / 1000)}`;

			const result = await verifyStripeSignature(payload, signature, testSecret);

			expect(result.valid).toBe(false);
		});

		it("should reject empty signature", async () => {
			const payload = '{"id":"evt_123","type":"test"}';

			const result = await verifyStripeSignature(payload, "", testSecret);

			expect(result.valid).toBe(false);
		});

		it("should reject garbage signature", async () => {
			const payload = '{"id":"evt_123","type":"test"}';

			const result = await verifyStripeSignature(payload, "garbage", testSecret);

			expect(result.valid).toBe(false);
		});

		it("should handle signature with extra fields", async () => {
			const payload = '{"id":"evt_123","type":"test"}';
			const { signature } = await createStripeSignature(payload, testSecret);
			const extendedSignature = `${signature},v2=extra_field`;

			const result = await verifyStripeSignature(payload, extendedSignature, testSecret);

			expect(result.valid).toBe(true);
		});
	});

	describe("Constant-Time Comparison", () => {
		it("should reject signatures of different length", async () => {
			const payload = '{"id":"evt_123","type":"test"}';
			const now = Math.floor(Date.now() / 1000);
			const shortSignature = `t=${now},v1=abc`;

			const result = await verifyStripeSignature(payload, shortSignature, testSecret);

			expect(result.valid).toBe(false);
		});
	});
});
