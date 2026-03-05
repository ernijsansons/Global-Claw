/**
 * Test Setup Helper
 * Runs D1 migrations before tests (matches 0001-0004 migrations exactly)
 */

import { env } from "cloudflare:test";
import type { Env } from "../../src/types/env";

// Declare the test env type
declare module "cloudflare:test" {
	interface ProvidedEnv extends Env {}
}

/**
 * Run all D1 migrations for test database
 * Schema matches migrations/0001_init.sql through 0004_operational.sql
 */
export async function setupTestDatabase(): Promise<void> {
	// Migration 0001: Core tables

	// Tenants
	await env.DB.exec(
		"CREATE TABLE IF NOT EXISTS tenants (id TEXT PRIMARY KEY, name TEXT NOT NULL, subdomain TEXT UNIQUE, plan TEXT NOT NULL DEFAULT 'starter', status TEXT NOT NULL DEFAULT 'active', token_budget_daily INTEGER NOT NULL DEFAULT 100000, msg_budget_daily INTEGER NOT NULL DEFAULT 500, max_agents INTEGER NOT NULL DEFAULT 3, default_language TEXT NOT NULL DEFAULT 'en', languages_json TEXT NOT NULL DEFAULT '[\"en\"]', metadata_json TEXT DEFAULT '{}', created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')))",
	);

	// Users
	await env.DB.exec(
		"CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, name TEXT, password_hash TEXT, stripe_customer_id TEXT UNIQUE, avatar_url TEXT, locale TEXT NOT NULL DEFAULT 'en', created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')))",
	);

	// Tenant-User mapping (RBAC)
	await env.DB.exec(
		"CREATE TABLE IF NOT EXISTS tenant_users (tenant_id TEXT NOT NULL, user_id TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'member', invited_at TEXT NOT NULL DEFAULT (datetime('now')), accepted_at TEXT, PRIMARY KEY (tenant_id, user_id))",
	);

	// Subscriptions (Stripe)
	await env.DB.exec(
		"CREATE TABLE IF NOT EXISTS subscriptions (id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, stripe_subscription_id TEXT UNIQUE, stripe_price_id TEXT, status TEXT NOT NULL DEFAULT 'active', current_period_start TEXT, current_period_end TEXT, cancel_at_period_end INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')))",
	);

	// API Keys
	await env.DB.exec(
		"CREATE TABLE IF NOT EXISTS api_keys (id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, key_hash TEXT UNIQUE NOT NULL, key_prefix TEXT NOT NULL, name TEXT NOT NULL DEFAULT 'Default', scopes_json TEXT NOT NULL DEFAULT '[\"read\",\"write\"]', last_used_at TEXT, expires_at TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')))",
	);

	// Daily usage tracking
	await env.DB.exec(
		"CREATE TABLE IF NOT EXISTS usage_daily (tenant_id TEXT NOT NULL, day TEXT NOT NULL, tokens_used INTEGER NOT NULL DEFAULT 0, messages_sent INTEGER NOT NULL DEFAULT 0, tool_calls INTEGER NOT NULL DEFAULT 0, llm_cost_cents INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (tenant_id, day))",
	);

	// Migration 0002: LLM Provider tables

	// LLM Providers
	await env.DB.exec(
		"CREATE TABLE IF NOT EXISTS llm_providers (id TEXT PRIMARY KEY, name TEXT NOT NULL, slug TEXT UNIQUE NOT NULL, api_base_url TEXT NOT NULL, api_key_encrypted TEXT NOT NULL, auth_header TEXT NOT NULL DEFAULT 'Authorization', auth_prefix TEXT NOT NULL DEFAULT 'Bearer', models_json TEXT NOT NULL DEFAULT '[]', cost_per_1m_input_cents INTEGER NOT NULL DEFAULT 0, cost_per_1m_output_cents INTEGER NOT NULL DEFAULT 0, cost_tier TEXT NOT NULL DEFAULT 'standard', weight INTEGER NOT NULL DEFAULT 50, max_requests_per_min INTEGER NOT NULL DEFAULT 60, is_enabled INTEGER NOT NULL DEFAULT 1, health_score REAL NOT NULL DEFAULT 1.0, last_health_check TEXT, total_requests INTEGER NOT NULL DEFAULT 0, total_failures INTEGER NOT NULL DEFAULT 0, avg_latency_ms INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')))",
	);

	// LLM Routing Rules
	await env.DB.exec(
		"CREATE TABLE IF NOT EXISTS llm_routing_rules (id TEXT PRIMARY KEY, name TEXT NOT NULL, priority INTEGER NOT NULL DEFAULT 0, condition_json TEXT NOT NULL, routes_json TEXT NOT NULL, is_enabled INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')))",
	);

	// LLM Usage Log
	await env.DB.exec(
		"CREATE TABLE IF NOT EXISTS llm_usage_log (id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, provider_id TEXT NOT NULL, model TEXT NOT NULL, input_tokens INTEGER NOT NULL DEFAULT 0, output_tokens INTEGER NOT NULL DEFAULT 0, latency_ms INTEGER NOT NULL DEFAULT 0, cost_cents INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'success', trace_id TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')))",
	);

	// Migration 0003: Agents, Plugins, Workflows, Partners

	// Agents
	await env.DB.exec(
		"CREATE TABLE IF NOT EXISTS agents (id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, name TEXT NOT NULL, slug TEXT NOT NULL, telegram_bot_token_encrypted TEXT, telegram_bot_username TEXT, soul_md TEXT NOT NULL DEFAULT '# Agent', agents_md TEXT NOT NULL DEFAULT '# Capabilities', primary_model TEXT NOT NULL DEFAULT 'claude-sonnet-4', fallback_model TEXT, temperature REAL NOT NULL DEFAULT 0.7, max_tokens INTEGER NOT NULL DEFAULT 4096, languages_json TEXT NOT NULL DEFAULT '[\"en\"]', avatar_url TEXT, status TEXT NOT NULL DEFAULT 'active', total_messages INTEGER NOT NULL DEFAULT 0, total_conversations INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')), UNIQUE(tenant_id, slug))",
	);

	// Plugin connections
	await env.DB.exec(
		"CREATE TABLE IF NOT EXISTS plugin_connections (id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, agent_id TEXT, provider TEXT NOT NULL, display_name TEXT NOT NULL, oauth_access_token_encrypted TEXT, oauth_refresh_token_encrypted TEXT, token_expires_at TEXT, scopes_json TEXT NOT NULL DEFAULT '[]', mcp_endpoint_url TEXT, status TEXT NOT NULL DEFAULT 'connected', last_used_at TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')))",
	);

	// Workflows
	await env.DB.exec(
		"CREATE TABLE IF NOT EXISTS workflows (id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, name TEXT NOT NULL, slug TEXT NOT NULL, description TEXT, nodes_json TEXT NOT NULL DEFAULT '[]', edges_json TEXT NOT NULL DEFAULT '[]', trigger_type TEXT NOT NULL DEFAULT 'manual', trigger_config_json TEXT DEFAULT '{}', is_enabled INTEGER NOT NULL DEFAULT 1, total_runs INTEGER NOT NULL DEFAULT 0, last_run_at TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')), UNIQUE(tenant_id, slug))",
	);

	// Workflow runs
	await env.DB.exec(
		"CREATE TABLE IF NOT EXISTS workflow_runs (id TEXT PRIMARY KEY, workflow_id TEXT NOT NULL, tenant_id TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'running', trigger_data_json TEXT, result_json TEXT, started_at TEXT NOT NULL DEFAULT (datetime('now')), completed_at TEXT, duration_ms INTEGER, error_message TEXT)",
	);

	// Feature flags
	await env.DB.exec(
		"CREATE TABLE IF NOT EXISTS feature_flags (tenant_id TEXT NOT NULL, feature TEXT NOT NULL, is_enabled INTEGER NOT NULL DEFAULT 0, config_json TEXT DEFAULT '{}', PRIMARY KEY (tenant_id, feature))",
	);

	// Partners
	await env.DB.exec(
		"CREATE TABLE IF NOT EXISTS partners (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, tier TEXT NOT NULL DEFAULT 'affiliate', company_name TEXT, referral_code TEXT UNIQUE NOT NULL, commission_rate REAL NOT NULL DEFAULT 0.30, total_referrals INTEGER NOT NULL DEFAULT 0, total_earnings_cents INTEGER NOT NULL DEFAULT 0, parent_partner_id TEXT, status TEXT NOT NULL DEFAULT 'active', created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')))",
	);

	// Tenant-Partner mapping
	await env.DB.exec(
		"CREATE TABLE IF NOT EXISTS tenant_partners (tenant_id TEXT NOT NULL, partner_id TEXT NOT NULL, referred_at TEXT NOT NULL DEFAULT (datetime('now')), PRIMARY KEY (tenant_id, partner_id))",
	);

	// Migration 0004: Operational tables

	// Audit log
	await env.DB.exec(
		"CREATE TABLE IF NOT EXISTS audit_log (id TEXT PRIMARY KEY, tenant_id TEXT, actor_id TEXT, action TEXT NOT NULL, resource_type TEXT NOT NULL, resource_id TEXT, details_json TEXT DEFAULT '{}', ip_address TEXT, trace_id TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')))",
	);

	// Stripe events (idempotency)
	await env.DB.exec(
		"CREATE TABLE IF NOT EXISTS stripe_events (event_id TEXT PRIMARY KEY, event_type TEXT NOT NULL, processed_at TEXT NOT NULL DEFAULT (datetime('now')), result_json TEXT DEFAULT '{}')",
	);

	// Seed test data: LLM providers
	await env.DB.prepare(
		"INSERT OR IGNORE INTO llm_providers (id, name, slug, api_base_url, api_key_encrypted, models_json, is_enabled, cost_per_1m_input_cents, cost_per_1m_output_cents) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
	)
		.bind(
			"prov-anthropic",
			"Anthropic Claude",
			"anthropic",
			"https://api.anthropic.com/v1",
			"PLACEHOLDER_ENCRYPT_ME",
			'["claude-sonnet-4","claude-haiku-4.5","claude-opus-4"]',
			1,
			300,
			1500,
		)
		.run();

	await env.DB.prepare(
		"INSERT OR IGNORE INTO llm_providers (id, name, slug, api_base_url, api_key_encrypted, models_json, is_enabled, cost_per_1m_input_cents, cost_per_1m_output_cents) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
	)
		.bind(
			"prov-qwen",
			"Alibaba Qwen",
			"qwen",
			"https://dashscope.aliyuncs.com/compatible-mode/v1",
			"PLACEHOLDER_ENCRYPT_ME",
			'["qwen-2.5-72b-instruct","qwen-2.5-7b-instruct"]',
			1,
			27,
			110,
		)
		.run();

	await env.DB.prepare(
		"INSERT OR IGNORE INTO llm_providers (id, name, slug, api_base_url, api_key_encrypted, models_json, is_enabled, cost_per_1m_input_cents, cost_per_1m_output_cents) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
	)
		.bind(
			"prov-openai",
			"OpenAI",
			"openai",
			"https://api.openai.com/v1",
			"PLACEHOLDER_ENCRYPT_ME",
			'["gpt-4o","gpt-4o-mini"]',
			0,
			250,
			1000,
		)
		.run();
}
