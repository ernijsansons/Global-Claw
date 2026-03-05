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
 * - Conversation ownership validation
 * - Proper usage billing for tool-call flows
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
	tool_use_id: string | null;
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

/**
 * Standard API response envelope
 */
interface DOResponse<T = unknown> {
	success: boolean;
	data?: T;
	error?: {
		code: string;
		message: string;
	};
}

/**
 * Accumulated usage from multiple LLM calls
 */
interface AccumulatedUsage {
	input_tokens: number;
	output_tokens: number;
	cost_cents: number;
	call_count: number;
}

// ============================================================================
// TenantAgent Durable Object
// ============================================================================

/**
 * TenantAgent Durable Object
 * Each tenant gets its own instance for isolation.
 *
 * Note: This implementation follows standard DurableObject patterns.
 * Future migration to Cloudflare Agents SDK (Agent/McpAgent) is planned
 * when SDK stabilizes for production use with keepAlive and resumable primitives.
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

	// Binding state - prevents re-initialization
	private isBound = false;

	constructor(state: DurableObjectState, env: Env) {
		this.state = state;
		this.env = env;
		this.sql = state.storage.sql;

		// Restore tenant ID from storage on construction
		state.blockConcurrencyWhile(async () => {
			const storedTenantId = await state.storage.get<string>("tenant_id");
			if (storedTenantId) {
				this.tenantId = storedTenantId;
				this.isBound = true;
			}
		});
	}

	// ========================================================================
	// Initialization
	// ========================================================================

	/**
	 * Initialize SQLite tables if not already done
	 */
	private async ensureInitialized(): Promise<void> {
		if (this.initialized) return;

		// Create tables for tenant state (each statement must be separate in DO SQLite)
		this.sql.exec(`CREATE TABLE IF NOT EXISTS conversations (
			id TEXT PRIMARY KEY,
			user_id TEXT NOT NULL,
			agent_id TEXT NOT NULL,
			message_count INTEGER DEFAULT 0,
			first_message_at TEXT NOT NULL,
			last_message_at TEXT NOT NULL,
			status TEXT DEFAULT 'active'
		)`);

		this.sql.exec(`CREATE TABLE IF NOT EXISTS conversation_messages (
			id TEXT PRIMARY KEY,
			conversation_id TEXT NOT NULL,
			role TEXT NOT NULL,
			content TEXT NOT NULL,
			tokens INTEGER DEFAULT 0,
			created_at TEXT NOT NULL,
			tool_name TEXT,
			tool_input TEXT,
			tool_result TEXT,
			tool_use_id TEXT
		)`);

		this.sql.exec(`CREATE TABLE IF NOT EXISTS memory_facts (
			id TEXT PRIMARY KEY,
			entity TEXT NOT NULL,
			type TEXT NOT NULL,
			content TEXT NOT NULL,
			confidence REAL DEFAULT 1.0,
			usage_count INTEGER DEFAULT 0,
			last_used_at TEXT,
			learned_at TEXT NOT NULL,
			source TEXT
		)`);

		this.sql.exec(`CREATE TABLE IF NOT EXISTS budget_usage (
			date TEXT PRIMARY KEY,
			tokens_used INTEGER DEFAULT 0,
			messages_sent INTEGER DEFAULT 0,
			cost_cents INTEGER DEFAULT 0
		)`);

		this.sql.exec(`CREATE TABLE IF NOT EXISTS agent_configs (
			agent_id TEXT PRIMARY KEY,
			config_json TEXT NOT NULL,
			updated_at TEXT NOT NULL
		)`);

		// Create indexes
		this.sql.exec("CREATE INDEX IF NOT EXISTS idx_conv_user ON conversations(user_id)");
		this.sql.exec("CREATE INDEX IF NOT EXISTS idx_conv_agent ON conversations(agent_id)");
		this.sql.exec("CREATE INDEX IF NOT EXISTS idx_conv_status ON conversations(status)");
		this.sql.exec("CREATE INDEX IF NOT EXISTS idx_msg_conv ON conversation_messages(conversation_id)");
		this.sql.exec("CREATE INDEX IF NOT EXISTS idx_msg_created ON conversation_messages(created_at)");
		this.sql.exec("CREATE INDEX IF NOT EXISTS idx_facts_entity ON memory_facts(entity)");
		this.sql.exec("CREATE INDEX IF NOT EXISTS idx_facts_type ON memory_facts(type)");

		// Register built-in tools
		this.registerBuiltInTools();

		this.initialized = true;

		// Load tenant data if already bound
		if (this.tenantId) {
			await this.loadTenantData();
		}
	}

	/**
	 * Bind this DO to a tenant ID (one-time operation)
	 */
	async bindTenant(tenantId: string): Promise<{ success: boolean; error?: string }> {
		// Prevent re-binding
		if (this.isBound && this.tenantId !== tenantId) {
			return {
				success: false,
				error: `DO already bound to tenant ${this.tenantId}, cannot rebind to ${tenantId}`,
			};
		}

		// Validate tenant exists in D1
		const tenant = await this.env.DB.prepare("SELECT id, status FROM tenants WHERE id = ?")
			.bind(tenantId)
			.first<{ id: string; status: string }>();

		if (!tenant) {
			return {
				success: false,
				error: `Tenant ${tenantId} does not exist`,
			};
		}

		if (tenant.status === "deleted") {
			return {
				success: false,
				error: `Tenant ${tenantId} is deleted`,
			};
		}

		this.tenantId = tenantId;
		this.isBound = true;
		await this.state.storage.put("tenant_id", tenantId);

		// Load tenant data from D1
		await this.loadTenantData();

		return { success: true };
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
	// Request Authorization
	// ========================================================================

	/**
	 * Validate request has proper authorization headers
	 */
	private validateAuth(request: Request): { valid: boolean; user_id?: string; error?: string } {
		// Check for internal service token or user context
		const authHeader = request.headers.get("X-DO-Auth");
		const userId = request.headers.get("X-User-Id");

		// Internal requests from the worker are trusted
		if (authHeader === this.env.JWT_SECRET) {
			return { valid: true, user_id: userId ?? undefined };
		}

		// For now, require user_id header for external requests
		// In production, this should validate JWT or API key
		if (!userId) {
			return { valid: false, error: "Missing X-User-Id header" };
		}

		return { valid: true, user_id: userId };
	}

	/**
	 * Check if user/agent can access a conversation
	 */
	private validateConversationAccess(
		conversationId: string,
		userId: string,
		agentId: string,
	): { valid: boolean; conversation?: Conversation; error?: string } {
		const conversation = this.sql
			.exec<Conversation>("SELECT * FROM conversations WHERE id = ?", [conversationId])
			.toArray()[0];

		if (!conversation) {
			// New conversation - allow
			return { valid: true };
		}

		// Validate ownership
		if (conversation.user_id !== userId) {
			return {
				valid: false,
				error: `User ${userId} does not own conversation ${conversationId}`,
			};
		}

		if (conversation.agent_id !== agentId) {
			return {
				valid: false,
				error: `Agent ${agentId} is not assigned to conversation ${conversationId}`,
			};
		}

		return { valid: true, conversation };
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
			// Health check (public)
			if (path === "/health" && request.method === "GET") {
				return this.handleHealth();
			}

			// Initialize with tenant ID (called during provisioning, requires auth)
			if (path === "/init" && request.method === "POST") {
				return this.handleInit(request);
			}

			// Bind route - simpler init that extracts tenant_id from header or DO name context
			if (path === "/bind" && request.method === "POST") {
				return this.handleBind(request);
			}

			// All other routes require tenant to be bound
			if (!this.isBound || !this.tenantId) {
				return this.errorResponse("UNBOUND", "TenantAgent not initialized with tenant_id", 400);
			}

			// Read-only routes (no auth required for internal calls)
			if (path === "/state" && request.method === "GET") {
				return this.handleGetState();
			}

			if (path === "/budget" && request.method === "GET") {
				return this.handleGetBudget();
			}

			if (path === "/tools" && request.method === "GET") {
				return this.handleListTools();
			}

			if (path === "/conversations" && request.method === "GET") {
				return this.handleListConversations(url.searchParams);
			}

			if (path.startsWith("/conversations/") && request.method === "GET") {
				const conversationId = path.split("/")[2];
				return this.handleGetConversation(conversationId ?? "", request);
			}

			if (path === "/memory" && request.method === "GET") {
				return this.handleSearchMemory(url.searchParams);
			}

			// Mutating routes require auth validation
			const auth = this.validateAuth(request);

			// Message endpoints
			if (path === "/message" && request.method === "POST") {
				return this.handleMessage(request);
			}

			if (path === "/message/stream" && request.method === "POST") {
				return this.handleMessageStream(request);
			}

			// Memory mutation
			if (path === "/memory" && request.method === "POST") {
				if (!auth.valid) {
					return this.errorResponse("UNAUTHORIZED", auth.error ?? "Unauthorized", 401);
				}
				return this.handleAddMemory(request);
			}

			// Tool registration (admin only)
			if (path === "/tools" && request.method === "POST") {
				if (!auth.valid) {
					return this.errorResponse("UNAUTHORIZED", auth.error ?? "Unauthorized", 401);
				}
				return this.handleRegisterTool(request);
			}

			// Reload tenant data (admin only)
			if (path === "/reload" && request.method === "POST") {
				if (!auth.valid) {
					return this.errorResponse("UNAUTHORIZED", auth.error ?? "Unauthorized", 401);
				}
				await this.loadTenantData();
				return this.successResponse({ reloaded: true });
			}

			return this.errorResponse("NOT_FOUND", `Route ${request.method} ${path} not found`, 404);
		} catch (error) {
			console.error("TenantAgent error:", error);
			return this.errorResponse("INTERNAL_ERROR", error instanceof Error ? error.message : "Internal error", 500);
		}
	}

	// ========================================================================
	// Handler Methods
	// ========================================================================

	/**
	 * Health check endpoint
	 */
	private handleHealth(): Response {
		return this.successResponse({
			status: "ok",
			initialized: this.initialized,
			bound: this.isBound,
			tenant_id: this.tenantId,
			agents_loaded: this.agents.size,
			tools_registered: this.tools.size,
			timestamp: new Date().toISOString(),
		});
	}

	/**
	 * Initialize with tenant ID (one-time binding)
	 */
	private async handleInit(request: Request): Promise<Response> {
		const body = (await request.json()) as { tenant_id: string };

		if (!body.tenant_id) {
			return this.errorResponse("VALIDATION_ERROR", "tenant_id is required", 400);
		}

		const result = await this.bindTenant(body.tenant_id);

		if (!result.success) {
			return this.errorResponse("BINDING_ERROR", result.error ?? "Failed to bind tenant", 400);
		}

		return this.successResponse({
			tenant_id: this.tenantId,
			agents: Array.from(this.agents.keys()),
		});
	}

	/**
	 * Bind route - uses X-Tenant-ID header for tenant identification
	 * This is called by provisioning workflow and control-plane routes
	 */
	private async handleBind(request: Request): Promise<Response> {
		// Get tenant_id from header (set by index.ts or provisioning workflow)
		const tenantId = request.headers.get("X-Tenant-ID");

		if (!tenantId) {
			// Try to extract from body as fallback
			try {
				const body = (await request.json()) as { tenant_id?: string };
				if (body.tenant_id) {
					const result = await this.bindTenant(body.tenant_id);
					if (!result.success) {
						return this.errorResponse("BINDING_ERROR", result.error ?? "Failed to bind tenant", 400);
					}
					return this.successResponse({
						success: true,
						tenant_id: this.tenantId,
					});
				}
			} catch {
				// No body or invalid JSON
			}
			return this.errorResponse("VALIDATION_ERROR", "X-Tenant-ID header or tenant_id in body required", 400);
		}

		const result = await this.bindTenant(tenantId);

		if (!result.success) {
			return this.errorResponse("BINDING_ERROR", result.error ?? "Failed to bind tenant", 400);
		}

		return this.successResponse({
			success: true,
			tenant_id: this.tenantId,
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

		return this.successResponse({
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
		return this.successResponse(budget);
	}

	/**
	 * Handle incoming message (non-streaming)
	 */
	private async handleMessage(request: Request): Promise<Response> {
		const body = (await request.json()) as MessageRequest;

		// Validate request
		if (!body.agent_id || !body.user_id || !body.content) {
			return this.errorResponse("VALIDATION_ERROR", "agent_id, user_id, and content are required", 400);
		}

		// Check budget
		const budget = await this.getBudgetInfo();
		if (budget.tokens_remaining <= 0) {
			return this.errorResponse("BUDGET_EXCEEDED", "Token budget exceeded", 429);
		}

		if (budget.messages_remaining <= 0) {
			return this.errorResponse("BUDGET_EXCEEDED", "Message budget exceeded", 429);
		}

		// Determine conversation ID
		const conversationId = body.conversation_id ?? crypto.randomUUID();

		// Validate conversation access
		const accessCheck = this.validateConversationAccess(conversationId, body.user_id, body.agent_id);
		if (!accessCheck.valid) {
			return this.errorResponse("FORBIDDEN", accessCheck.error ?? "Access denied", 403);
		}

		// Ensure conversation exists
		await this.getOrCreateConversation(conversationId, body.user_id, body.agent_id);

		// Get agent
		const agent = this.agents.get(body.agent_id);
		if (!agent) {
			return this.errorResponse("NOT_FOUND", "Agent not found", 404);
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

		// Execute LLM call with usage accumulation
		const { createExecutor } = await import("../lib/llm/executor");
		const executor = createExecutor(this.env);
		const accumulatedUsage: AccumulatedUsage = {
			input_tokens: 0,
			output_tokens: 0,
			cost_cents: 0,
			call_count: 0,
		};

		const response = await executor.execute(llmRequest);
		this.accumulateUsage(accumulatedUsage, response);

		// Process tool calls if any (this may make additional LLM calls)
		let finalContent = response.content;
		if (response.tool_calls && response.tool_calls.length > 0) {
			finalContent = await this.processToolCalls(response, messages, llmRequest, executor, accumulatedUsage);
		}

		// Save messages to conversation
		const userMessageId = crypto.randomUUID();
		const assistantMessageId = crypto.randomUUID();
		const now = new Date().toISOString();

		this.sql.exec(
			`INSERT INTO conversation_messages (id, conversation_id, role, content, tokens, created_at, tool_use_id)
			 VALUES (?, ?, 'user', ?, 0, ?, NULL)`,
			[userMessageId, conversationId, body.content, now],
		);

		this.sql.exec(
			`INSERT INTO conversation_messages (id, conversation_id, role, content, tokens, created_at, tool_use_id)
			 VALUES (?, ?, 'assistant', ?, ?, ?, NULL)`,
			[assistantMessageId, conversationId, finalContent, accumulatedUsage.output_tokens, now],
		);

		// Update conversation
		this.sql.exec("UPDATE conversations SET message_count = message_count + 2, last_message_at = ? WHERE id = ?", [
			now,
			conversationId,
		]);

		// Record ALL accumulated usage (includes tool-call follow-ups)
		await this.recordUsage(
			accumulatedUsage.input_tokens + accumulatedUsage.output_tokens,
			1,
			accumulatedUsage.cost_cents,
		);

		// Invalidate budget cache
		this.budgetCache = null;

		return this.successResponse({
			conversation_id: conversationId,
			message_id: assistantMessageId,
			content: finalContent,
			tool_calls: response.tool_calls,
			usage: {
				input_tokens: accumulatedUsage.input_tokens,
				output_tokens: accumulatedUsage.output_tokens,
				total_calls: accumulatedUsage.call_count,
			},
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
			return this.errorResponse("VALIDATION_ERROR", "agent_id, user_id, and content are required", 400);
		}

		// Check budget
		const budget = await this.getBudgetInfo();
		if (budget.tokens_remaining <= 0 || budget.messages_remaining <= 0) {
			return this.errorResponse("BUDGET_EXCEEDED", "Budget exceeded", 429);
		}

		// Determine conversation ID
		const conversationId = body.conversation_id ?? crypto.randomUUID();

		// Validate conversation access
		const accessCheck = this.validateConversationAccess(conversationId, body.user_id, body.agent_id);
		if (!accessCheck.valid) {
			return this.errorResponse("FORBIDDEN", accessCheck.error ?? "Access denied", 403);
		}

		await this.getOrCreateConversation(conversationId, body.user_id, body.agent_id);

		// Get agent
		const agent = this.agents.get(body.agent_id);
		if (!agent) {
			return this.errorResponse("NOT_FOUND", "Agent not found", 404);
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
		const sql = this.sql;

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

					sql.exec(
						`INSERT INTO conversation_messages (id, conversation_id, role, content, tokens, created_at, tool_use_id)
						 VALUES (?, ?, 'user', ?, 0, ?, NULL)`,
						[userMessageId, conversationId, body.content, now],
					);

					sql.exec(
						`INSERT INTO conversation_messages (id, conversation_id, role, content, tokens, created_at, tool_use_id)
						 VALUES (?, ?, 'assistant', ?, ?, ?, NULL)`,
						[assistantMessageId, conversationId, fullContent, metrics?.metrics?.output_tokens ?? 0, now],
					);

					sql.exec("UPDATE conversations SET message_count = message_count + 2, last_message_at = ? WHERE id = ?", [
						now,
						conversationId,
					]);

					// Update budget and INVALIDATE CACHE
					if (metrics?.type === "done" && metrics.metrics) {
						await this.recordUsage(
							metrics.metrics.input_tokens + metrics.metrics.output_tokens,
							1,
							Math.round(metrics.metrics.cost_usd * 100),
						);
						// Invalidate budget cache after streaming usage update
						this.budgetCache = null;
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
	 * Get conversation history (with access validation)
	 */
	private handleGetConversation(conversationId: string, request: Request): Response {
		const conversation = this.sql
			.exec<Conversation>("SELECT * FROM conversations WHERE id = ?", [conversationId])
			.toArray()[0];

		if (!conversation) {
			return this.errorResponse("NOT_FOUND", "Conversation not found", 404);
		}

		// Validate access via header if provided
		const requestUserId = request.headers.get("X-User-Id");
		if (requestUserId && conversation.user_id !== requestUserId) {
			return this.errorResponse("FORBIDDEN", "Access denied to this conversation", 403);
		}

		const messages = this.sql
			.exec<ConversationMessage>(
				"SELECT * FROM conversation_messages WHERE conversation_id = ? ORDER BY created_at ASC",
				[conversationId],
			)
			.toArray();

		return this.successResponse({
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

		return this.successResponse({
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

		return this.successResponse({ facts });
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
			return this.errorResponse("VALIDATION_ERROR", "entity, type, and content are required", 400);
		}

		const id = crypto.randomUUID();
		const now = new Date().toISOString();

		this.sql.exec(
			`INSERT INTO memory_facts (id, entity, type, content, confidence, usage_count, learned_at, source)
			 VALUES (?, ?, ?, ?, ?, 0, ?, ?)`,
			[id, body.entity, body.type, body.content, body.confidence ?? 1.0, now, body.source ?? null],
		);

		return this.successResponse({ id });
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
			return this.errorResponse("VALIDATION_ERROR", "name, description, and input_schema are required", 400);
		}

		// Register tool (handler will be a no-op for external tools)
		this.tools.set(body.name, {
			name: body.name,
			description: body.description,
			input_schema: body.input_schema,
			handler: async () => "Tool executed via external handler",
		});

		return this.successResponse({ tool: body.name });
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

		return this.successResponse({ tools });
	}

	// ========================================================================
	// Helper Methods
	// ========================================================================

	/**
	 * Accumulate usage from an LLM response
	 */
	private accumulateUsage(accumulated: AccumulatedUsage, response: LLMResponse): void {
		accumulated.input_tokens += response.usage.input_tokens;
		accumulated.output_tokens += response.usage.output_tokens;
		accumulated.cost_cents += response.cost_cents;
		accumulated.call_count += 1;
	}

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
			const llmMessage: LLMMessage = {
				role: msg.role as "user" | "assistant" | "system" | "tool",
				content: msg.content,
			};

			// Properly reconstruct tool messages with tool_use_id
			if (msg.role === "tool" && msg.tool_use_id) {
				llmMessage.tool_use_id = msg.tool_use_id;
			}

			messages.push(llmMessage);
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
	 * Accumulates usage from all LLM calls made during tool processing
	 */
	private async processToolCalls(
		response: LLMResponse,
		messages: LLMMessage[],
		originalRequest: LLMRequest,
		executor: { execute: (req: LLMRequest) => Promise<LLMResponse> },
		accumulatedUsage: AccumulatedUsage,
	): Promise<string> {
		if (!response.tool_calls || response.tool_calls.length === 0) {
			return response.content;
		}

		// Add assistant message with tool calls
		messages.push({
			role: "assistant",
			content: response.content || "",
		});

		// Process each tool call and store results
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

			// Add tool result message with proper tool_use_id
			messages.push({
				role: "tool",
				content: result,
				tool_use_id: toolCall.id,
			});

			// Store tool call in database for history reconstruction
			const now = new Date().toISOString();
			this.sql.exec(
				`INSERT INTO conversation_messages (id, conversation_id, role, content, tokens, created_at, tool_name, tool_input, tool_result, tool_use_id)
				 VALUES (?, ?, 'tool', ?, 0, ?, ?, ?, ?, ?)`,
				[
					crypto.randomUUID(),
					originalRequest.context?.conversation_id ?? "",
					result,
					now,
					toolCall.name,
					JSON.stringify(toolCall.input),
					result,
					toolCall.id,
				],
			);
		}

		// Make follow-up LLM call with tool results
		const followUpRequest: LLMRequest = {
			...originalRequest,
			trace_id: crypto.randomUUID(),
			messages,
		};

		const followUpResponse = await executor.execute(followUpRequest);

		// Accumulate usage from follow-up call
		this.accumulateUsage(accumulatedUsage, followUpResponse);

		// Recursively process if there are more tool calls (up to 5 iterations)
		if (followUpResponse.tool_calls && followUpResponse.tool_calls.length > 0) {
			// Prevent infinite loops
			const toolCallDepth = messages.filter((m) => m.role === "tool").length;
			if (toolCallDepth < 5) {
				return this.processToolCalls(followUpResponse, messages, originalRequest, executor, accumulatedUsage);
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
	 * Standard success response
	 */
	private successResponse<T>(data: T): Response {
		const response: DOResponse<T> = {
			success: true,
			data,
		};
		return new Response(JSON.stringify(response), {
			status: 200,
			headers: { "Content-Type": "application/json" },
		});
	}

	/**
	 * Standard error response
	 */
	private errorResponse(code: string, message: string, status: number): Response {
		const response: DOResponse = {
			success: false,
			error: { code, message },
		};
		return new Response(JSON.stringify(response), {
			status,
			headers: { "Content-Type": "application/json" },
		});
	}
}
