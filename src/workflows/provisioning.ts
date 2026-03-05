/**
 * TenantProvisioningWorkflow
 * Cloudflare Workflow for zero-touch tenant setup
 *
 * Steps:
 * 1. ValidateEvent - Idempotent check via stripe_events table
 * 2. CreateUser - D1 insert
 * 3. CreateTenant - D1 insert
 * 4. AllocateSubdomain - DNS via CF API (placeholder)
 * 5. SeedTemplates - R2 copy (placeholder)
 * 6. CreateTenantDO - DO stub.fetch() initialization
 * 7. ActivateDefaultPacks - DO MCP tool registration
 * 8. IssueApiKeys - crypto.randomUUID + D1 store
 * 9. NotifyUser - Queue message
 */

import { WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep } from "cloudflare:workers";
import { sha256 } from "../lib/crypto";
import type { Env } from "../types/env";

/**
 * Provisioning workflow input
 */
export interface ProvisioningInput {
	email: string;
	name?: string;
	plan: "starter" | "pro" | "business" | "enterprise";
	referral_code?: string;
	stripe_event_id?: string;
	stripe_customer_id?: string;
	stripe_subscription_id?: string;
}

/**
 * Provisioning workflow output
 */
export interface ProvisioningOutput {
	tenant_id: string;
	user_id: string;
	api_key: string;
	subdomain: string;
}

/**
 * Plan limits configuration
 */
const PLAN_LIMITS: Record<
	string,
	{
		token_budget_daily: number;
		msg_budget_daily: number;
		max_agents: number;
	}
> = {
	starter: { token_budget_daily: 5_000_000, msg_budget_daily: 2_500, max_agents: 1 },
	pro: { token_budget_daily: 50_000_000, msg_budget_daily: 10_000, max_agents: 5 },
	business: { token_budget_daily: 500_000_000, msg_budget_daily: 100_000, max_agents: 25 },
	enterprise: { token_budget_daily: -1, msg_budget_daily: -1, max_agents: -1 }, // unlimited
};

/**
 * TenantProvisioningWorkflow
 * Handles new tenant setup in a durable, resumable manner.
 */
