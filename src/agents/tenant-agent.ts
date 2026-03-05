/**
 * TenantAgent Durable Object
 * Per-tenant state container using Cloudflare Agents SDK patterns
 *
 * This is a stub implementation for Phase 1.
 * Full implementation in Phase 4 will include:
 * - SQLite state for conversations, memory, configs
 * - MCP tool registration for packs
 * - Resumable streaming support
 * - Budget enforcement before LLM calls
 * - keepAlive() for long workflows
 */

import type { Env } from "../types/env";

/**
 * TenantAgent Durable Object
 * Each tenant gets its own instance for isolation.
 */
export class TenantAgent implements DurableObject {
	private state: DurableObjectState;
	private env: Env;
	private sql: SqlStorage;
	private initialized = false;

	constructor(state: DurableObjectState, env: Env) {
		this.state = state;
		this.env = env;
		this.sql = state.storage.sql;
	}

	/**
	 * Initialize SQLite tables if not already done
	 */
	private async ensureInitialized(): Promise<void> {
		if (this.initialized) return;

		// Create tables for tenant state
		this.sql.exec(`
			CREATE TABLE IF NOT EXISTS conversations (
				id TEXT PRIMARY KEY,
				user_id TEXT NOT NULL,
				agent_id TEXT NOT NULL,
				message_count INTEGER DEFAULT 0,
				first_message_at TEXT NOT NULL,
				last_message_at TEXT NOT NULL,
				status TEXT DEFAULT 'active'
			);

			CREATE TABLE IF NOT EXISTS conversation_messages (
				id TEXT PRIMARY KEY,
				conversation_id TEXT NOT NULL,
				role TEXT NOT NULL,
				content TEXT NOT NULL,
				tokens INTEGER DEFAULT 0,
				created_at TEXT NOT NULL,
				tool_name TEXT,
				tool_input TEXT,
				tool_result TEXT
			);

			CREATE TABLE IF NOT EXISTS memory_facts (
				id TEXT PRIMARY KEY,
				entity TEXT NOT NULL,
				type TEXT NOT NULL,
				content TEXT NOT NULL,
				confidence REAL DEFAULT 1.0,
				usage_count INTEGER DEFAULT 0,
				last_used_at TEXT,
				learned_at TEXT NOT NULL,
				source TEXT
			);

			CREATE TABLE IF NOT EXISTS budget_usage (
				date TEXT PRIMARY KEY,
				tokens_used INTEGER DEFAULT 0,
				messages_sent INTEGER DEFAULT 0
			);

			CREATE INDEX IF NOT EXISTS idx_conv_user ON conversations(user_id);
			CREATE INDEX IF NOT EXISTS idx_conv_agent ON conversations(agent_id);
			CREATE INDEX IF NOT EXISTS idx_msg_conv ON conversation_messages(conversation_id);
			CREATE INDEX IF NOT EXISTS idx_facts_entity ON memory_facts(entity);
		`);

		this.initialized = true;
	}

	/**
	 * Handle incoming HTTP requests to the Durable Object
	 */
	async fetch(request: Request): Promise<Response> {
		await this.ensureInitialized();

		const url = new URL(request.url);
		const path = url.pathname;

		try {
			// Health check
			if (path === "/health" && request.method === "GET") {
				return this.handleHealth();
			}

			// Get tenant state
			if (path === "/state" && request.method === "GET") {
				return this.handleGetState();
			}

			// Handle message (placeholder for Phase 4)
			if (path === "/message" && request.method === "POST") {
				return this.handleMessage(request);
			}

			return new Response(JSON.stringify({ error: "Not found" }), {
				status: 404,
				headers: { "Content-Type": "application/json" },
			});
		} catch (error) {
			console.error("TenantAgent error:", error);
			return new Response(
				JSON.stringify({
					error: error instanceof Error ? error.message : "Internal error",
				}),
				{
					status: 500,
					headers: { "Content-Type": "application/json" },
				},
			);
		}
	}

	/**
	 * Health check endpoint
	 */
	private handleHealth(): Response {
		return new Response(
			JSON.stringify({
				status: "ok",
				initialized: this.initialized,
				timestamp: new Date().toISOString(),
			}),
			{
				status: 200,
				headers: { "Content-Type": "application/json" },
			},
		);
	}

	/**
	 * Get current state summary
	 */
	private handleGetState(): Response {
		const conversationCount =
			this.sql.exec<{ count: number }>("SELECT COUNT(*) as count FROM conversations").toArray()[0]?.count ?? 0;

		const messageCount =
			this.sql.exec<{ count: number }>("SELECT COUNT(*) as count FROM conversation_messages").toArray()[0]?.count ?? 0;

		const factCount =
			this.sql.exec<{ count: number }>("SELECT COUNT(*) as count FROM memory_facts").toArray()[0]?.count ?? 0;

		return new Response(
			JSON.stringify({
				conversations: conversationCount,
				messages: messageCount,
				facts: factCount,
				timestamp: new Date().toISOString(),
			}),
			{
				status: 200,
				headers: { "Content-Type": "application/json" },
			},
		);
	}

	/**
	 * Handle incoming message (placeholder)
	 */
	private async handleMessage(request: Request): Promise<Response> {
		const body = await request.json();

		// TODO: Phase 4 - Full implementation with:
		// - LLM routing via executor.ts
		// - MCP tool dispatch
		// - Memory persistence
		// - Streaming response

		return new Response(
			JSON.stringify({
				status: "received",
				message: "Message handling not yet implemented",
				input: body,
			}),
			{
				status: 200,
				headers: { "Content-Type": "application/json" },
			},
		);
	}
}
