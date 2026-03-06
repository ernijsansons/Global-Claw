/**
 * Stripe Webhook Handler
 * POST /api/stripe/webhook
 *
 * Handles Stripe webhook events with:
 * - Signature verification using STRIPE_WEBHOOK_SECRET
 * - Idempotency via stripe_events table
 * - Plan mapping: starter $29, pro $79, business $149
 */

import { Hono } from "hono";
import type { Env } from "../types/env";
import type { ProvisioningInput } from "../workflows/provisioning";

const stripe = new Hono<{ Bindings: Env }>();
const STRIPE_WEBHOOK_TOLERANCE_SECONDS = 300;

/**
 * Plan mapping from Stripe price IDs to plan names
 * These should match your Stripe product configuration
 */
const PRICE_TO_PLAN: Record<string, "starter" | "pro" | "business" | "enterprise"> = {
	// Production price IDs (replace with actual Stripe price IDs)
	price_starter_monthly: "starter",
	price_pro_monthly: "pro",
	price_business_monthly: "business",
	price_enterprise_monthly: "enterprise",
	// Test mode price IDs
	price_test_starter: "starter",
	price_test_pro: "pro",
	price_test_business: "business",
	price_test_enterprise: "enterprise",
};

/**
 * Verify Stripe webhook signature
 * Uses crypto.subtle for HMAC-SHA256 verification
 */
async function verifyStripeSignature(
	payload: string,
	signature: string,
	secret: string,
): Promise<{ valid: boolean; timestamp?: number }> {
	// Parse the signature header
	const elements = signature.split(",");
	let timestamp: string | undefined;
	const v1Signatures: string[] = [];

	for (const element of elements) {
		const [key, value] = element.split("=");
		if (key && value) {
			if (key === "t") {
				timestamp = value;
			} else if (key === "v1") {
				v1Signatures.push(value);
			}
		}
	}

	if (!timestamp || v1Signatures.length === 0) {
		return { valid: false };
	}

	// Check timestamp is within tolerance (5 minutes)
	const timestampNum = Number.parseInt(timestamp, 10);
	const now = Math.floor(Date.now() / 1000);
	if (Math.abs(now - timestampNum) > STRIPE_WEBHOOK_TOLERANCE_SECONDS) {
		return { valid: false };
	}

	// Compute expected signature
	const signedPayload = `${timestamp}.${payload}`;
	const encoder = new TextEncoder();

	const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [
		"sign",
	]);

	const signatureBuffer = await crypto.subtle.sign("HMAC", key, encoder.encode(signedPayload));

	// Convert to hex string
	const expectedSignature = Array.from(new Uint8Array(signatureBuffer))
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("");

	// Constant-time comparison against every v1 signature value.
	// Stripe may include multiple v1 signatures in a single header.
	for (const candidateSignature of v1Signatures) {
		if (expectedSignature.length !== candidateSignature.length) {
			continue;
		}

		let result = 0;
		for (let i = 0; i < expectedSignature.length; i++) {
			result |= expectedSignature.charCodeAt(i) ^ candidateSignature.charCodeAt(i);
		}

		if (result === 0) {
			return { valid: true, timestamp: timestampNum };
		}
	}

	return { valid: false };
}

/**
 * POST /api/stripe/webhook
 * Handle Stripe webhook events
 */
stripe.post("/webhook", async (c) => {
	const signature = c.req.header("stripe-signature");
	if (!signature) {
		return c.json(
			{
				success: false,
				error: { code: "MISSING_SIGNATURE", message: "Missing stripe-signature header" },
			},
			400,
		);
	}

	// Get raw body for signature verification
	const payload = await c.req.text();

	// Verify signature
	const verification = await verifyStripeSignature(payload, signature, c.env.STRIPE_WEBHOOK_SECRET);

	if (!verification.valid) {
		return c.json(
			{
				success: false,
				error: { code: "INVALID_SIGNATURE", message: "Invalid webhook signature" },
			},
			401,
		);
	}

	// Parse the event
	let event: StripeEvent;
	try {
		event = JSON.parse(payload) as StripeEvent;
	} catch {
		return c.json(
			{
				success: false,
				error: { code: "INVALID_PAYLOAD", message: "Invalid JSON payload" },
			},
			400,
		);
	}

	// Check idempotency - have we already processed this event?
	const existingEvent = await c.env.DB.prepare("SELECT 1 FROM stripe_events WHERE event_id = ?").bind(event.id).first();

	if (existingEvent) {
		// Already processed, return success to prevent retries
		return c.json({ success: true, data: { message: "Event already processed" } });
	}

	// Handle the event
	try {
		switch (event.type) {
			case "customer.subscription.created":
			case "checkout.session.completed":
				await handleSubscriptionCreated(c.env, event);
				break;

			case "customer.subscription.updated":
				await handleSubscriptionUpdated(c.env, event);
				break;

			case "customer.subscription.deleted":
				await handleSubscriptionDeleted(c.env, event);
				break;

			case "invoice.payment_succeeded":
				await handlePaymentSucceeded(c.env, event);
				break;

			case "invoice.payment_failed":
				await handlePaymentFailed(c.env, event);
				break;

			default:
				// Record unhandled event types for monitoring
				console.info(`Unhandled Stripe event type: ${event.type}`);
		}

		// Record the event for idempotency (event_id is the PK)
		await c.env.DB.prepare(
			"INSERT INTO stripe_events (event_id, event_type, processed_at) VALUES (?, ?, datetime('now'))",
		)
			.bind(event.id, event.type)
			.run();

		return c.json({ success: true, data: { received: true } });
	} catch (error) {
		console.error(`Error processing Stripe event ${event.id}:`, error);

		return c.json(
			{
				success: false,
				error: { code: "PROCESSING_ERROR", message: "Failed to process webhook event" },
			},
			500,
		);
	}
});

