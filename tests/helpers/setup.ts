/**
 * Test Setup Helper
 * Runs D1 migrations before tests
 */

import { env } from "cloudflare:test";
import type { Env } from "../../src/types/env";

// Declare the test env type
declare module "cloudflare:test" {
	interface ProvidedEnv extends Env {}
}

/**
 * Run all D1 migrations for test database
 */
export async function setupTestDatabase(): Promise<void> {
	// Create tenants table (from 0001_init.sql)
	await env.DB.exec(
		"CREATE TABLE IF NOT EXISTS tenants (id TEXT PRIMARY KEY, name TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'active', plan TEXT NOT NULL DEFAULT 'starter', subdomain TEXT UNIQUE, token_budget_daily INTEGER DEFAULT 100000, msg_budget_daily INTEGER DEFAULT 1000, settings_json TEXT DEFAULT '{}', created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')))",
	);

	// Create users table
	await env.DB.exec(
		"CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, password_hash TEXT, stripe_customer_id TEXT UNIQUE, created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')))",
	);

	// Create tenant_users junction table
	await env.DB.exec(
		"CREATE TABLE IF NOT EXISTS tenant_users (tenant_id TEXT NOT NULL, user_id TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'member', created_at TEXT NOT NULL DEFAULT (datetime('now')), PRIMARY KEY (tenant_id, user_id))",
	);

	// Create agents table (from 0003_agents_memory.sql)
	await env.DB.exec(
		"CREATE TABLE IF NOT EXISTS agents (id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, name TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'active', system_prompt TEXT, telegram_bot_token_encrypted TEXT, telegram_webhook_url TEXT, model_config_json TEXT DEFAULT '{}', soul_md TEXT, agents_md TEXT, avatar_r2_key TEXT, languages_json TEXT DEFAULT '[\"en\"]', created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')))",
	);

	// Create LLM providers table (from 0002_llm_providers.sql)
	await env.DB.exec(
		"CREATE TABLE IF NOT EXISTS llm_providers (id TEXT PRIMARY KEY, name TEXT NOT NULL, slug TEXT NOT NULL UNIQUE, api_base_url TEXT NOT NULL, api_key_encrypted TEXT, models_json TEXT NOT NULL DEFAULT '[]', cost_per_1m_input_cents INTEGER DEFAULT 0, cost_per_1m_output_cents INTEGER DEFAULT 0, cost_tier TEXT DEFAULT 'standard', weight INTEGER DEFAULT 50, max_requests_per_min INTEGER DEFAULT 60, is_enabled INTEGER DEFAULT 0, created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')))",
	);

	// Create LLM routing rules table
	await env.DB.exec(
		"CREATE TABLE IF NOT EXISTS llm_routing_rules (id TEXT PRIMARY KEY, name TEXT NOT NULL, priority INTEGER DEFAULT 0, condition_json TEXT NOT NULL DEFAULT '{}', routes_json TEXT NOT NULL DEFAULT '[]', is_enabled INTEGER DEFAULT 1, created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')))",
	);

	// Create api_keys table
	await env.DB.exec(
		"CREATE TABLE IF NOT EXISTS api_keys (id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, name TEXT NOT NULL, key_hash TEXT NOT NULL UNIQUE, scopes_json TEXT DEFAULT '[]', last_used_at TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')))",
	);
}
