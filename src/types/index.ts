/**
 * Global-Claw Type Definitions
 * Single source of truth for all TypeScript interfaces
 */

// Re-export environment types
export type { Env, QueueMessage, AuditLogMessage, NotificationMessage } from "./env";

// ============================================================================
// Database Models
// ============================================================================

/**
 * Tenant
 * Represents a single isolated tenant in the Global-Claw system.
 */
export interface Tenant {
	id: string;
	name: string;
	subdomain: string | null;
	plan: "starter" | "pro" | "business" | "enterprise";
	status: "active" | "suspended" | "cancelled" | "provisioning" | "deleted";
	token_budget_daily: number;
	msg_budget_daily: number;
	max_agents: number;
	default_language: string;
	languages_json: string;
	metadata_json: string;
	created_at: string;
	updated_at: string;
}

export interface TenantCreateInput {
	name: string;
	subdomain?: string;
	plan?: "starter" | "pro" | "business" | "enterprise";
	default_language?: string;
	languages?: string[];
	metadata?: Record<string, unknown>;
}

export interface TenantUpdateInput {
	name?: string;
	plan?: "starter" | "pro" | "business" | "enterprise";
	status?: "active" | "suspended" | "cancelled";
	token_budget_daily?: number;
	msg_budget_daily?: number;
	default_language?: string;
	languages?: string[];
	metadata?: Record<string, unknown>;
}

/**
 * User
 * Represents an individual user account in the system.
 */
export interface User {
	id: string;
	email: string;
	name: string | null;
	password_hash: string | null;
	stripe_customer_id: string | null;
	avatar_url: string | null;
	locale: string;
	created_at: string;
	updated_at: string;
}

export interface UserCreateInput {
	email: string;
	name?: string;
	password: string;
	locale?: string;
}

export interface UserUpdateInput {
	name?: string;
	avatar_url?: string;
	locale?: string;
	password?: string;
}

/**
 * TenantUser
 * Maps users to tenants with role-based permissions.
 */
export interface TenantUser {
	tenant_id: string;
	user_id: string;
	role: "owner" | "admin" | "member" | "viewer";
	invited_at: string;
	accepted_at: string | null;
}

export interface TenantUserCreateInput {
	email: string;
	role?: "admin" | "member" | "viewer";
}

export interface TenantUserUpdateInput {
	role: "owner" | "admin" | "member" | "viewer";
}

/**
 * Subscription
 * Tracks Stripe subscription state for billing.
 */
export interface Subscription {
	id: string;
	tenant_id: string;
	stripe_subscription_id: string | null;
	stripe_price_id: string | null;
	status: "active" | "past_due" | "trialing" | "cancelled" | "incomplete";
	current_period_start: string | null;
	current_period_end: string | null;
	cancel_at_period_end: 0 | 1;
	created_at: string;
	updated_at: string;
}

/**
 * ApiKey
 * Represents an API key for a tenant.
 */
export interface ApiKey {
	id: string;
	tenant_id: string;
	key_hash: string;
	key_prefix: string;
	name: string;
	scopes_json: string;
	last_used_at: string | null;
	expires_at: string | null;
	created_at: string;
}

export interface ApiKeyCreateInput {
	name?: string;
	scopes?: string[];
	expires_at?: string;
}

export interface ApiKeyResponse extends Omit<ApiKey, "key_hash"> {
	key: string;
}

/**
 * UsageDaily
 * Tracks daily LLM and message usage per tenant.
 */
export interface UsageDaily {
	tenant_id: string;
	day: string;
	tokens_used: number;
	messages_sent: number;
	tool_calls: number;
	llm_cost_cents: number;
}

/**
 * LLMProvider
 * Configuration for a language model provider.
 */
export interface LLMProvider {
	id: string;
	name: string;
	slug: string;
	api_base_url: string;
	api_key_encrypted: string;
	auth_header: string;
	auth_prefix: string;
	models_json: string;
	cost_per_1m_input_cents: number;
	cost_per_1m_output_cents: number;
	cost_tier: "budget" | "standard" | "premium";
	weight: number;
	max_requests_per_min: number;
	is_enabled: 0 | 1;
	health_score: number;
	last_health_check: string | null;
	total_requests: number;
	total_failures: number;
	avg_latency_ms: number;
	created_at: string;
	updated_at: string;
}

export interface LLMProviderCreateInput {
	name: string;
	slug: string;
	api_base_url: string;
	api_key: string;
	auth_header?: string;
	auth_prefix?: string;
	models: string[];
	cost_per_1m_input_cents?: number;
	cost_per_1m_output_cents?: number;
	cost_tier?: "budget" | "standard" | "premium";
	weight?: number;
	max_requests_per_min?: number;
}

