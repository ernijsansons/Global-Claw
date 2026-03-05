/**
 * TenantAgent Durable Object
 * Per-tenant state container with LLM integration
 *
 * Features:
 * - SQLite state for conversations, memory, configs
 * - Budget enforcement before LLM calls
 * - MCP tool registration for packs
 * - Streaming response support
 * - Conversation context management
 */

import type { Agent, BudgetInfo, LLMMessage, LLMRequest, LLMResponse, LLMStreamChunk, LLMTool, Tenant } from "../types";
import type { Env } from "../types/env";

// ============================================================================
// Types
// ============================================================================

/**
 * Message request to the TenantAgent
 */
export interface MessageRequest {
	agent_id: string;
	user_id: string;
	conversation_id?: string;
	content: string;
	language?: string;
	tools?: string[];
	stream?: boolean;
}

/**
 * Message response from the TenantAgent
 */
export interface MessageResponse {
	conversation_id: string;
	message_id: string;
	content: string;
	tool_calls?: Array<{ id: string; name: string; input: Record<string, unknown> }>;
	usage: {
		input_tokens: number;
		output_tokens: number;
	};
	latency_ms: number;
}

/**
 * Conversation record
 */
interface Conversation {
	[key: string]: SqlStorageValue;
	id: string;
	user_id: string;
	agent_id: string;
	message_count: number;
	first_message_at: string;
	last_message_at: string;
	status: string;
}

/**
 * Conversation message record
 */
interface ConversationMessage {
	[key: string]: SqlStorageValue;
	id: string;
	conversation_id: string;
	role: string;
	content: string;
	tokens: number;
	created_at: string;
	tool_name: string | null;
	tool_input: string | null;
	tool_result: string | null;
}

/**
 * Memory fact record
 */
interface MemoryFact {
	[key: string]: SqlStorageValue;
	id: string;
	entity: string;
	type: string;
	content: string;
	confidence: number;
	usage_count: number;
	last_used_at: string | null;
	learned_at: string;
	source: string | null;
}

/**
 * Registered MCP tool
 */
interface RegisteredTool {
	name: string;
	description: string;
	input_schema: LLMTool["input_schema"];
	handler: (input: Record<string, unknown>) => Promise<string>;
}

// ============================================================================
// TenantAgent Durable Object
// ============================================================================

/**
 * TenantAgent Durable Object
 * Each tenant gets its own instance for isolation.
 */
export class TenantAgent implements DurableObject {
	private state: DurableObjectState;
	private env: Env;
	private sql: SqlStorage;
	private initialized = false;

	// Cached tenant and agent data
	private tenantId: string | null = null;
	private tenant: Tenant | null = null;
	private agents: Map<string, Agent> = new Map();

	// Registered MCP tools
	private tools: Map<string, RegisteredTool> = new Map();

	// Budget tracking
	private budgetCache: BudgetInfo | null = null;
	private budgetCacheTime = 0;
	private readonly BUDGET_CACHE_TTL = 60000; // 1 minute

	constructor(state: DurableObjectState, env: Env) {
		this.state = state;
		this.env = env;
		this.sql = state.storage.sql;
	}

