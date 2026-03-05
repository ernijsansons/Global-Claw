/**
 * Global-Claw Worker Environment Bindings
 * All Cloudflare bindings defined in wrangler.jsonc
 */

/**
 * Env
 * Cloudflare Worker environment bindings.
 * Defined in wrangler.jsonc and injected at runtime.
 */
export interface Env {
	// Database
	/** D1 database binding for global-claw-primary */
	DB: D1Database;

	// Durable Objects
	/** Durable Object stub factory for TenantAgent */
	TENANT_AGENT: DurableObjectNamespace;

	// Storage
	/** R2 bucket for assets, exports, logs */
	ASSETS: R2Bucket;

	// KV (distributed cache & rate limiting)
	/** KV namespace for rate limit tracking */
	RATE_LIMIT_KV: KVNamespace;

	// Message Queues
	/** Queue producer for audit logs */
	AUDIT_QUEUE: Queue;

	/** Queue producer for notifications */
	NOTIFICATION_QUEUE: Queue;

	// AI & Workflows
	/** Cloudflare Workers AI binding */
	AI: Ai;

	/** Vectorize index binding for semantic memory search */
	MEMORY_INDEX: VectorizeIndex;

	/** Workflows binding for tenant provisioning */
	PROVISIONING_WORKFLOW: Workflow;

	// Encryption
	/** Encryption key for sensitive data (base64-encoded 32 bytes) */
	ENCRYPTION_KEY: string;

	// API Keys & Secrets
	/** Stripe API key (secret) */
	STRIPE_SECRET_KEY: string;

	/** Stripe webhook signing secret */
	STRIPE_WEBHOOK_SECRET: string;

	/** Telegram webhook verification secret (X-Telegram-Bot-Api-Secret-Token header) */
	TELEGRAM_WEBHOOK_SECRET: string;

	// NOTE: TELEGRAM_BOT_TOKEN is NOT an env var — it's per-agent, encrypted in D1 agents.telegram_bot_token_encrypted

	/** JWT signing secret (for access + refresh tokens) */
	JWT_SECRET: string;

	// OAuth integration credentials (per-provider, added as needed)
	/** Google OAuth client ID (optional) */
	GOOGLE_CLIENT_ID?: string;
	/** Google OAuth client secret */
	GOOGLE_CLIENT_SECRET?: string;
	/** Notion OAuth client ID (optional) */
	NOTION_CLIENT_ID?: string;
	/** Notion OAuth client secret */
	NOTION_CLIENT_SECRET?: string;
	/** HubSpot OAuth client ID (optional) */
	HUBSPOT_CLIENT_ID?: string;
	/** HubSpot OAuth client secret */
	HUBSPOT_CLIENT_SECRET?: string;

	// Configuration
	/** Current environment name */
	ENVIRONMENT: "development" | "staging" | "production";

	/** API base URL for this environment */
	APP_URL: string;

	/** Dashboard base URL for this environment */
	DASHBOARD_URL: string;

	/** AI Gateway slug used by the LLM executor */
	AI_GATEWAY_SLUG?: string;

	/** Cloudflare account ID for AI Gateway */
	CF_ACCOUNT_ID?: string;
}

/**
 * Queue message type for type-safe queue operations
 */
export interface QueueMessage<T = unknown> {
	body: T;
}

/**
 * Audit log queue message
 */
export interface AuditLogMessage {
	tenant_id: string;
	actor_id: string;
	actor_type: "user" | "api_key" | "system";
	action: string;
	resource_type: string;
	resource_id: string;
	details?: Record<string, unknown>;
	ip_address?: string;
	trace_id: string;
	timestamp: string;
}

/**
 * Notification queue message
 */
export interface NotificationMessage {
	tenant_id: string;
	type: "email" | "telegram" | "webhook";
	recipient: string;
	template: string;
	data: Record<string, unknown>;
	priority?: "low" | "normal" | "high";
}