/**
 * Stripe event types we handle
 */
interface StripeEvent {
	id: string;
	type: string;
	data: {
		object: Record<string, unknown>;
	};
}

/**
 * Handle new subscription created
 * Triggers the provisioning workflow
 */
async function handleSubscriptionCreated(env: Env, event: StripeEvent): Promise<void> {
	const subscription = event.data.object as {
		id: string;
		customer: string;
		status: string;
		items?: {
			data?: Array<{
				price?: { id: string };
			}>;
		};
		metadata?: Record<string, string>;
	};

	// Only process active subscriptions
	if (subscription.status !== "active" && subscription.status !== "trialing") {
		return;
	}

	// Get customer email from Stripe (would need API call in production)
	const customerEmail = subscription.metadata?.email;
	if (!customerEmail) {
		console.error("No email in subscription metadata");
		return;
	}

	// Determine plan from price ID
	const priceId = subscription.items?.data?.[0]?.price?.id ?? "";
	const plan = PRICE_TO_PLAN[priceId] ?? "starter";

	// Check if user already exists
	const existingUser = await env.DB.prepare("SELECT id FROM users WHERE email = ?")
		.bind(customerEmail.toLowerCase())
		.first();

	if (existingUser) {
		// User exists, just update their subscription
		const tenant = await env.DB.prepare(
			"SELECT t.id FROM tenants t JOIN tenant_users tu ON t.id = tu.tenant_id WHERE tu.user_id = ?",
		)
			.bind(existingUser.id)
			.first<{ id: string }>();

		if (tenant) {
			await env.DB.prepare(
				`UPDATE subscriptions SET stripe_subscription_id = ?, status = 'active', updated_at = datetime('now')
				 WHERE tenant_id = ?`,
			)
				.bind(subscription.id, tenant.id)
				.run();
		}
		return;
	}

	// Trigger provisioning workflow for new customer
	const workflowInput: ProvisioningInput = {
		email: customerEmail.toLowerCase(),
		name: subscription.metadata?.name,
		plan,
		stripe_event_id: event.id,
		stripe_customer_id: subscription.customer,
		stripe_subscription_id: subscription.id,
		referral_code: subscription.metadata?.referral_code,
	};

	const workflowId = crypto.randomUUID();
	await env.PROVISIONING_WORKFLOW.create({
		id: workflowId,
		params: workflowInput,
	});

	console.info(`Started provisioning workflow ${workflowId} for ${customerEmail}`);
}

/**
 * Handle subscription updated (plan changes)
 */
async function handleSubscriptionUpdated(env: Env, event: StripeEvent): Promise<void> {
	const subscription = event.data.object as {
		id: string;
		status: string;
		items?: {
			data?: Array<{
				price?: { id: string };
			}>;
		};
	};

	// Get tenant by subscription ID
	const sub = await env.DB.prepare("SELECT tenant_id FROM subscriptions WHERE stripe_subscription_id = ?")
		.bind(subscription.id)
		.first<{ tenant_id: string }>();

	if (!sub) {
		return;
	}

	// Determine new plan
	const priceId = subscription.items?.data?.[0]?.price?.id ?? "";
	const newPlan = PRICE_TO_PLAN[priceId] ?? "starter";

	// Plan limits
	const defaultLimits = { token_budget_daily: 5_000_000, msg_budget_daily: 2_500, max_agents: 1 };
	const planLimits: Record<string, { token_budget_daily: number; msg_budget_daily: number; max_agents: number }> = {
		starter: defaultLimits,
		pro: { token_budget_daily: 50_000_000, msg_budget_daily: 10_000, max_agents: 5 },
		business: { token_budget_daily: 500_000_000, msg_budget_daily: 100_000, max_agents: 25 },
		enterprise: { token_budget_daily: -1, msg_budget_daily: -1, max_agents: -1 },
	};

	const limits = planLimits[newPlan] ?? defaultLimits;

	// Update tenant plan and limits
	await env.DB.prepare(
		`UPDATE tenants SET
			plan = ?,
			token_budget_daily = ?,
			msg_budget_daily = ?,
			max_agents = ?,
			updated_at = datetime('now')
		 WHERE id = ?`,
	)
		.bind(newPlan, limits.token_budget_daily, limits.msg_budget_daily, limits.max_agents, sub.tenant_id)
		.run();

	// Update subscription status
	await env.DB.prepare("UPDATE subscriptions SET status = ?, updated_at = datetime('now') WHERE tenant_id = ?")
		.bind(subscription.status, sub.tenant_id)
		.run();

	// Send notification about plan change
	const tenant = await env.DB.prepare("SELECT name FROM tenants WHERE id = ?")
		.bind(sub.tenant_id)
		.first<{ name: string }>();

	if (tenant) {
		await env.NOTIFICATION_QUEUE.send({
			type: "plan_change",
			tenant_id: sub.tenant_id,
			data: {
				tenant_name: tenant.name,
				new_plan: newPlan,
			},
		});
	}
}