export class TenantProvisioningWorkflow extends WorkflowEntrypoint<Env, ProvisioningInput> {
	async run(event: WorkflowEvent<ProvisioningInput>, step: WorkflowStep): Promise<ProvisioningOutput> {
		const input = event.payload;

		// Step 1: Validate event (idempotency check)
		const validated = await step.do("validate-event", async () => {
			if (input.stripe_event_id) {
				// Check if we've already processed this Stripe event
				const existing = await this.env.DB.prepare("SELECT id FROM stripe_events WHERE event_id = ?")
					.bind(input.stripe_event_id)
					.first();

				if (existing) {
					return { valid: false, reason: "duplicate_event" };
				}

				// Record the event for idempotency
				await this.env.DB.prepare(
					"INSERT INTO stripe_events (id, event_id, event_type, processed_at) VALUES (?, ?, ?, datetime('now'))",
				)
					.bind(crypto.randomUUID(), input.stripe_event_id, "customer.subscription.created")
					.run();
			}

			// Check if user with this email already exists
			const existingUser = await this.env.DB.prepare("SELECT id FROM users WHERE email = ?")
				.bind(input.email.toLowerCase())
				.first();

			if (existingUser) {
				return { valid: false, reason: "user_exists" };
			}

			return { valid: true };
		});

		if (!validated.valid) {
			throw new Error(`Provisioning validation failed: ${validated.reason ?? "unknown"}`);
		}

		// Step 2: Create user
		const user = await step.do("create-user", async () => {
			const userId = crypto.randomUUID();

			await this.env.DB.prepare(
				`INSERT INTO users (id, email, stripe_customer_id, created_at, updated_at)
				 VALUES (?, ?, ?, datetime('now'), datetime('now'))`,
			)
				.bind(userId, input.email.toLowerCase(), input.stripe_customer_id ?? null)
				.run();

			return { id: userId, email: input.email.toLowerCase() };
		});

		// Step 3: Create tenant
		const tenant = await step.do("create-tenant", async () => {
			const tenantId = crypto.randomUUID();
			const limits = PLAN_LIMITS[input.plan] ?? PLAN_LIMITS.starter;

			// Generate slug from name or email
			const baseName = input.name ?? input.email.split("@")[0] ?? "tenant";
			const slug = baseName
				.toLowerCase()
				.replace(/[^a-z0-9]+/g, "-")
				.replace(/^-|-$/g, "")
				.slice(0, 32);

			// Make slug unique by appending random suffix if needed
			const uniqueSlug = `${slug}-${crypto.randomUUID().slice(0, 8)}`;

			await this.env.DB.prepare(
				`INSERT INTO tenants (
					id, name, slug, status, plan,
					token_budget_daily, msg_budget_daily, max_agents,
					created_at, updated_at
				) VALUES (?, ?, ?, 'active', ?, ?, ?, ?, datetime('now'), datetime('now'))`,
			)
				.bind(
					tenantId,
					input.name ?? input.email.split("@")[0] ?? "New Tenant",
					uniqueSlug,
					input.plan,
					limits.token_budget_daily,
					limits.msg_budget_daily,
					limits.max_agents,
				)
				.run();

			// Link user to tenant as owner
			await this.env.DB.prepare(
				`INSERT INTO tenant_users (tenant_id, user_id, role, created_at)
				 VALUES (?, ?, 'owner', datetime('now'))`,
			)
				.bind(tenantId, user.id)
				.run();

			return { id: tenantId, slug: uniqueSlug, plan: input.plan };
		});

		// Step 4: Create subscription record
		await step.do("create-subscription", async () => {
			if (input.stripe_subscription_id) {
				await this.env.DB.prepare(
					`INSERT INTO subscriptions (
						id, tenant_id, stripe_subscription_id, status,
						created_at, updated_at
					) VALUES (?, ?, ?, 'active', datetime('now'), datetime('now'))`,
				)
					.bind(crypto.randomUUID(), tenant.id, input.stripe_subscription_id)
					.run();
			}
			return { created: !!input.stripe_subscription_id };
		});

		// Step 5: Allocate subdomain
		const subdomain = await step.do("allocate-subdomain", async () => {
			// For now, just construct the subdomain
			// In production, this would create a DNS record via Cloudflare API
			const subdomainValue = `${tenant.slug}.global-claw.com`;

			// Update tenant with subdomain
			await this.env.DB.prepare("UPDATE tenants SET subdomain = ? WHERE id = ?").bind(subdomainValue, tenant.id).run();

			return subdomainValue;
		});

		// Step 6: Seed templates
		await step.do("seed-templates", async () => {
			// Copy default templates from R2 to tenant folder
			// This is a placeholder - actual implementation would copy files
			const templateTypes = ["soul_template.md", "agents_template.md"];
			let copied = 0;

			for (const template of templateTypes) {
				try {
					const source = await this.env.ASSETS.get(`templates/${template}`);
					if (source) {
						await this.env.ASSETS.put(`tenants/${tenant.id}/${template}`, source.body);
						copied++;
					}
				} catch {
					// Template not found, skip
				}
			}

			return { templates_copied: copied };
		});

		// Step 7: Initialize Durable Object
		await step.do("initialize-do", async () => {
			// Get DO stub using tenant ID as the name
			const doId = this.env.TENANT_AGENT.idFromName(tenant.id);
			const stub = this.env.TENANT_AGENT.get(doId);

			// Call the bind endpoint to initialize the DO with tenant data
			const response = await stub.fetch(
				new Request("https://do/bind", {
					method: "POST",
					headers: {
						"X-Tenant-ID": tenant.id,
						"X-DO-Auth": this.env.JWT_SECRET,
						"Content-Type": "application/json",
					},
				}),
			);
			const result = (await response.json()) as { success: boolean; error?: { message?: string }; data?: unknown };

			if (!result.success) {
				const errorMsg = typeof result.error === "object" ? result.error?.message : String(result.error);
				throw new Error(`Failed to initialize DO: ${errorMsg}`);
			}

			return { initialized: true, tenant_id: tenant.id };
		});

		// Step 8: Activate default packs based on plan
		await step.do("activate-packs", async () => {
			// Default packs for all plans
			const basePacks = ["faq", "lead-capture"];

			// Additional packs for higher tiers
			const planPacks: Record<string, string[]> = {
				starter: [],
				pro: ["appointment-intake", "review-collector"],
				business: ["appointment-intake", "review-collector", "internal-ops"],
				enterprise: ["appointment-intake", "review-collector", "internal-ops", "custom"],
			};

			const packs = [...basePacks, ...(planPacks[input.plan] ?? [])];

			// Store activated packs in tenant config (could also be done in DO)
			await this.env.DB.prepare("UPDATE tenants SET feature_flags_json = ? WHERE id = ?")
				.bind(JSON.stringify({ activated_packs: packs }), tenant.id)
				.run();

			return { packs_activated: packs };
		});

		// Step 9: Issue API key
		const apiKey = await step.do("issue-api-key", async () => {
			// Generate a live API key
			const keyValue = `gc_live_${crypto.randomUUID().replace(/-/g, "")}`;
			const keyPrefix = keyValue.slice(0, 12);
			const keyHash = await sha256(keyValue);

			await this.env.DB.prepare(
				`INSERT INTO api_keys (
					id, tenant_id, key_hash, key_prefix, name, scopes_json, created_at
				) VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`,
			)
				.bind(
					crypto.randomUUID(),
					tenant.id,
					keyHash,
					keyPrefix,
					"Default API Key",
					JSON.stringify(["agents.read", "agents.write", "workflows.read", "workflows.write"]),
				)
				.run();

			return keyValue;
		});

		// Step 10: Send notification
		await step.do("notify-user", async () => {
			// Send welcome email via notification queue
			await this.env.NOTIFICATION_QUEUE.send({
				type: "email",
				template: "welcome",
				recipient: input.email,
				data: {
					tenant_name: tenant.slug,
					subdomain: subdomain,
					plan: input.plan,
					api_key_prefix: apiKey.slice(0, 12),
				},
			});

			// Log audit event
			await this.env.AUDIT_QUEUE.send({
				tenant_id: tenant.id,
				actor_id: user.id,
				actor_type: "system",
				action: "tenant.provisioned",
				resource_type: "tenant",
				resource_id: tenant.id,
				details: {
					plan: input.plan,
					subdomain: subdomain,
					referral_code: input.referral_code,
				},
				timestamp: new Date().toISOString(),
			});

			return { notified: true };
		});

		return {
			tenant_id: tenant.id,
			user_id: user.id,
			api_key: apiKey,
			subdomain,
		};
	}
}