export interface LLMProviderUpdateInput {
	name?: string;
	api_key?: string;
	models?: string[];
	cost_per_1m_input_cents?: number;
	cost_per_1m_output_cents?: number;
	weight?: number;
	is_enabled?: boolean;
}

/**
 * LLMRoutingRule
 * Defines conditional rules for routing LLM requests.
 */
export interface LLMRoutingRule {
	id: string;
	name: string;
	priority: number;
	condition_json: string;
	routes_json: string;
	is_enabled: 0 | 1;
	created_at: string;
	updated_at: string;
}

export interface RoutingCondition {
	field: string;
	operator: "eq" | "neq" | "gt" | "lt" | "in" | "matches";
	value: unknown;
}

export interface RoutingRoute {
	provider_slug: string;
	model: string;
	weight: number;
}

export interface LLMRoutingRuleCreateInput {
	name: string;
	priority?: number;
	condition: RoutingCondition;
	routes: RoutingRoute[];
}

/**
 * LLMUsageLog
 * Detailed record of each LLM API call.
 */
export interface LLMUsageLog {
	id: string;
	tenant_id: string;
	provider_id: string;
	model: string;
	input_tokens: number;
	output_tokens: number;
	latency_ms: number;
	cost_cents: number;
	status: "success" | "error" | "timeout" | "fallback";
	trace_id: string | null;
	created_at: string;
}

/**
 * Agent
 * Represents an AI agent configured for a tenant.
 */
export interface Agent {
	id: string;
	tenant_id: string;
	name: string;
	slug: string;
	telegram_bot_token_encrypted: string | null;
	telegram_bot_username: string | null;
	soul_md: string;
	agents_md: string;
	primary_model: string;
	fallback_model: string | null;
	temperature: number;
	max_tokens: number;
	languages_json: string;
	avatar_url: string | null;
	status: "active" | "paused" | "error";
	total_messages: number;
	total_conversations: number;
	created_at: string;
	updated_at: string;
}

export interface AgentCreateInput {
	name: string;
	slug?: string;
	soul_md?: string;
	agents_md?: string;
	primary_model?: string;
	fallback_model?: string;
	temperature?: number;
	max_tokens?: number;
	languages?: string[];
	avatar_url?: string;
}

export interface AgentUpdateInput {
	name?: string;
	soul_md?: string;
	agents_md?: string;
	primary_model?: string;
	fallback_model?: string;
	temperature?: number;
	max_tokens?: number;
	languages?: string[];
	avatar_url?: string;
	status?: "active" | "paused";
}

/**
 * PluginConnection
 * Represents a connected OAuth plugin.
 */
export interface PluginConnection {
	id: string;
	tenant_id: string;
	agent_id: string | null;
	provider: string;
	display_name: string;
	oauth_access_token_encrypted: string | null;
	oauth_refresh_token_encrypted: string | null;
	token_expires_at: string | null;
	scopes_json: string;
	mcp_endpoint_url: string | null;
	status: "connected" | "expired" | "revoked" | "error";
	last_used_at: string | null;
	created_at: string;
	updated_at: string;
}

export interface PluginConnectionCreateInput {
	provider: string;
	display_name?: string;
	agent_id?: string;
	access_token: string;
	refresh_token?: string;
	expires_in?: number;
	scopes?: string[];
}

/**
 * Workflow
 * Represents an automation workflow.
 */
export interface Workflow {
	id: string;
	tenant_id: string;
	name: string;
	slug: string;
	description: string | null;
	nodes_json: string;
	edges_json: string;
	trigger_type: "manual" | "message" | "schedule" | "webhook" | "event";
	trigger_config_json: string;
	is_enabled: 0 | 1;
	total_runs: number;
	last_run_at: string | null;
	created_at: string;
	updated_at: string;
}

export interface WorkflowNode {
	id: string;
	type: "trigger" | "condition" | "action" | "llm_call" | "human_input" | "wait" | "sub_workflow";
	label: string;
	config: Record<string, unknown>;
	position: { x: number; y: number };
}

export interface WorkflowEdge {
	id: string;
	source: string;
	target: string;
	label?: string;
	condition?: Record<string, unknown>;
}

export interface WorkflowCreateInput {
	name: string;
	slug?: string;
	description?: string;
	trigger_type?: "manual" | "message" | "schedule" | "webhook" | "event";
	trigger_config?: Record<string, unknown>;
	nodes?: WorkflowNode[];
	edges?: WorkflowEdge[];
}

/**
 * WorkflowRun
 * Represents a single execution of a workflow.
 */