	// ========================================================================
	// Initialization
	// ========================================================================

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
				messages_sent INTEGER DEFAULT 0,
				cost_cents INTEGER DEFAULT 0
			);

			CREATE TABLE IF NOT EXISTS agent_configs (
				agent_id TEXT PRIMARY KEY,
				config_json TEXT NOT NULL,
				updated_at TEXT NOT NULL
			);

			CREATE INDEX IF NOT EXISTS idx_conv_user ON conversations(user_id);
			CREATE INDEX IF NOT EXISTS idx_conv_agent ON conversations(agent_id);
			CREATE INDEX IF NOT EXISTS idx_conv_status ON conversations(status);
			CREATE INDEX IF NOT EXISTS idx_msg_conv ON conversation_messages(conversation_id);
			CREATE INDEX IF NOT EXISTS idx_msg_created ON conversation_messages(created_at);
			CREATE INDEX IF NOT EXISTS idx_facts_entity ON memory_facts(entity);
			CREATE INDEX IF NOT EXISTS idx_facts_type ON memory_facts(type);
		`);

		// Register built-in tools
		this.registerBuiltInTools();

		this.initialized = true;
	}

	/**
	 * Set the tenant ID for this DO instance
	 */
	async setTenantId(tenantId: string): Promise<void> {
		this.tenantId = tenantId;
		await this.state.storage.put("tenant_id", tenantId);

		// Load tenant data from D1
		await this.loadTenantData();
	}

	/**
	 * Load tenant data from D1
	 */
	private async loadTenantData(): Promise<void> {
		if (!this.tenantId) return;

		// Load tenant
		const tenant = await this.env.DB.prepare("SELECT * FROM tenants WHERE id = ?").bind(this.tenantId).first<Tenant>();

		if (tenant) {
			this.tenant = tenant;
		}

		// Load agents
		const agents = await this.env.DB.prepare("SELECT * FROM agents WHERE tenant_id = ? AND status != 'deleted'")
			.bind(this.tenantId)
			.all<Agent>();

		this.agents.clear();
		for (const agent of agents.results ?? []) {
			this.agents.set(agent.id, agent);
		}
	}

	// ========================================================================
	// HTTP Request Handler
	// ========================================================================

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

			// Set tenant ID (called during provisioning)
			if (path === "/init" && request.method === "POST") {
				return this.handleInit(request);
			}

			// Get tenant state summary
			if (path === "/state" && request.method === "GET") {
				return this.handleGetState();
			}

			// Get budget info
			if (path === "/budget" && request.method === "GET") {
				return this.handleGetBudget();
			}

			// Handle message
			if (path === "/message" && request.method === "POST") {
				return this.handleMessage(request);
			}

			// Handle streaming message
			if (path === "/message/stream" && request.method === "POST") {
				return this.handleMessageStream(request);
			}

			// Get conversation history
			if (path.startsWith("/conversations/") && request.method === "GET") {
				const conversationId = path.split("/")[2];
				return this.handleGetConversation(conversationId ?? "");
			}

			// List conversations
			if (path === "/conversations" && request.method === "GET") {
				return this.handleListConversations(url.searchParams);
			}

			// Memory operations
			if (path === "/memory" && request.method === "GET") {
				return this.handleSearchMemory(url.searchParams);
			}

			if (path === "/memory" && request.method === "POST") {
				return this.handleAddMemory(request);
			}

			// Register tool
			if (path === "/tools" && request.method === "POST") {
				return this.handleRegisterTool(request);
			}

			// List tools
			if (path === "/tools" && request.method === "GET") {
				return this.handleListTools();
			}

			// Reload tenant data
			if (path === "/reload" && request.method === "POST") {
				await this.loadTenantData();
				return this.jsonResponse({ success: true });
			}

			return this.jsonResponse({ error: "Not found" }, 404);
		} catch (error) {
			console.error("TenantAgent error:", error);
			return this.jsonResponse(
				{
					error: error instanceof Error ? error.message : "Internal error",
				},
				500,
			);
		}
	}

	// ========================================================================
	// Handler Methods
	// ========================================================================

	/**
	 * Health check endpoint
	 */
	private handleHealth(): Response {
		return this.jsonResponse({
			status: "ok",
			initialized: this.initialized,
			tenant_id: this.tenantId,
			agents_loaded: this.agents.size,
			tools_registered: this.tools.size,
			timestamp: new Date().toISOString(),
		});
	}

	/**
	 * Initialize with tenant ID
	 */
	private async handleInit(request: Request): Promise<Response> {
		const body = (await request.json()) as { tenant_id: string };

		if (!body.tenant_id) {
			return this.jsonResponse({ error: "tenant_id required" }, 400);
		}

		await this.setTenantId(body.tenant_id);

		return this.jsonResponse({
			success: true,
			tenant_id: this.tenantId,
			agents: Array.from(this.agents.keys()),
		});
	}

	/**
	 * Get current state summary
	 */
	private handleGetState(): Response {
		const conversationCount =
			this.sql
				.exec<{ count: number }>("SELECT COUNT(*) as count FROM conversations WHERE status = 'active'")
				.toArray()[0]?.count ?? 0;

		const messageCount =
			this.sql.exec<{ count: number }>("SELECT COUNT(*) as count FROM conversation_messages").toArray()[0]?.count ?? 0;

		const factCount =
			this.sql.exec<{ count: number }>("SELECT COUNT(*) as count FROM memory_facts").toArray()[0]?.count ?? 0;

		// Get today's usage
		const today = new Date().toISOString().split("T")[0];
		const todayUsage = this.sql
			.exec<{ tokens_used: number; messages_sent: number; cost_cents: number }>(
				"SELECT tokens_used, messages_sent, cost_cents FROM budget_usage WHERE date = ?",
				[today],
			)
			.toArray()[0];

		return this.jsonResponse({
			tenant_id: this.tenantId,
			tenant_name: this.tenant?.name,
			plan: this.tenant?.plan,
			agents: Array.from(this.agents.values()).map((a) => ({
				id: a.id,
				name: a.name,
				status: a.status,
			})),
			conversations: conversationCount,
			messages: messageCount,
			facts: factCount,
			tools: this.tools.size,
			today_usage: {
				tokens: todayUsage?.tokens_used ?? 0,
				messages: todayUsage?.messages_sent ?? 0,
				cost_cents: todayUsage?.cost_cents ?? 0,
			},
			timestamp: new Date().toISOString(),
		});
	}

	/**
	 * Get budget information
	 */
	private async handleGetBudget(): Promise<Response> {
		const budget = await this.getBudgetInfo();
		return this.jsonResponse(budget);
	}

	/**
	 * Handle incoming message (non-streaming)
	 */
	private async handleMessage(request: Request): Promise<Response> {
		const body = (await request.json()) as MessageRequest;

		// Validate request
		if (!body.agent_id || !body.user_id || !body.content) {
			return this.jsonResponse({ error: "agent_id, user_id, and content required" }, 400);
		}

		// Check budget
		const budget = await this.getBudgetInfo();
		if (budget.tokens_remaining <= 0) {
			return this.jsonResponse(
				{
					error: "Token budget exceeded",
					code: "BUDGET_EXCEEDED",
					budget,
				},
				429,
			);
		}

		if (budget.messages_remaining <= 0) {
			return this.jsonResponse(
				{
					error: "Message budget exceeded",
					code: "BUDGET_EXCEEDED",
					budget,
				},
				429,
			);
		}

		// Get or create conversation
		const conversationId = body.conversation_id ?? crypto.randomUUID();
		// Ensure conversation exists (creates if needed)
		await this.getOrCreateConversation(conversationId, body.user_id, body.agent_id);

		// Get agent
		const agent = this.agents.get(body.agent_id);
		if (!agent) {
			return this.jsonResponse({ error: "Agent not found" }, 404);
		}

		// Build message history
		const messages = await this.buildMessageHistory(conversationId, agent, body.content);

		// Get available tools
		const tools = this.getToolsForRequest(body.tools);

		// Create LLM request
		const llmRequest: LLMRequest = {
			trace_id: crypto.randomUUID(),
			tenant_id: this.tenantId ?? "",
			messages,
			task_type: "chat",
			model: agent.primary_model,
			temperature: agent.temperature,
			max_tokens: agent.max_tokens,
			tools: tools.length > 0 ? tools : undefined,
			context: {
				language: body.language ?? this.tenant?.default_language,
				user_id: body.user_id,
				agent_id: body.agent_id,
				token_budget_remaining: budget.tokens_remaining,
			},
			allow_fallback: true,
		};

		// Execute LLM call
		const { createExecutor } = await import("../lib/llm/executor");
		const executor = createExecutor(this.env);
		const response = await executor.execute(llmRequest);

		// Process tool calls if any
		let finalContent = response.content;
		if (response.tool_calls && response.tool_calls.length > 0) {
			finalContent = await this.processToolCalls(response, messages, llmRequest, executor);
		}

		// Save messages to conversation
		const userMessageId = crypto.randomUUID();
		const assistantMessageId = crypto.randomUUID();
		const now = new Date().toISOString();

		this.sql.exec(
			`INSERT INTO conversation_messages (id, conversation_id, role, content, tokens, created_at)
			 VALUES (?, ?, 'user', ?, 0, ?)`,
			[userMessageId, conversationId, body.content, now],
		);

		this.sql.exec(
			`INSERT INTO conversation_messages (id, conversation_id, role, content, tokens, created_at)
			 VALUES (?, ?, 'assistant', ?, ?, ?)`,
			[assistantMessageId, conversationId, finalContent, response.usage.output_tokens, now],
		);

		// Update conversation
		this.sql.exec("UPDATE conversations SET message_count = message_count + 2, last_message_at = ? WHERE id = ?", [
			now,
			conversationId,
		]);

		// Update budget usage
		await this.recordUsage(response.usage.input_tokens + response.usage.output_tokens, 1, response.cost_cents);

		// Invalidate budget cache
		this.budgetCache = null;

		return this.jsonResponse({
			conversation_id: conversationId,
			message_id: assistantMessageId,
			content: finalContent,
			tool_calls: response.tool_calls,
			usage: response.usage,
			latency_ms: response.latency_ms,
		});
	}

	/**
	 * Handle streaming message
	 */
	private async handleMessageStream(request: Request): Promise<Response> {
		const body = (await request.json()) as MessageRequest;

		// Validate request
		if (!body.agent_id || !body.user_id || !body.content) {
			return this.jsonResponse({ error: "agent_id, user_id, and content required" }, 400);
		}

		// Check budget
		const budget = await this.getBudgetInfo();
		if (budget.tokens_remaining <= 0 || budget.messages_remaining <= 0) {
			return this.jsonResponse({ error: "Budget exceeded", code: "BUDGET_EXCEEDED" }, 429);
		}

		// Get or create conversation
		const conversationId = body.conversation_id ?? crypto.randomUUID();
		await this.getOrCreateConversation(conversationId, body.user_id, body.agent_id);

		// Get agent
		const agent = this.agents.get(body.agent_id);
		if (!agent) {
			return this.jsonResponse({ error: "Agent not found" }, 404);
		}

		// Build message history
		const messages = await this.buildMessageHistory(conversationId, agent, body.content);

		// Create LLM request
		const llmRequest: LLMRequest = {
			trace_id: crypto.randomUUID(),
			tenant_id: this.tenantId ?? "",
			messages,
			task_type: "chat",
			model: agent.primary_model,
			temperature: agent.temperature,
			max_tokens: agent.max_tokens,
			context: {
				language: body.language ?? this.tenant?.default_language,
				user_id: body.user_id,
				agent_id: body.agent_id,
			},
		};

		// Create streaming response
		const encoder = new TextEncoder();
		const { createExecutor } = await import("../lib/llm/executor");
		const executor = createExecutor(this.env);

		const stream = new ReadableStream({
			start: async (controller) => {
				try {
					let fullContent = "";
					let metrics: LLMStreamChunk | null = null;

					// Send conversation ID first
					controller.enqueue(
						encoder.encode(`data: ${JSON.stringify({ type: "start", conversation_id: conversationId })}\n\n`),
					);

					for await (const chunk of executor.executeStream(llmRequest)) {
						if (chunk.type === "content") {
							fullContent += chunk.content;
							controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
						} else if (chunk.type === "done") {
							metrics = chunk;
							controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
						} else if (chunk.type === "error") {
							controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
						}
					}

					// Save messages
					const now = new Date().toISOString();
					const userMessageId = crypto.randomUUID();
					const assistantMessageId = crypto.randomUUID();

					this.sql.exec(
						`INSERT INTO conversation_messages (id, conversation_id, role, content, tokens, created_at)
						 VALUES (?, ?, 'user', ?, 0, ?)`,
						[userMessageId, conversationId, body.content, now],
					);

					this.sql.exec(
						`INSERT INTO conversation_messages (id, conversation_id, role, content, tokens, created_at)
						 VALUES (?, ?, 'assistant', ?, ?, ?)`,
						[assistantMessageId, conversationId, fullContent, metrics?.metrics?.output_tokens ?? 0, now],
					);

					this.sql.exec(
						"UPDATE conversations SET message_count = message_count + 2, last_message_at = ? WHERE id = ?",
						[now, conversationId],
					);

					// Update budget
					if (metrics?.type === "done" && metrics.metrics) {
						await this.recordUsage(
							metrics.metrics.input_tokens + metrics.metrics.output_tokens,
							1,
							Math.round(metrics.metrics.cost_usd * 100),
						);
					}

					controller.close();
				} catch (error) {
					const errorMessage = error instanceof Error ? error.message : "Stream error";
					controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "error", error: errorMessage })}\n\n`));
					controller.close();
				}
			},
		});

		return new Response(stream, {
			headers: {
				"Content-Type": "text/event-stream",
				"Cache-Control": "no-cache",
				Connection: "keep-alive",
			},
		});
	}

	/**
	 * Get conversation history
	 */
	private handleGetConversation(conversationId: string): Response {
		const conversation = this.sql
			.exec<Conversation>("SELECT * FROM conversations WHERE id = ?", [conversationId])
			.toArray()[0];

		if (!conversation) {
			return this.jsonResponse({ error: "Conversation not found" }, 404);
		}

		const messages = this.sql
			.exec<ConversationMessage>(
				"SELECT * FROM conversation_messages WHERE conversation_id = ? ORDER BY created_at ASC",
				[conversationId],
			)
			.toArray();

		return this.jsonResponse({
			conversation,
			messages,
		});
	}

	/**
	 * List conversations
	 */
	private handleListConversations(params: URLSearchParams): Response {
		const agentId = params.get("agent_id");
		const userId = params.get("user_id");
		const status = params.get("status") ?? "active";
		const limit = Math.min(Number.parseInt(params.get("limit") ?? "50"), 100);
		const offset = Number.parseInt(params.get("offset") ?? "0");

		let query = "SELECT * FROM conversations WHERE status = ?";
		const queryParams: unknown[] = [status];

		if (agentId) {
			query += " AND agent_id = ?";
			queryParams.push(agentId);
		}

		if (userId) {
			query += " AND user_id = ?";
			queryParams.push(userId);
		}

		query += " ORDER BY last_message_at DESC LIMIT ? OFFSET ?";
		queryParams.push(limit, offset);

		const conversations = this.sql.exec<Conversation>(query, queryParams).toArray();

		return this.jsonResponse({
			conversations,
			limit,
			offset,
		});
	}

	/**
	 * Search memory facts
	 */
	private handleSearchMemory(params: URLSearchParams): Response {
		const query = params.get("q");
		const entity = params.get("entity");
		const type = params.get("type");
		const limit = Math.min(Number.parseInt(params.get("limit") ?? "50"), 100);

		let sql = "SELECT * FROM memory_facts WHERE 1=1";
		const sqlParams: unknown[] = [];

		if (query) {
			sql += " AND content LIKE ?";
			sqlParams.push(`%${query}%`);
		}

		if (entity) {
			sql += " AND entity = ?";
			sqlParams.push(entity);
		}

		if (type) {
			sql += " AND type = ?";
			sqlParams.push(type);
		}

		sql += " ORDER BY usage_count DESC, learned_at DESC LIMIT ?";
		sqlParams.push(limit);

		const facts = this.sql.exec<MemoryFact>(sql, sqlParams).toArray();

		return this.jsonResponse({ facts });
	}

	/**
	 * Add memory fact
	 */
	private async handleAddMemory(request: Request): Promise<Response> {
		const body = (await request.json()) as {
			entity: string;
			type: string;
			content: string;
			confidence?: number;
			source?: string;
		};

		if (!body.entity || !body.type || !body.content) {
			return this.jsonResponse({ error: "entity, type, and content required" }, 400);
		}

		const id = crypto.randomUUID();
		const now = new Date().toISOString();

		this.sql.exec(
			`INSERT INTO memory_facts (id, entity, type, content, confidence, usage_count, learned_at, source)
			 VALUES (?, ?, ?, ?, ?, 0, ?, ?)`,
			[id, body.entity, body.type, body.content, body.confidence ?? 1.0, now, body.source ?? null],
		);

		return this.jsonResponse({ id, success: true });
	}

	/**
	 * Register a tool
	 */
	private async handleRegisterTool(request: Request): Promise<Response> {
		const body = (await request.json()) as {
			name: string;
			description: string;
			input_schema: LLMTool["input_schema"];
		};

		if (!body.name || !body.description || !body.input_schema) {
			return this.jsonResponse({ error: "name, description, and input_schema required" }, 400);
		}

		// Register tool (handler will be a no-op for external tools)
		this.tools.set(body.name, {
			name: body.name,
			description: body.description,
			input_schema: body.input_schema,
			handler: async () => "Tool executed via external handler",
		});

		return this.jsonResponse({ success: true, tool: body.name });
	}

	/**
	 * List registered tools
	 */
	private handleListTools(): Response {
		const tools = Array.from(this.tools.values()).map((t) => ({
			name: t.name,
			description: t.description,
			input_schema: t.input_schema,
		}));

		return this.jsonResponse({ tools });
	}

	// ========================================================================
	// Helper Methods
	// ========================================================================

	/**
	 * Get or create a conversation
	 */
	private async getOrCreateConversation(
		conversationId: string,
		userId: string,
		agentId: string,
	): Promise<Conversation> {
		let conversation = this.sql
			.exec<Conversation>("SELECT * FROM conversations WHERE id = ?", [conversationId])
			.toArray()[0];

		if (!conversation) {
			const now = new Date().toISOString();
			this.sql.exec(
				`INSERT INTO conversations (id, user_id, agent_id, message_count, first_message_at, last_message_at, status)
				 VALUES (?, ?, ?, 0, ?, ?, 'active')`,
				[conversationId, userId, agentId, now, now],
			);

			conversation = {
				id: conversationId,
				user_id: userId,
				agent_id: agentId,
				message_count: 0,
				first_message_at: now,
				last_message_at: now,
				status: "active",
			};
		}

		return conversation;
	}

	/**
	 * Build message history for LLM request
	 */
	private async buildMessageHistory(
		conversationId: string,
		agent: Agent,
		currentMessage: string,
	): Promise<LLMMessage[]> {
		const messages: LLMMessage[] = [];

		// Add system message from agent's soul_md
		if (agent.soul_md) {
			messages.push({
				role: "system",
				content: agent.soul_md,
			});
		}

		// Add relevant memory facts as system context
		const relevantFacts = await this.getRelevantFacts(currentMessage);
		if (relevantFacts.length > 0) {
			const factsContext = relevantFacts.map((f) => `[${f.type}] ${f.entity}: ${f.content}`).join("\n");

			messages.push({
				role: "system",
				content: `Relevant knowledge:\n${factsContext}`,
			});
		}

		// Load recent conversation history (last 20 messages)
		const history = this.sql
			.exec<ConversationMessage>(
				`SELECT * FROM conversation_messages
				 WHERE conversation_id = ?
				 ORDER BY created_at DESC
				 LIMIT 20`,
				[conversationId],
			)
			.toArray()
			.reverse();

		for (const msg of history) {
			messages.push({
				role: msg.role as "user" | "assistant" | "system" | "tool",
				content: msg.content,
				tool_use_id: msg.tool_name ? (msg.tool_result ?? undefined) : undefined,
			});
		}

		// Add current user message
		messages.push({
			role: "user",
			content: currentMessage,
		});

		return messages;
	}

	/**
	 * Get relevant memory facts for a message
	 */
	private async getRelevantFacts(message: string): Promise<MemoryFact[]> {
		// Simple keyword extraction (could be enhanced with embeddings)
		const words = message
			.toLowerCase()
			.split(/\s+/)
			.filter((w) => w.length > 3);

		if (words.length === 0) return [];

		// Search for facts containing any of the keywords
		const conditions = words.map(() => "content LIKE ?").join(" OR ");
		const params = words.map((w) => `%${w}%`);

		const facts = this.sql
			.exec<MemoryFact>(
				`SELECT * FROM memory_facts
				 WHERE ${conditions}
				 ORDER BY confidence DESC, usage_count DESC
				 LIMIT 5`,
				params,
			)
			.toArray();

		// Update usage counts
		for (const fact of facts) {
			this.sql.exec("UPDATE memory_facts SET usage_count = usage_count + 1, last_used_at = ? WHERE id = ?", [
				new Date().toISOString(),
				fact.id,
			]);
		}

		return facts;
	}

	/**
	 * Get tools for a request
	 */
	private getToolsForRequest(requestedTools?: string[]): LLMTool[] {
		if (!requestedTools || requestedTools.length === 0) {
			// Return all tools
			return Array.from(this.tools.values()).map((t) => ({
				name: t.name,
				description: t.description,
				input_schema: t.input_schema,
			}));
		}

		// Return only requested tools
		return requestedTools
			.map((name) => this.tools.get(name))
			.filter((t): t is RegisteredTool => t !== undefined)
			.map((t) => ({
				name: t.name,
				description: t.description,
				input_schema: t.input_schema,
			}));
	}

	/**
	 * Process tool calls from LLM response
	 */
	private async processToolCalls(
		response: LLMResponse,
		messages: LLMMessage[],
		originalRequest: LLMRequest,
		executor: { execute: (req: LLMRequest) => Promise<LLMResponse> },
	): Promise<string> {
		if (!response.tool_calls || response.tool_calls.length === 0) {
			return response.content;
		}

		// Add assistant message with tool calls
		messages.push({
			role: "assistant",
			content: response.content || "",
		});

		// Process each tool call
		for (const toolCall of response.tool_calls) {
			const tool = this.tools.get(toolCall.name);
			let result: string;

			if (tool) {
				try {
					result = await tool.handler(toolCall.input);
				} catch (error) {
					result = `Error: ${error instanceof Error ? error.message : "Tool execution failed"}`;
				}
			} else {
				result = `Error: Unknown tool "${toolCall.name}"`;
			}

			// Add tool result message
			messages.push({
				role: "tool",
				content: result,
				tool_use_id: toolCall.id,
			});
		}

		// Make follow-up LLM call with tool results
		const followUpRequest: LLMRequest = {
			...originalRequest,
			trace_id: crypto.randomUUID(),
			messages,
		};

		const followUpResponse = await executor.execute(followUpRequest);

		// Recursively process if there are more tool calls (up to 5 iterations)
		if (followUpResponse.tool_calls && followUpResponse.tool_calls.length > 0) {
			// Prevent infinite loops
			const toolCallDepth = messages.filter((m) => m.role === "tool").length;
			if (toolCallDepth < 5) {
				return this.processToolCalls(followUpResponse, messages, originalRequest, executor);
			}
		}

		return followUpResponse.content;
	}

	/**
	 * Get budget information
	 */
	private async getBudgetInfo(): Promise<BudgetInfo> {
		// Return cached budget if still valid
		if (this.budgetCache && Date.now() - this.budgetCacheTime < this.BUDGET_CACHE_TTL) {
			return this.budgetCache;
		}

		const today = new Date().toISOString().split("T")[0];

		// Get today's usage
		const todayUsage = this.sql
			.exec<{ tokens_used: number; messages_sent: number; cost_cents: number }>(
				"SELECT tokens_used, messages_sent, cost_cents FROM budget_usage WHERE date = ?",
				[today],
			)
			.toArray()[0];

		const tokensUsed = todayUsage?.tokens_used ?? 0;
		const messagesSent = todayUsage?.messages_sent ?? 0;
		const costCents = todayUsage?.cost_cents ?? 0;

		const tokensBudget = this.tenant?.token_budget_daily ?? 100000;
		const messagesBudget = this.tenant?.msg_budget_daily ?? 1000;

		const budget: BudgetInfo = {
			tokens_used_today: tokensUsed,
			tokens_budget_daily: tokensBudget,
			tokens_remaining: Math.max(0, tokensBudget - tokensUsed),
			messages_sent_today: messagesSent,
			messages_budget_daily: messagesBudget,
			messages_remaining: Math.max(0, messagesBudget - messagesSent),
			cost_today_cents: costCents,
			cost_warning_threshold_cents: 1000, // $10 warning threshold
			usage_percentage: Math.round((tokensUsed / tokensBudget) * 100),
		};

		// Cache the result
		this.budgetCache = budget;
		this.budgetCacheTime = Date.now();

		return budget;
	}

	/**
	 * Record usage
	 */
	private async recordUsage(tokens: number, messages: number, costCents: number): Promise<void> {
		const today = new Date().toISOString().split("T")[0];

		this.sql.exec(
			`INSERT INTO budget_usage (date, tokens_used, messages_sent, cost_cents)
			 VALUES (?, ?, ?, ?)
			 ON CONFLICT(date) DO UPDATE SET
			   tokens_used = tokens_used + excluded.tokens_used,
			   messages_sent = messages_sent + excluded.messages_sent,
			   cost_cents = cost_cents + excluded.cost_cents`,
			[today, tokens, messages, costCents],
		);

		// Also update D1 usage_daily table
		try {
			await this.env.DB.prepare(
				`INSERT INTO usage_daily (tenant_id, day, tokens_used, messages_sent, llm_cost_cents)
				 VALUES (?, ?, ?, ?, ?)
				 ON CONFLICT(tenant_id, day) DO UPDATE SET
				   tokens_used = tokens_used + excluded.tokens_used,
				   messages_sent = messages_sent + excluded.messages_sent,
				   llm_cost_cents = llm_cost_cents + excluded.llm_cost_cents`,
			)
				.bind(this.tenantId, today, tokens, messages, costCents)
				.run();
		} catch (error) {
			console.error("Failed to update D1 usage:", error);
		}
	}

	/**
	 * Register built-in tools
	 */
	private registerBuiltInTools(): void {
		// Memory recall tool
		this.tools.set("recall_memory", {
			name: "recall_memory",
			description: "Search and recall facts from memory about a person, entity, or topic",
			input_schema: {
				type: "object",
				properties: {
					query: {
						type: "string",
						description: "What to search for in memory",
					},
					entity: {
						type: "string",
						description: "Optional: specific entity to search for",
					},
				},
				required: ["query"],
			},
			handler: async (input) => {
				const query = input.query as string;
				const entity = input.entity as string | undefined;

				let sql = "SELECT * FROM memory_facts WHERE content LIKE ?";
				const params: unknown[] = [`%${query}%`];

				if (entity) {
					sql += " AND entity = ?";
					params.push(entity);
				}

				sql += " ORDER BY confidence DESC, usage_count DESC LIMIT 5";

				const facts = this.sql.exec<MemoryFact>(sql, params).toArray();

				if (facts.length === 0) {
					return "No relevant memories found.";
				}

				return facts.map((f) => `[${f.type}] ${f.entity}: ${f.content} (confidence: ${f.confidence})`).join("\n");
			},
		});

		// Memory store tool
		this.tools.set("store_memory", {
			name: "store_memory",
			description: "Store a new fact or information in long-term memory",
			input_schema: {
				type: "object",
				properties: {
					entity: {
						type: "string",
						description: "The person, company, or topic this fact is about",
					},
					type: {
						type: "string",
						description: "Type of fact (preference, contact, business, personal, etc.)",
					},
					content: {
						type: "string",
						description: "The fact or information to remember",
					},
					confidence: {
						type: "number",
						description: "Confidence level 0-1 (default 1.0)",
					},
				},
				required: ["entity", "type", "content"],
			},
			handler: async (input) => {
				const id = crypto.randomUUID();
				const now = new Date().toISOString();

				this.sql.exec(
					`INSERT INTO memory_facts (id, entity, type, content, confidence, usage_count, learned_at, source)
					 VALUES (?, ?, ?, ?, ?, 0, ?, 'conversation')`,
					[
						id,
						input.entity as string,
						input.type as string,
						input.content as string,
						(input.confidence as number) ?? 1.0,
						now,
					],
				);

				return `Stored: "${input.content}" about ${input.entity}`;
			},
		});

		// Get current date/time tool
		this.tools.set("get_current_time", {
			name: "get_current_time",
			description: "Get the current date and time",
			input_schema: {
				type: "object",
				properties: {
					timezone: {
						type: "string",
						description: "Optional timezone (e.g., 'Europe/Riga', 'UTC')",
					},
				},
			},
			handler: async (input) => {
				const timezone = (input.timezone as string) ?? "UTC";
				try {
					const now = new Date();
					const formatted = now.toLocaleString("en-US", {
						timeZone: timezone,
						weekday: "long",
						year: "numeric",
						month: "long",
						day: "numeric",
						hour: "2-digit",
						minute: "2-digit",
						second: "2-digit",
					});
					return `Current time (${timezone}): ${formatted}`;
				} catch {
					return `Current time (UTC): ${new Date().toISOString()}`;
				}
			},
		});
	}

	/**
	 * JSON response helper
	 */
	private jsonResponse(data: unknown, status = 200): Response {
		return new Response(JSON.stringify(data), {
			status,
			headers: { "Content-Type": "application/json" },
		});
	}
}
