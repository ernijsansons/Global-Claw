/**
 * TenantProvisioningWorkflow
 * Cloudflare Workflow for zero-touch tenant setup
 *
 * This is a stub implementation for Phase 1.
 * Full implementation in Phase 6 will include 9 steps:
 * 1. ValidateEvent - Idempotent check via stripe_events table
 * 2. CreateUser - D1 insert
 * 3. CreateTenant - D1 insert
 * 4. AllocateSubdomain - DNS via CF API
 * 5. SeedTemplates - R2 copy
 * 6. CreateTenantDO - DO stub.fetch() initialization
 * 7. ActivateDefaultPacks - DO MCP tool registration
 * 8. IssueApiKeys - crypto.randomUUID + D1 store
 * 9. NotifyUser - Queue message
 */

import { WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep } from "cloudflare:workers";
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
 * TenantProvisioningWorkflow
 * Handles new tenant setup in a durable, resumable manner.
 */
export class TenantProvisioningWorkflow extends WorkflowEntrypoint<Env, ProvisioningInput> {
	async run(event: WorkflowEvent<ProvisioningInput>, step: WorkflowStep): Promise<ProvisioningOutput> {
		const input = event.payload;

		// Step 1: Validate event (idempotency check)
		const validated = await step.do("validate-event", async () => {
			// TODO: Check stripe_events table for duplicate event_id
			return { valid: true, event_id: input.stripe_event_id };
		});

		if (!validated.valid) {
			throw new Error("Duplicate provisioning event");
		}

		// Step 2: Create user
		const user = await step.do("create-user", async () => {
			const userId = crypto.randomUUID();
			// TODO: Insert into users table
			return { id: userId, email: input.email };
		});

		// Step 3: Create tenant
		const tenant = await step.do("create-tenant", async () => {
			const tenantId = crypto.randomUUID();
			// TODO: Insert into tenants table
			return { id: tenantId, plan: input.plan };
		});

		// Step 4: Allocate subdomain
		const subdomain = await step.do("allocate-subdomain", async () => {
			// TODO: Generate subdomain from tenant name, create DNS record
			const emailPart = input.email.split("@")[0] ?? "tenant";
			const slug = emailPart.toLowerCase().replace(/[^a-z0-9]/g, "-");
			return `${slug}.global-claw.com`;
		});

		// Step 5: Seed templates
		await step.do("seed-templates", async () => {
			// TODO: Copy default templates from R2 to tenant folder
			return { templates_copied: 0 };
		});

		// Step 6: Initialize Durable Object
		await step.do("initialize-do", async () => {
			// TODO: Get DO stub and call /init endpoint
			return { initialized: true };
		});

		// Step 7: Activate default packs
		await step.do("activate-packs", async () => {
			// TODO: Register default MCP tools based on plan
			return { packs_activated: ["faq", "lead-capture"] };
		});

		// Step 8: Issue API key
		const apiKey = await step.do("issue-api-key", async () => {
			const key = `gc_live_${crypto.randomUUID().replace(/-/g, "")}`;
			// TODO: Hash and store in api_keys table
			return key;
		});

		// Step 9: Send notification
		await step.do("notify-user", async () => {
			// TODO: Send welcome email via notification queue
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