export interface WorkflowRun {
	id: string;
	workflow_id: string;
	tenant_id: string;
	status: "running" | "completed" | "failed" | "cancelled" | "waiting";
	trigger_data_json: string | null;
	result_json: string | null;
	started_at: string;
	completed_at: string | null;
	duration_ms: number | null;
	error_message: string | null;
}

export interface WorkflowRunCreateInput {
	workflow_id: string;
	trigger_data?: Record<string, unknown>;
}

/**
 * FeatureFlag
 * Toggleable features per tenant.
 */
export interface FeatureFlag {
	tenant_id: string;
	feature: string;
	is_enabled: 0 | 1;
	config_json: string | null;
}

export interface FeatureFlagUpdateInput {
	is_enabled?: boolean;
	config?: Record<string, unknown>;
}

/**
 * Partner
 * Represents a reseller or affiliate.
 */
export interface Partner {
	id: string;
	user_id: string;
	tier: "affiliate" | "partner" | "premium" | "master";
	company_name: string | null;
	referral_code: string;
	commission_rate: number;
	total_referrals: number;
	total_earnings_cents: number;
	parent_partner_id: string | null;
	status: "active" | "inactive" | "suspended";
	created_at: string;
	updated_at: string;
}

export interface TenantPartner {
	tenant_id: string;
	partner_id: string;
	referred_at: string;
}

export interface PartnerCreateInput {
	company_name?: string;
	tier?: "affiliate" | "partner" | "premium" | "master";
}

// ============================================================================
// API Response Types
// ============================================================================

/**
 * Pagination
 * Standard pagination info for list endpoints (per CLAUDE.md spec).
 */
export interface Pagination {
	page: number;
	limit: number;
	total: number;
	has_more: boolean;
}

/**
 * ApiResponse
 * Standard success response envelope.
 */
export interface ApiResponse<T> {
	success: true;
	data: T;
	meta?: Pagination;
}

/**
 * ApiError
 * Standard error details.
 */
export interface ApiError {
	code: string;
	message: string;
	details?: Record<string, unknown> | string[];
}

/**
 * ApiErrorResponse
 * Standard error response envelope.
 */
export interface ApiErrorResponse {
	success: false;
	error: ApiError;
}

/**
 * PaginatedResponse
 * Response for list endpoints with pagination.
 */
export interface PaginatedResponse<T> {
	items: T[];
	total: number;
	page: number;
	per_page: number;
	total_pages: number;
	has_next: boolean;
	has_prev: boolean;
}

/**
 * PaginationQuery
 * Standard pagination parameters.
 */
export interface PaginationQuery {
	page?: number | string;
	per_page?: number | string;
	sort_by?: string;
	sort_order?: "asc" | "desc";
}

// ============================================================================
// Authentication Types
// ============================================================================

export interface LoginRequest {
	email: string;
	password: string;
}

export interface RegisterRequest {
	email: string;
	name?: string;
	password: string;
	locale?: string;
}

export interface TokenResponse {
	access_token: string;
	refresh_token: string;
	token_type: string;
	expires_in: number;
	user: Omit<User, "password_hash">;
}

export interface RefreshTokenRequest {
	refresh_token: string;
}

// ============================================================================
// LLM Router Types
// ============================================================================

/**
 * LLMRequest
 * Request to the LLM executor.
 */
export interface LLMRequest {
	trace_id: string;
	tenant_id: string;
	messages: LLMMessage[];
	task_type?: string;
	system?: string;
	model?: string;
	provider?: string;
	temperature?: number;
	max_tokens?: number;
	stop_sequences?: string[];
	tools?: LLMTool[];
	context?: {
		language?: string;
		user_id?: string;
		agent_id?: string;
		token_budget_remaining?: number;
		[key: string]: unknown;
	};
	timeout_ms?: number;
	allow_fallback?: boolean;
}

/**
 * LLMMessage
 * Single message in conversation history.
 */
export interface LLMMessage {
	role: "system" | "user" | "assistant" | "tool";
	content: string | LLMMessageContent[];
	tool_use_id?: string;
}

export type LLMMessageContent =
	| { type: "text"; text: string }
	| { type: "image"; image_url: string; detail?: "low" | "high" }
	| { type: "tool_use"; id: string; name: string; input: Record<string, unknown> }
	| { type: "tool_result"; tool_use_id: string; content: string; is_error?: boolean };

/**
 * LLMTool
 * Tool definition for the LLM.
 */
export interface LLMTool {
	name: string;
	description: string;
	input_schema: {
		type: "object";
		properties: Record<string, unknown>;
		required?: string[];
	};
}

/**
 * LLMResponse
 * Response from the LLM executor.
 */
