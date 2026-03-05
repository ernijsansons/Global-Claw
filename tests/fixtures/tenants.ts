/**
 * Test fixtures for tenant and user data
 */

import { createJWT } from "../../src/lib/auth/jwt";
import type { Env } from "../../src/types/env";

// Generate unique IDs for tests
function generateId(): string {
	return crypto.randomUUID();
}

/**
 * Create a test tenant in the database
 */
export async function createTestTenant(env: Env): Promise<{ id: string; name: string }> {
	const id = generateId();
	const name = `Test Tenant ${id.slice(0, 8)}`;

	await env.DB.prepare(
		`INSERT INTO tenants (id, name, status, plan, created_at, updated_at)
		 VALUES (?, ?, 'active', 'pro', datetime('now'), datetime('now'))`,
	)
		.bind(id, name)
		.run();

	return { id, name };
}

/**
 * Create a test user in the database
 */
export async function createTestUser(
	env: Env,
	tenantId: string,
	role = "owner",
): Promise<{ id: string; email: string }> {
	const id = generateId();
	const email = `test-${id.slice(0, 8)}@example.com`;

	// Create user
	await env.DB.prepare(
		`INSERT INTO users (id, email, password_hash, created_at, updated_at)
		 VALUES (?, ?, 'test-hash', datetime('now'), datetime('now'))`,
	)
		.bind(id, email)
		.run();

	// Link user to tenant
	await env.DB.prepare(
		`INSERT INTO tenant_users (tenant_id, user_id, role, created_at)
		 VALUES (?, ?, ?, datetime('now'))`,
	)
		.bind(tenantId, id, role)
		.run();

	return { id, email };
}

/**
 * Create a test agent
 */
export async function createTestAgent(
	env: Env,
	tenantId: string,
	options: {
		name?: string;
		status?: string;
		llm_provider_slug?: string;
	} = {},
): Promise<{ id: string; name: string }> {
	const id = generateId();
	const name = options.name ?? `Test Agent ${id.slice(0, 8)}`;
	const status = options.status ?? "active";
	const llmProvider = options.llm_provider_slug ?? "anthropic";

	await env.DB.prepare(
		`INSERT INTO agents (id, tenant_id, name, status, llm_provider_slug, created_at, updated_at)
		 VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
	)
		.bind(id, tenantId, name, status, llmProvider)
		.run();

	return { id, name };
}

/**
 * Generate a test JWT token
 */
export async function generateTestJwt(
	env: Env,
	payload: {
		sub: string;
		tenant_id: string;
		role: string;
	},
): Promise<string> {
	const secret = env.JWT_SECRET ?? "test-secret-key-for-testing-only";
	return createJWT(
		{
			sub: payload.sub,
			tid: payload.tenant_id,
			role: payload.role,
			type: "access",
		},
		secret,
		3600,
	); // 1 hour expiry
}

/**
 * Clean up test data
 */
export async function cleanupTestData(env: Env, tenantId: string): Promise<void> {
	// Delete in order to respect foreign keys
	// Use try-catch for each in case table doesn't exist in test env
	const tables = [
		{ table: "tenant_users", column: "tenant_id" },
		{ table: "agents", column: "tenant_id" },
		{ table: "plugin_connections", column: "tenant_id" },
		{ table: "usage_daily", column: "tenant_id" },
		{ table: "tenants", column: "id" },
	];

	for (const { table, column } of tables) {
		try {
			await env.DB.prepare(`DELETE FROM ${table} WHERE ${column} = ?`).bind(tenantId).run();
		} catch {
			// Table might not exist in test environment, ignore
		}
	}
}

/**
 * Demo data for testing dashboard views
 */
export const demoMetrics = {
	active_agents: { count: 12, change_pct: 8 },
	messages_today: {
		count: 847,
		sparkline: [10, 20, 30, 45, 60, 80, 90, 85, 70, 60, 50, 40],
	},
	uptime: { pct: 99.7, days: 30 },
	llm_cost_24h: { amount_usd: 23.4, change_pct: -12 },
};

export const demoAgents = [
	{
		id: "demo-1",
		name: "Sales Assistant LV",
		status: "online",
		llm_provider_slug: "anthropic",
		messages_hr: 42,
	},
	{
		id: "demo-2",
		name: "Support Bot EN",
		status: "online",
		llm_provider_slug: "qwen",
		messages_hr: 28,
	},
	{
		id: "demo-3",
		name: "Data Analyst",
		status: "idle",
		llm_provider_slug: "openai",
		messages_hr: 5,
	},
];