/**
 * Handle subscription cancelled
 */
async function handleSubscriptionDeleted(env: Env, event: StripeEvent): Promise<void> {
	const subscription = event.data.object as {
		id: string;
	};

	// Get tenant by subscription ID
	const sub = await env.DB.prepare("SELECT tenant_id FROM subscriptions WHERE stripe_subscription_id = ?")
		.bind(subscription.id)
		.first<{ tenant_id: string }>();

	if (!sub) {
		return;
	}

	// Mark subscription as cancelled
	await env.DB.prepare(
		"UPDATE subscriptions SET status = 'cancelled', updated_at = datetime('now') WHERE tenant_id = ?",
	)
		.bind(sub.tenant_id)
		.run();

	// Mark tenant as suspended (soft delete)
	await env.DB.prepare("UPDATE tenants SET status = 'suspended', updated_at = datetime('now') WHERE id = ?")
		.bind(sub.tenant_id)
		.run();

	// Log audit event
	await env.AUDIT_QUEUE.send({
		tenant_id: sub.tenant_id,
		actor_id: "system",
		actor_type: "system",
		action: "subscription.cancelled",
		resource_type: "subscription",
		resource_id: subscription.id,
		timestamp: new Date().toISOString(),
	});
}

/**
 * Handle successful payment
 */
async function handlePaymentSucceeded(env: Env, event: StripeEvent): Promise<void> {
	const invoice = event.data.object as {
		subscription: string;
		amount_paid: number;
		currency: string;
	};

	if (!invoice.subscription) {
		return;
	}

	// Get tenant by subscription ID
	const sub = await env.DB.prepare("SELECT tenant_id FROM subscriptions WHERE stripe_subscription_id = ?")
		.bind(invoice.subscription)
		.first<{ tenant_id: string }>();

	if (!sub) {
		return;
	}

	// Ensure tenant is active
	await env.DB.prepare(
		"UPDATE tenants SET status = 'active', updated_at = datetime('now') WHERE id = ? AND status = 'suspended'",
	)
		.bind(sub.tenant_id)
		.run();

	// Log audit event
	await env.AUDIT_QUEUE.send({
		tenant_id: sub.tenant_id,
		actor_id: "system",
		actor_type: "system",
		action: "payment.succeeded",
		resource_type: "invoice",
		resource_id: event.id,
		details: {
			amount: invoice.amount_paid,
			currency: invoice.currency,
		},
		timestamp: new Date().toISOString(),
	});
}

/**
 * Handle failed payment
 */
async function handlePaymentFailed(env: Env, event: StripeEvent): Promise<void> {
	const invoice = event.data.object as {
		subscription: string;
		attempt_count: number;
		next_payment_attempt: number | null;
	};

	if (!invoice.subscription) {
		return;
	}

	// Get tenant by subscription ID
	const sub = await env.DB.prepare("SELECT tenant_id FROM subscriptions WHERE stripe_subscription_id = ?")
		.bind(invoice.subscription)
		.first<{ tenant_id: string }>();

	if (!sub) {
		return;
	}

	// Get tenant owner email
	const owner = await env.DB.prepare(
		`SELECT u.email FROM users u
		 JOIN tenant_users tu ON u.id = tu.user_id
		 WHERE tu.tenant_id = ? AND tu.role = 'owner'`,
	)
		.bind(sub.tenant_id)
		.first<{ email: string }>();

	// Send payment failed notification
	if (owner) {
		await env.NOTIFICATION_QUEUE.send({
			type: "email",
			template: "payment_failed",
			recipient: owner.email,
			data: {
				attempt_count: invoice.attempt_count,
				will_retry: invoice.next_payment_attempt !== null,
			},
		});
	}

	// Log audit event
	await env.AUDIT_QUEUE.send({
		tenant_id: sub.tenant_id,
		actor_id: "system",
		actor_type: "system",
		action: "payment.failed",
		resource_type: "invoice",
		resource_id: event.id,
		details: {
			attempt_count: invoice.attempt_count,
		},
		timestamp: new Date().toISOString(),
	});
}

export { stripe };