export interface LLMResponse {
	trace_id: string;
	provider: {
		name: string;
		slug: string;
		model: string;
	};
	content: string;
	stop_reason: "end_turn" | "max_tokens" | "tool_use" | "stop_sequence";
	tool_calls?: Array<{ id: string; name: string; input: Record<string, unknown> }>;
	usage: {
		input_tokens: number;
		output_tokens: number;
	};
	latency_ms: number;
	cost_cents: number;
	completed_at: string;
}

/**
 * RoutingDecision
 * Result of the routing evaluation process.
 */
export interface RoutingDecision {
	provider: LLMProvider;
	model: string;
	fallbacks: Array<{ provider: LLMProvider; model: string }>;
	reason: string;
	rule_id?: string;
}

/**
 * LLMStreamChunk
 * Individual chunk from streaming LLM response.
 */
export type LLMStreamChunk =
	| { type: "content"; content: string }
	| { type: "tool_use"; id: string; name: string; input: Record<string, unknown> }
	| { type: "done"; metrics: LLMStreamMetrics }
	| { type: "error"; error: string };

/**
 * LLMStreamMetrics
 * Metrics collected during streaming.
 */
export interface LLMStreamMetrics {
	input_tokens: number;
	output_tokens: number;
	total_tokens: number;
	latency_ms: number;
	cost_usd: number;
}

/**
 * CircuitBreakerState
 * Tracks health of a provider for circuit breaker logic.
 */
export interface CircuitBreakerState {
	provider_id: string;
	state: "closed" | "open" | "half_open";
	failure_count: number;
	last_state_change: string;
	next_retry_at: string | null;
	health_score: number;
}

/**
 * ProviderAdapter
 * Interface that all provider adapters must implement.
 */
export interface ProviderAdapter {
	slug: string;
	initialize(provider: LLMProvider): Promise<void>;
	call(request: LLMRequest): Promise<LLMResponse>;
	healthCheck(): Promise<{ healthy: boolean; latency_ms: number }>;
	parseError(error: unknown): { code: string; message: string; retriable: boolean };
}

// ============================================================================
// Middleware Context Types
// ============================================================================

/**
 * TenantRole
 * Role of a user within a tenant, or 'api_key' for API key auth.
 */
export type TenantRole = "owner" | "admin" | "member" | "viewer" | "api_key";

/**
 * TenantContext
 * Attached to Hono context after auth middleware.
 * Lightweight structure for middleware use.
 */
export interface TenantContext {
	/** User ID (from JWT sub claim) */
	user_id: string;
	/** Current tenant ID */
	tenant_id: string;
	/** User's role in the current tenant */
	role: TenantRole;
	/** Tenant's subscription plan */
	plan?: string;
	/** User email (when available) */
	email?: string;
	/** API key ID (when authenticated via API key) */
	api_key_id?: string;
	/** API key scopes (when authenticated via API key) */
	scopes?: string[];
}

/**
 * FullTenantContext
 * Extended context with full user and tenant objects.
 * Used when full details are needed beyond basic auth.
 */
export interface FullTenantContext extends TenantContext {
	user: Omit<User, "password_hash">;
	tenants: Array<{
		tenant: Tenant;
		role: TenantRole;
	}>;
	current_tenant: Tenant;
	api_key?: Omit<ApiKey, "key_hash" | "scopes_json"> & { scopes: string[] };
	trace_id: string;
	request_at: string;
}

// ============================================================================
// Utility Types
// ============================================================================

export type DeepPartial<T> = {
	[P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type Nullable<T> = T | null;

export type AsyncResult<T, E = ApiError> = { ok: true; data: T } | { ok: false; error: E };

export interface PaginationMeta {
	page: number;
	per_page: number;
	total: number;
	total_pages: number;
}

export interface RateLimitInfo {
	remaining: number;
	limit: number;
	reset_at: number;
	exceeded: boolean;
}

export interface BudgetInfo {
	tokens_used_today: number;
	tokens_budget_daily: number;
	tokens_remaining: number;
	messages_sent_today: number;
	messages_budget_daily: number;
	messages_remaining: number;
	cost_today_cents: number;
	cost_warning_threshold_cents: number;
	usage_percentage: number;
}

export interface HealthCheckResult {
	status: "healthy" | "degraded" | "unhealthy";
	database: { status: "ok" | "error"; latency_ms: number };
	durable_objects: { status: "ok" | "error" };
	llm_providers: Array<{
		provider: string;
		status: "ok" | "error" | "degraded";
		health_score: number;
	}>;
	queues: { status: "ok" | "error" };
	r2: { status: "ok" | "error" };
	checked_at: string;
}
