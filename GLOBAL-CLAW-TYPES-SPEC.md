# Global-Claw TypeScript Types Specification

**Version:** 3.0.0
**Last Updated:** 2026-03-05
**Status:** Foundation Reference for One-Shot Build

---

## Table of Contents

1. [Database Models](#database-models)
2. [API Request/Response Types](#api-requestresponse-types)
3. [LLM Router Types](#llm-router-types)
4. [Tenant Agent (Durable Object) Types](#tenant-agent-durable-object-types)
5. [Worker Environment Bindings](#worker-environment-bindings)
6. [Telegram Types](#telegram-types)
7. [WebSocket Event Types](#websocket-event-types)
8. [Middleware Context Types](#middleware-context-types)
9. [Utility & Helper Types](#utility--helper-types)

---

## Database Models

### Tenant

Represents a single tenant (customer) workspace.

```typescript
/**
 * Tenant
 * Represents a single isolated tenant in the Global-Claw system.
 * Each tenant has independent agents, workflows, usage budgets, and settings.
 */
export interface Tenant {
  /** Unique identifier (lowercase hex, 16 bytes) */
  id: string;

  /** Display name for the tenant */
  name: string;

  /** URL-safe subdomain slug (e.g., "acme-corp") */
  subdomain: string | null;

  /**
   * Subscription plan tier
   * @values 'starter' | 'pro' | 'business' | 'enterprise'
   */
  plan: 'starter' | 'pro' | 'business' | 'enterprise';

  /**
   * Tenant status
   * - 'active': Operating normally
   * - 'suspended': Billing issue or policy violation
   * - 'cancelled': Subscription ended
   * - 'provisioning': Initial setup in progress
   */
  status: 'active' | 'suspended' | 'cancelled' | 'provisioning';

  /** Daily token budget for LLM calls (prevents runaway costs) */
  token_budget_daily: number;

  /** Daily message budget (rate limiting) */
  msg_budget_daily: number;

  /** Max number of agents for this plan */
  max_agents: number;

  /** Default language for this tenant (ISO 639-1 code, e.g., 'en', 'lv', 'ru') */
  default_language: string;

  /** JSON array of supported languages */
  languages_json: string; // JSON.stringify(['en', 'lv', 'ru'])

  /** Custom metadata (JSON) for extensions, branding, etc. */
  metadata_json: string; // JSON.stringify({...})

  /** ISO 8601 creation timestamp */
  created_at: string;

  /** ISO 8601 last update timestamp */
  updated_at: string;
}

/**
 * TenantCreateInput
 * Request payload for creating a new tenant
 */
export interface TenantCreateInput {
  name: string;
  subdomain?: string;
  plan?: 'starter' | 'pro' | 'business' | 'enterprise';
  default_language?: string;
  languages?: string[];
  metadata?: Record<string, unknown>;
}

/**
 * TenantUpdateInput
 * Request payload for updating tenant settings
 */
export interface TenantUpdateInput {
  name?: string;
  plan?: 'starter' | 'pro' | 'business' | 'enterprise';
  status?: 'active' | 'suspended' | 'cancelled';
  token_budget_daily?: number;
  msg_budget_daily?: number;
  default_language?: string;
  languages?: string[];
  metadata?: Record<string, unknown>;
}
```

### User

Represents a user account that can access one or more tenants.

```typescript
/**
 * User
 * Represents an individual user account in the system.
 * Users can be members of multiple tenants with different roles.
 */
export interface User {
  /** Unique identifier (lowercase hex, 16 bytes) */
  id: string;

  /** Email address (unique, used for login) */
  email: string;

  /** Display name */
  name: string | null;

  /** Argon2 password hash (null for OAuth-only users) */
  password_hash: string | null;

  /** Stripe customer ID (for billing) */
  stripe_customer_id: string | null;

  /** User's profile avatar URL */
  avatar_url: string | null;

  /** User's locale preference (ISO 639-1 code) */
  locale: string; // Default: 'en'

  /** ISO 8601 creation timestamp */
  created_at: string;

  /** ISO 8601 last update timestamp */
  updated_at: string;
}

/**
 * UserCreateInput
 * Request payload for user registration
 */
export interface UserCreateInput {
  email: string;
  name?: string;
  password: string;
  locale?: string;
}

/**
 * UserUpdateInput
 * Request payload for updating user profile
 */
export interface UserUpdateInput {
  name?: string;
  avatar_url?: string;
  locale?: string;
  password?: string;
}
```

### TenantUser

Join table for RBAC (Role-Based Access Control) between users and tenants.

```typescript
/**
 * TenantUser
 * Maps users to tenants with role-based permissions.
 */
export interface TenantUser {
  /** Reference to tenant ID */
  tenant_id: string;

  /** Reference to user ID */
  user_id: string;

  /**
   * User's role within this tenant
   * - 'owner': Full access, can invite/remove users, delete tenant
   * - 'admin': Can manage agents, workflows, settings
   * - 'member': Can view/edit agents and workflows
   * - 'viewer': Read-only access
   */
  role: 'owner' | 'admin' | 'member' | 'viewer';

  /** When the user was invited (ISO 8601) */
  invited_at: string;

  /** When the user accepted the invite (ISO 8601, null if pending) */
  accepted_at: string | null;
}

/**
 * TenantUserCreateInput
 * Payload for inviting a user to a tenant
 */
export interface TenantUserCreateInput {
  email: string;
  role?: 'admin' | 'member' | 'viewer';
}

/**
 * TenantUserUpdateInput
 * Payload for updating a user's role
 */
export interface TenantUserUpdateInput {
  role: 'owner' | 'admin' | 'member' | 'viewer';
}
```

### Subscription

Represents a Stripe subscription for a tenant.

```typescript
/**
 * Subscription
 * Tracks Stripe subscription state for billing.
 */
export interface Subscription {
  /** Unique identifier */
  id: string;

  /** Reference to tenant */
  tenant_id: string;

  /** Stripe subscription ID (unique) */
  stripe_subscription_id: string | null;

  /** Stripe price ID (maps to plan tier) */
  stripe_price_id: string | null;

  /**
   * Subscription status
   * - 'active': Currently valid
   * - 'past_due': Payment failed, grace period
   * - 'trialing': Free trial
   * - 'cancelled': Ended
   * - 'incomplete': Payment required
   */
  status: 'active' | 'past_due' | 'trialing' | 'cancelled' | 'incomplete';

  /** Period start (ISO 8601) */
  current_period_start: string | null;

  /** Period end (ISO 8601) */
  current_period_end: string | null;

  /** If 1, subscription will cancel at period end (soft delete) */
  cancel_at_period_end: 0 | 1;

  /** ISO 8601 creation timestamp */
  created_at: string;

  /** ISO 8601 last update timestamp */
  updated_at: string;
}
```

### ApiKey

Tenant API key for programmatic access.

```typescript
/**
 * ApiKey
 * Represents an API key for a tenant to call Global-Claw APIs.
 */
export interface ApiKey {
  /** Unique identifier */
  id: string;

  /** Reference to tenant */
  tenant_id: string;

  /** Bcrypt hash of the full key (stored for verification) */
  key_hash: string;

  /** First 8 chars of the key (for UI display, identifying which key was used) */
  key_prefix: string;

  /** Display name for this key */
  name: string;

  /** JSON array of scopes (e.g., ["read", "write", "admin"]) */
  scopes_json: string;

  /** Last time this key was used (ISO 8601, null if never) */
  last_used_at: string | null;

  /** Expiration date (ISO 8601, null = no expiry) */
  expires_at: string | null;

  /** ISO 8601 creation timestamp */
  created_at: string;
}

/**
 * ApiKeyCreateInput
 */
export interface ApiKeyCreateInput {
  name?: string;
  scopes?: string[];
  expires_at?: string;
}

/**
 * ApiKeyResponse
 * Response after creating an API key (includes the unhashed key, shown only once)
 */
export interface ApiKeyResponse extends Omit<ApiKey, 'key_hash'> {
  /** The actual API key (returned only at creation, never stored unhashed) */
  key: string;
}
```

### UsageDaily

Daily usage tracking for billing and rate limiting.

```typescript
/**
 * UsageDaily
 * Tracks daily LLM and message usage per tenant for billing & budget enforcement.
 */
export interface UsageDaily {
  /** Reference to tenant */
  tenant_id: string;

  /** Date in YYYY-MM-DD format */
  day: string;

  /** Total tokens consumed (input + output) */
  tokens_used: number;

  /** Total messages sent through agents */
  messages_sent: number;

  /** Total tool/function calls made */
  tool_calls: number;

  /** Total cost in cents (USD) */
  llm_cost_cents: number;
}
```

### LLMProvider

Represents a language model provider configuration (admin-managed, runtime-configurable).

```typescript
/**
 * LLMProvider
 * Configuration for a language model provider (Anthropic, OpenAI, Alibaba Qwen, etc.).
 * Providers are managed by admins and can be enabled/disabled at runtime.
 * All LLM calls are routed through these configurations via src/lib/llm/executor.ts.
 */
export interface LLMProvider {
  /** Unique identifier */
  id: string;

  /** Display name (e.g., "Anthropic Claude", "Alibaba Qwen") */
  name: string;

  /** URL-safe slug (e.g., "anthropic", "qwen", "openai") */
  slug: string;

  /** API base URL (e.g., "https://api.anthropic.com/v1") */
  api_base_url: string;

  /** Encrypted API key/auth token */
  api_key_encrypted: string;

  /** HTTP header name for auth (default: "Authorization") */
  auth_header: string;

  /** Auth prefix (e.g., "Bearer", "token=") */
  auth_prefix: string;

  /** JSON array of available models */
  models_json: string; // JSON.stringify(['claude-sonnet-4', 'claude-haiku-4.5'])

  /** Cost per 1 million input tokens (in USD cents) */
  cost_per_1m_input_cents: number;

  /** Cost per 1 million output tokens (in USD cents) */
  cost_per_1m_output_cents: number;

  /**
   * Cost tier for routing priority
   * - 'budget': Cost-optimized, may be slower
   * - 'standard': Good balance
   * - 'premium': High quality, higher cost
   */
  cost_tier: 'budget' | 'standard' | 'premium';

  /** Weight in routing (0-100, higher = preferred) */
  weight: number;

  /** Rate limit: max requests per minute */
  max_requests_per_min: number;

  /** If 0, provider is disabled and won't be used in routing */
  is_enabled: 0 | 1;

  /** Health score (0.0-1.0) used for circuit breaker decisions */
  health_score: number;

  /** Timestamp of last health check (ISO 8601) */
  last_health_check: string | null;

  /** Total API requests made to this provider */
  total_requests: number;

  /** Total failed requests */
  total_failures: number;

  /** Average latency in milliseconds */
  avg_latency_ms: number;

  /** ISO 8601 creation timestamp */
  created_at: string;

  /** ISO 8601 last update timestamp */
  updated_at: string;
}

/**
 * LLMProviderCreateInput
 */
export interface LLMProviderCreateInput {
  name: string;
  slug: string;
  api_base_url: string;
  api_key: string; // Will be encrypted before storage
  auth_header?: string;
  auth_prefix?: string;
  models: string[];
  cost_per_1m_input_cents?: number;
  cost_per_1m_output_cents?: number;
  cost_tier?: 'budget' | 'standard' | 'premium';
  weight?: number;
  max_requests_per_min?: number;
}

/**
 * LLMProviderUpdateInput
 */
export interface LLMProviderUpdateInput {
  name?: string;
  api_key?: string;
  models?: string[];
  cost_per_1m_input_cents?: number;
  cost_per_1m_output_cents?: number;
  weight?: number;
  is_enabled?: boolean;
}
```

### LLMRoutingRule

Conditional routing logic for provider selection.

```typescript
/**
 * LLMRoutingRule
 * Defines conditional rules for routing LLM requests to specific providers/models.
 * Evaluated in priority order during LLM routing in src/lib/llm/router.ts.
 */
export interface LLMRoutingRule {
  /** Unique identifier */
  id: string;

  /** Display name */
  name: string;

  /** Priority (higher = evaluated first) */
  priority: number;

  /** Condition JSON (evaluated against request context) */
  condition_json: string; // JSON.stringify({field: string, operator: string, value: any})

  /** Routes JSON (array of {provider_slug, model, weight}) */
  routes_json: string; // JSON.stringify([...])

  /** If 0, rule is skipped */
  is_enabled: 0 | 1;

  /** ISO 8601 creation timestamp */
  created_at: string;

  /** ISO 8601 last update timestamp */
  updated_at: string;
}

/**
 * RoutingCondition
 * Parsed condition for evaluating routing rules
 */
export interface RoutingCondition {
  /** Field to evaluate (e.g., "task_type", "language", "token_count") */
  field: string;

  /** Comparison operator ("eq", "neq", "gt", "lt", "in", "matches") */
  operator: 'eq' | 'neq' | 'gt' | 'lt' | 'in' | 'matches';

  /** Value to compare against */
  value: unknown;
}

/**
 * RoutingRoute
 * Single route option in a rule
 */
export interface RoutingRoute {
  /** Provider slug (e.g., "anthropic", "qwen") */
  provider_slug: string;

  /** Model name (e.g., "claude-sonnet-4") */
  model: string;

  /** Weight (0-100, for weighted distribution) */
  weight: number;
}

/**
 * LLMRoutingRuleCreateInput
 */
export interface LLMRoutingRuleCreateInput {
  name: string;
  priority?: number;
  condition: RoutingCondition;
  routes: RoutingRoute[];
}
```

### LLMUsageLog

Per-request LLM usage tracking.

```typescript
/**
 * LLMUsageLog
 * Detailed record of each LLM API call for analytics and billing.
 */
export interface LLMUsageLog {
  /** Unique identifier */
  id: string;

  /** Reference to tenant making the request */
  tenant_id: string;

  /** Reference to provider used */
  provider_id: string;

  /** Model name used */
  model: string;

  /** Input tokens consumed */
  input_tokens: number;

  /** Output tokens generated */
  output_tokens: number;

  /** Request latency in milliseconds */
  latency_ms: number;

  /** Cost of this request in USD cents */
  cost_cents: number;

  /**
   * Request outcome
   * - 'success': Completed normally
   * - 'error': API returned error
   * - 'timeout': Request exceeded timeout
   * - 'fallback': Failed, fell back to next provider
   */
  status: 'success' | 'error' | 'timeout' | 'fallback';

  /** Distributed trace ID (for debugging) */
  trace_id: string | null;

  /** ISO 8601 creation timestamp */
  created_at: string;
}
```

### Agent

Agent definition (registry entry in D1; live state in Durable Object).

```typescript
/**
 * Agent
 * Represents an AI agent configured for a tenant.
 * The agent definition lives in D1; runtime state and memory live in the TenantAgent Durable Object.
 */
export interface Agent {
  /** Unique identifier */
  id: string;

  /** Reference to tenant */
  tenant_id: string;

  /** Display name */
  name: string;

  /** URL-safe slug within tenant */
  slug: string;

  /** Encrypted Telegram bot token (if agent is connected to Telegram) */
  telegram_bot_token_encrypted: string | null;

  /** Telegram bot username (derived from token, for reference) */
  telegram_bot_username: string | null;

  /**
   * SOUL.md: System prompt defining agent personality, values, and core behavior
   * Markdown format, supports i18n templates
   */
  soul_md: string;

  /**
   * AGENTS.md: Detailed capabilities, skills, integrations, constraints
   * Markdown format
   */
  agents_md: string;

  /** Primary model (e.g., "claude-sonnet-4") */
  primary_model: string;

  /** Fallback model if primary fails (e.g., "qwen-2.5-72b-instruct") */
  fallback_model: string | null;

  /** Temperature for generation (0.0-2.0, default 0.7) */
  temperature: number;

  /** Max tokens per generation */
  max_tokens: number;

  /** JSON array of supported ISO 639-1 language codes */
  languages_json: string; // JSON.stringify(['en', 'lv', 'ru'])

  /** Agent avatar image URL */
  avatar_url: string | null;

  /**
   * Agent status
   * - 'active': Operating normally
   * - 'paused': Temporarily disabled
   * - 'error': Encountered critical error
   */
  status: 'active' | 'paused' | 'error';

  /** Cumulative message count */
  total_messages: number;

  /** Cumulative conversation count */
  total_conversations: number;

  /** ISO 8601 creation timestamp */
  created_at: string;

  /** ISO 8601 last update timestamp */
  updated_at: string;
}

/**
 * AgentCreateInput
 */
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

/**
 * AgentUpdateInput
 */
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
  status?: 'active' | 'paused';
}
```

### PluginConnection

OAuth token storage for integrations (1-click plugin marketplace).

```typescript
/**
 * PluginConnection
 * Represents a connected OAuth plugin (Google Calendar, Notion, Stripe, etc.).
 * OAuth tokens are encrypted. No raw API keys are stored (fail-closed design).
 * MCP (Model Context Protocol) tools are connected via these plugin connections.
 */
export interface PluginConnection {
  /** Unique identifier */
  id: string;

  /** Reference to tenant */
  tenant_id: string;

  /** Reference to agent (optional, can be shared across agents) */
  agent_id: string | null;

  /** Plugin provider slug (e.g., "google_calendar", "notion", "stripe") */
  provider: string;

  /** Display name for the user (e.g., "My Google Calendar") */
  display_name: string;

  /** Encrypted OAuth access token */
  oauth_access_token_encrypted: string | null;

  /** Encrypted OAuth refresh token */
  oauth_refresh_token_encrypted: string | null;

  /** Token expiration (ISO 8601, null if no expiry) */
  token_expires_at: string | null;

  /** JSON array of granted OAuth scopes */
  scopes_json: string; // JSON.stringify(['calendar.read', 'calendar.write'])

  /** MCP endpoint URL (for remote MCP tools) */
  mcp_endpoint_url: string | null;

  /**
   * Connection status
   * - 'connected': Valid and usable
   * - 'expired': Token expired, needs refresh
   * - 'revoked': User revoked access
   * - 'error': Last attempt failed
   */
  status: 'connected' | 'expired' | 'revoked' | 'error';

  /** Last time this connection was used (ISO 8601) */
  last_used_at: string | null;

  /** ISO 8601 creation timestamp */
  created_at: string;

  /** ISO 8601 last update timestamp */
  updated_at: string;
}

/**
 * PluginConnectionCreateInput
 * Used during OAuth callback flow
 */
export interface PluginConnectionCreateInput {
  provider: string;
  display_name?: string;
  agent_id?: string;
  access_token: string;
  refresh_token?: string;
  expires_in?: number; // Seconds until expiration
  scopes?: string[];
}
```

### Workflow

Workflow definition (visual Lobster editor).

```typescript
/**
 * Workflow
 * Represents an automation workflow (visual node-based editor).
 * Nodes represent steps (conditions, LLM calls, tool invocations, etc.).
 * Edges represent transitions between nodes.
 */
export interface Workflow {
  /** Unique identifier */
  id: string;

  /** Reference to tenant */
  tenant_id: string;

  /** Display name */
  name: string;

  /** URL-safe slug within tenant */
  slug: string;

  /** Optional description */
  description: string | null;

  /** JSON array of workflow nodes */
  nodes_json: string; // JSON.stringify([...])

  /** JSON array of workflow edges (connections) */
  edges_json: string; // JSON.stringify([...])

  /**
   * Trigger type
   * - 'manual': Started via API call
   * - 'message': Triggered by incoming message (from Telegram)
   * - 'schedule': CRON-based timing
   * - 'webhook': External webhook
   * - 'event': Cloudflare Workflow event
   */
  trigger_type: 'manual' | 'message' | 'schedule' | 'webhook' | 'event';

  /** Trigger configuration (type-specific JSON) */
  trigger_config_json: string; // JSON.stringify({...})

  /** If 0, workflow won't execute */
  is_enabled: 0 | 1;

  /** Total number of times this workflow has been run */
  total_runs: number;

  /** Timestamp of most recent run (ISO 8601) */
  last_run_at: string | null;

  /** ISO 8601 creation timestamp */
  created_at: string;

  /** ISO 8601 last update timestamp */
  updated_at: string;
}

/**
 * WorkflowNode
 * A single step in a workflow
 */
export interface WorkflowNode {
  /** Unique ID within the workflow */
  id: string;

  /**
   * Node type
   * - 'trigger': Start node (one per workflow)
   * - 'condition': Conditional branching
   * - 'action': Execute tool or agent action
   * - 'llm_call': Call an LLM for inference
   * - 'human_input': Pause for human decision
   * - 'wait': Delay execution
   * - 'sub_workflow': Call another workflow
   */
  type: 'trigger' | 'condition' | 'action' | 'llm_call' | 'human_input' | 'wait' | 'sub_workflow';

  /** Display label */
  label: string;

  /** Node configuration (type-specific) */
  config: Record<string, unknown>;

  /** Position on canvas (for UI rendering) */
  position: { x: number; y: number };
}

/**
 * WorkflowEdge
 * Connection between two workflow nodes
 */
export interface WorkflowEdge {
  /** Unique ID within the workflow */
  id: string;

  /** Source node ID */
  source: string;

  /** Target node ID */
  target: string;

  /** Optional label (e.g., "yes", "no", "error") */
  label?: string;

  /** Optional condition for this edge (evaluated at runtime) */
  condition?: Record<string, unknown>;
}

/**
 * WorkflowCreateInput
 */
export interface WorkflowCreateInput {
  name: string;
  slug?: string;
  description?: string;
  trigger_type?: 'manual' | 'message' | 'schedule' | 'webhook' | 'event';
  trigger_config?: Record<string, unknown>;
  nodes?: WorkflowNode[];
  edges?: WorkflowEdge[];
}
```

### WorkflowRun

Execution record of a workflow.

```typescript
/**
 * WorkflowRun
 * Represents a single execution of a workflow.
 * Records trigger data, result, duration, and any errors.
 */
export interface WorkflowRun {
  /** Unique identifier */
  id: string;

  /** Reference to workflow */
  workflow_id: string;

  /** Reference to tenant */
  tenant_id: string;

  /**
   * Execution status
   * - 'running': Currently executing
   * - 'completed': Finished successfully
   * - 'failed': Encountered error
   * - 'cancelled': Stopped by user
   * - 'waiting': Paused waiting for human input
   */
  status: 'running' | 'completed' | 'failed' | 'cancelled' | 'waiting';

  /** Trigger input data (JSON) */
  trigger_data_json: string | null;

  /** Final execution result (JSON) */
  result_json: string | null;

  /** Execution start time (ISO 8601) */
  started_at: string;

  /** Execution end time (ISO 8601, null if running) */
  completed_at: string | null;

  /** Total execution duration in milliseconds */
  duration_ms: number | null;

  /** Error message if failed */
  error_message: string | null;
}

/**
 * WorkflowRunCreateInput
 */
export interface WorkflowRunCreateInput {
  workflow_id: string;
  trigger_data?: Record<string, unknown>;
}
```

### FeatureFlag

Per-tenant feature toggles (Cloudflare Workflows feature enablement).

```typescript
/**
 * FeatureFlag
 * Toggleable features per tenant (e.g., "workflows", "vectorize", "mcp_tools").
 * Managed by admins, enables gradual rollout of features.
 */
export interface FeatureFlag {
  /** Reference to tenant */
  tenant_id: string;

  /** Feature name (e.g., "agents_sdk", "workflows", "vectorize") */
  feature: string;

  /** If 1, feature is enabled for this tenant */
  is_enabled: 0 | 1;

  /** Feature-specific configuration (JSON) */
  config_json: string | null;
}

/**
 * FeatureFlagUpdateInput
 */
export interface FeatureFlagUpdateInput {
  is_enabled?: boolean;
  config?: Record<string, unknown>;
}
```

### Partner & TenantPartner

Reseller program tables.

```typescript
/**
 * Partner
 * Represents a reseller or affiliate in the partner program.
 * Tiers: Affiliate → Partner → Premium → Master
 */
export interface Partner {
  /** Unique identifier */
  id: string;

  /** Reference to user account */
  user_id: string;

  /**
   * Partner tier
   * - 'affiliate': 30% recurring × 24mo
   * - 'partner': 40% off RRP (5+ active tenants)
   * - 'premium': 50% off RRP (25+ tenants OR €500 MRR, includes white-label)
   * - 'master': 55% off RRP + 10% override (50+ tenants OR 5 sub-resellers)
   */
  tier: 'affiliate' | 'partner' | 'premium' | 'master';

  /** Company name */
  company_name: string | null;

  /** Unique referral code for tracking */
  referral_code: string;

  /** Commission rate (0.0-1.0, e.g., 0.30 = 30%) */
  commission_rate: number;

  /** Total tenants referred by this partner */
  total_referrals: number;

  /** Total earnings in USD cents */
  total_earnings_cents: number;

  /** Reference to parent partner (for sub-resellers) */
  parent_partner_id: string | null;

  /**
   * Status
   * - 'active': Partner is active
   * - 'inactive': Partner account paused
   * - 'suspended': Partner suspended due to violation
   */
  status: 'active' | 'inactive' | 'suspended';

  /** ISO 8601 creation timestamp */
  created_at: string;

  /** ISO 8601 last update timestamp */
  updated_at: string;
}

/**
 * TenantPartner
 * Maps tenants to the partner who referred them.
 */
export interface TenantPartner {
  /** Reference to tenant */
  tenant_id: string;

  /** Reference to partner */
  partner_id: string;

  /** When the referral was made (ISO 8601) */
  referred_at: string;
}

/**
 * PartnerCreateInput
 */
export interface PartnerCreateInput {
  company_name?: string;
  tier?: 'affiliate' | 'partner' | 'premium' | 'master';
}
```

---

## API Request/Response Types

### Standard Envelopes

```typescript
/**
 * ApiResponse
 * Standard success response envelope for all API endpoints.
 */
export interface ApiResponse<T> {
  /** Always true for successful responses */
  success: true;

  /** The response data */
  data: T;
}

/**
 * ApiError
 * Standard error details.
 */
export interface ApiError {
  /** Machine-readable error code (e.g., "NOT_FOUND", "UNAUTHORIZED", "VALIDATION_ERROR") */
  code: string;

  /** Human-readable error message */
  message: string;

  /** Optional additional details (validation errors, nested objects, etc.) */
  details?: Record<string, unknown> | string[];
}

/**
 * ApiErrorResponse
 * Standard error response envelope.
 */
export interface ApiErrorResponse {
  /** Always false for error responses */
  success: false;

  /** Error information */
  error: ApiError;
}

/**
 * PaginatedResponse
 * Response for list endpoints with pagination.
 */
export interface PaginatedResponse<T> {
  /** Array of items */
  items: T[];

  /** Total count of all items (not just current page) */
  total: number;

  /** Current page number (1-indexed) */
  page: number;

  /** Items per page */
  per_page: number;

  /** Total number of pages */
  total_pages: number;

  /** Has next page? */
  has_next: boolean;

  /** Has previous page? */
  has_prev: boolean;
}

/**
 * PaginationQuery
 * Standard pagination parameters for list endpoints.
 */
export interface PaginationQuery {
  /** Page number (1-indexed, default: 1) */
  page?: number | string;

  /** Items per page (default: 20, max: 100) */
  per_page?: number | string;

  /** Sort field (e.g., "created_at") */
  sort_by?: string;

  /** Sort direction ("asc" or "desc") */
  sort_order?: 'asc' | 'desc';
}
```

### Authentication

```typescript
/**
 * LoginRequest
 */
export interface LoginRequest {
  /** Email address */
  email: string;

  /** Password */
  password: string;
}

/**
 * RegisterRequest
 */
export interface RegisterRequest {
  /** Email address */
  email: string;

  /** Full name */
  name?: string;

  /** Password */
  password: string;

  /** Locale preference */
  locale?: string;
}

/**
 * TokenResponse
 * Returned after successful login/register.
 */
export interface TokenResponse {
  /** JWT access token (short-lived, ~15 min) */
  access_token: string;

  /** JWT refresh token (long-lived, ~7 days) */
  refresh_token: string;

  /** Token type (always "Bearer") */
  token_type: string;

  /** Token expiration in seconds */
  expires_in: number;

  /** Authenticated user info */
  user: Omit<User, 'password_hash'>;
}

/**
 * RefreshTokenRequest
 */
export interface RefreshTokenRequest {
  /** Refresh token from previous login */
  refresh_token: string;
}
```

---

## LLM Router Types

All LLM calls must go through `src/lib/llm/executor.ts` (fail-closed governance).

```typescript
/**
 * LLMRequest
 * Request to the LLM executor.
 */
export interface LLMRequest {
  /** Distributed trace ID (for debugging) */
  trace_id: string;

  /** Tenant ID (for budget enforcement) */
  tenant_id: string;

  /** User messages (conversation history + current input) */
  messages: LLMMessage[];

  /**
   * Task type (used for routing decisions)
   * - 'simple_chat': General conversation
   * - 'complex_reasoning': Multi-step reasoning
   * - 'translation': Language translation
   * - 'code_generation': Writing code
   * - 'summarization': Text summarization
   * - etc.
   */
  task_type?: string;

  /** Optional system prompt override */
  system?: string;

  /** Optional model override (default uses routing rules) */
  model?: string;

  /** Optional provider override (default uses routing) */
  provider?: string;

  /** Generation temperature (0.0-2.0) */
  temperature?: number;

  /** Max output tokens */
  max_tokens?: number;

  /** Stop sequences */
  stop_sequences?: string[];

  /** Tool/function definitions */
  tools?: LLMTool[];

  /** Context data for routing decisions */
  context?: {
    language?: string;
    user_id?: string;
    agent_id?: string;
    token_budget_remaining?: number;
    [key: string]: unknown;
  };

  /** Timeout in milliseconds (default: 30000) */
  timeout_ms?: number;

  /** Whether to allow fallback to secondary providers */
  allow_fallback?: boolean;
}

/**
 * LLMMessage
 * Single message in conversation history.
 */
export interface LLMMessage {
  /**
   * Role of the message sender
   * - 'system': System instruction
   * - 'user': User input
   * - 'assistant': AI response
   * - 'tool': Tool result
   */
  role: 'system' | 'user' | 'assistant' | 'tool';

  /** Message content */
  content: string | LLMMessageContent[];

  /** Tool call ID (for 'tool' role messages) */
  tool_use_id?: string;
}

/**
 * LLMMessageContent
 * Content block (for multimodal support).
 */
export type LLMMessageContent =
  | { type: 'text'; text: string }
  | { type: 'image'; image_url: string; detail?: 'low' | 'high' }
  | { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> }
  | { type: 'tool_result'; tool_use_id: string; content: string; is_error?: boolean };

/**
 * LLMTool
 * Tool definition for the LLM.
 */
export interface LLMTool {
  /** Tool name */
  name: string;

  /** Tool description */
  description: string;

  /** Input schema (JSON Schema format) */
  input_schema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

/**
 * LLMResponse
 * Response from the LLM executor.
 */
export interface LLMResponse {
  /** Distributed trace ID (matches request) */
  trace_id: string;

  /** Provider that was actually used */
  provider: {
    name: string;
    slug: string;
    model: string;
  };

  /** Generated text content */
  content: string;

  /**
   * Stop reason
   * - 'end_turn': Model finished naturally
   * - 'max_tokens': Hit token limit
   * - 'tool_use': Model called a tool
   * - 'stop_sequence': Hit a stop sequence
   */
  stop_reason: 'end_turn' | 'max_tokens' | 'tool_use' | 'stop_sequence';

  /** Tool calls (if any) */
  tool_calls?: Array<{ id: string; name: string; input: Record<string, unknown> }>;

  /** Token usage */
  usage: {
    input_tokens: number;
    output_tokens: number;
  };

  /** Request latency in milliseconds */
  latency_ms: number;

  /** Cost of this request in USD cents */
  cost_cents: number;

  /** Timestamp of request completion (ISO 8601) */
  completed_at: string;
}

/**
 * RoutingDecision
 * Result of the routing evaluation process.
 */
export interface RoutingDecision {
  /** Primary provider to use */
  provider: LLMProvider;

  /** Model to use from that provider */
  model: string;

  /** Array of fallback providers (in order) */
  fallbacks: Array<{ provider: LLMProvider; model: string }>;

  /** Reason for this decision (for debugging) */
  reason: string;

  /** Matched routing rule ID (if any) */
  rule_id?: string;
}

/**
 * CircuitBreakerState
 * Tracks health of a provider for circuit breaker logic.
 */
export interface CircuitBreakerState {
  /** Provider ID */
  provider_id: string;

  /**
   * State
   * - 'closed': Operating normally
   * - 'open': Provider is failing, requests immediately rejected
   * - 'half_open': Testing if provider has recovered
   */
  state: 'closed' | 'open' | 'half_open';

  /** Number of consecutive failures */
  failure_count: number;

  /** Time when state was last changed (ISO 8601) */
  last_state_change: string;

  /** Time until next retry attempt (ISO 8601, null if closed) */
  next_retry_at: string | null;

  /** Health score (0.0-1.0) */
  health_score: number;
}

/**
 * ProviderAdapter
 * Interface that all provider adapters must implement.
 * Located in src/lib/llm/providers/*.ts
 */
export interface ProviderAdapter {
  /** Provider slug */
  slug: string;

  /** Initialize the adapter with provider config */
  initialize(provider: LLMProvider): Promise<void>;

  /** Call the provider's LLM API */
  call(request: LLMRequest): Promise<LLMResponse>;

  /** Perform a health check on the provider */
  healthCheck(): Promise<{ healthy: boolean; latency_ms: number }>;

  /** Parse errors from the provider's response */
  parseError(error: unknown): { code: string; message: string; retriable: boolean };
}
```

---

## Tenant Agent (Durable Object) Types

The `TenantAgent` Durable Object is the per-tenant state container. It lives in Cloudflare's distributed system.

```typescript
/**
 * TenantAgentState
 * SQLite schema created inside each Durable Object instance.
 * This is the persistent state for a single tenant's agent behavior.
 */
export interface TenantAgentState {
  /**
   * conversations table
   * Stores conversation history with users (from Telegram, etc.).
   */
  conversations: Array<{
    id: string; // Unique conversation ID
    user_id: string; // Telegram user ID
    agent_id: string; // Which agent this conversation is with
    message_count: number;
    first_message_at: string; // ISO 8601
    last_message_at: string; // ISO 8601
    status: 'active' | 'archived' | 'blocked';
  }>;

  /**
   * conversation_messages table
   * Individual messages within a conversation.
   */
  conversation_messages: ConversationMessage[];

  /**
   * memory_facts table
   * Long-term factual knowledge about users/entities.
   */
  memory_facts: MemoryFact[];

  /**
   * embeddings table
   * Vector embeddings of important content (for semantic search).
   */
  embeddings: Array<{
    id: string;
    fact_id: string | null;
    message_id: string | null;
    vector: number[]; // Embedding vector (dimensionality varies)
    created_at: string;
  }>;

  /**
   * rate_limit table
   * Tracks request rates per user/tenant.
   */
  rate_limit: Array<{
    user_id: string;
    bucket: string; // e.g., "messages_per_min", "tokens_per_day"
    count: number;
    window_start: string; // ISO 8601
  }>;

  /**
   * budget_usage table
   * Tracks token and message budget consumption.
   */
  budget_usage: Array<{
    date: string; // YYYY-MM-DD
    tokens_used: number;
    messages_sent: number;
  }>;
}

/**
 * ConversationMessage
 * Single message in a conversation.
 */
export interface ConversationMessage {
  /** Unique message ID */
  id: string;

  /** Reference to conversation */
  conversation_id: string;

  /** Who sent it ("user" or "assistant") */
  role: 'user' | 'assistant' | 'system';

  /** Message text */
  content: string;

  /** Message tokens (estimated or actual) */
  tokens: number;

  /** Timestamp (ISO 8601) */
  created_at: string;

  /** If tool was called, the tool name */
  tool_name?: string;

  /** If tool was called, the tool input */
  tool_input?: Record<string, unknown>;

  /** If tool result returned, the result */
  tool_result?: unknown;

  /** Message embedding vector (for semantic search) */
  embedding?: number[];
}

/**
 * MemoryFact
 * Long-term knowledge stored about users or entities.
 */
export interface MemoryFact {
  /** Unique fact ID */
  id: string;

  /** Who/what this fact is about (entity name) */
  entity: string;

  /** Type of fact ("user_preference", "user_profile", "workflow", "faq", etc.) */
  type: string;

  /** The actual knowledge statement */
  content: string;

  /** Confidence score (0.0-1.0) */
  confidence: number;

  /** Number of times this fact has been used/reinforced */
  usage_count: number;

  /** Timestamp of last usage */
  last_used_at: string;

  /** When this fact was learned (ISO 8601) */
  learned_at: string;

  /** Source (e.g., "conversation_id", "admin_input", "workflow") */
  source: string;

  /** Embedding for semantic search */
  embedding?: number[];
}

/**
 * AgentConfig
 * Configuration for an agent that lives in the DO state.
 */
export interface AgentConfig {
  /** Agent ID (from D1) */
  id: string;

  /** Tenant ID */
  tenant_id: string;

  /** SOUL.md (system prompt) */
  system_prompt: string;

  /** Agent capabilities/description */
  capabilities: string;

  /** Current model selection */
  model: string;

  /** Fallback model */
  fallback_model: string | null;

  /** Generation temperature */
  temperature: number;

  /** Max tokens per response */
  max_tokens: number;

  /** Supported languages */
  languages: string[];

  /** Currently enabled tools/plugins */
  enabled_tools: string[];

  /** Rate limit config */
  rate_limits: {
    messages_per_minute: number;
    tokens_per_day: number;
  };
}

/**
 * DOInitSchema
 * Describes the SQL tables created in a Durable Object's local SQLite.
 */
export interface DOInitSchema {
  conversations: string; // CREATE TABLE conversations (...)
  conversation_messages: string;
  memory_facts: string;
  embeddings: string;
  rate_limit: string;
  budget_usage: string;
}
```

---

## Worker Environment Bindings

All Cloudflare bindings available to the Worker.

```typescript
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

  /** Workflows binding for tenant provisioning (matches wrangler.jsonc binding name) */
  PROVISIONING_WORKFLOW: Workflow;

  // Encryption
  /** Environment variable: encryption key for sensitive data (base64-encoded 32 bytes) */
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
  /** Google OAuth client ID (optional — only if Google integrations enabled) */
  GOOGLE_OAUTH_CLIENT_ID?: string;
  /** Google OAuth client secret */
  GOOGLE_OAUTH_CLIENT_SECRET?: string;
  /** Notion OAuth client ID (optional — only if Notion integration enabled) */
  NOTION_OAUTH_CLIENT_ID?: string;
  /** Notion OAuth client secret */
  NOTION_OAUTH_CLIENT_SECRET?: string;

  // Configuration
  /** Current environment name ("development", "staging", "production") */
  ENVIRONMENT: "development" | "staging" | "production";

  /** API base URL for this environment (e.g., https://api.global-claw.com) */
  APP_URL: string;

  /** Dashboard base URL for this environment (e.g., https://app.global-claw.com) */
  DASHBOARD_URL: string;

  /** AI Gateway slug used by the LLM executor */
  AI_GATEWAY_SLUG?: string;
}

/**
 * D1Database
 * SQLite database binding (Cloudflare D1).
 * Provided by Cloudflare, includes execute() and batch() methods.
 */
export interface D1Database {
  prepare(sql: string): Statement;
}

/**
 * Statement
 * SQL statement to be executed.
 */
export interface Statement {
  bind(...params: unknown[]): Statement;
  first(): Promise<Record<string, unknown> | undefined>;
  all(): Promise<{ results: Record<string, unknown>[] }>;
  run(): Promise<{ success: boolean }>;
}

/**
 * DurableObjectNamespace
 * Durable Object stub factory.
 */
export interface DurableObjectNamespace {
  get(id: string | DurableObjectId): DurableObjectStub;
  idFromName(name: string): DurableObjectId;
  idFromString(id: string): DurableObjectId;
}

/**
 * DurableObjectStub
 * Stub for calling methods on a Durable Object.
 */
export interface DurableObjectStub {
  fetch(request: Request): Promise<Response>;
}

/**
 * DurableObjectId
 * Unique identifier for a Durable Object.
 */
export interface DurableObjectId {
  toString(): string;
}

/**
 * R2Bucket
 * Object storage bucket binding.
 */
export interface R2Bucket {
  get(key: string): Promise<R2Object | null>;
  put(key: string, value: ReadableStream<Uint8Array> | ArrayBuffer | string, options?: {
    customMetadata?: Record<string, string>;
    httpMetadata?: { contentType?: string; cacheControl?: string };
  }): Promise<R2Object>;
  delete(key: string): Promise<void>;
  list(options?: { prefix?: string; limit?: number }): Promise<R2Objects>;
}

/**
 * R2Object
 * Object metadata from R2.
 */
export interface R2Object {
  key: string;
  version: string;
  size: number;
  etag: string;
  httpEtag: string;
  range?: { offset: number; length: number };
  uploaded: Date;
  httpMetadata?: { contentType?: string; cacheControl?: string };
  customMetadata?: Record<string, string>;
  body: ReadableStream<Uint8Array>;
  bodyUsed: boolean;
  text(): Promise<string>;
  json(): Promise<Record<string, unknown>>;
  arrayBuffer(): Promise<ArrayBuffer>;
}

/**
 * R2Objects
 * List response from R2.
 */
export interface R2Objects {
  objects: R2Object[];
  truncated: boolean;
  cursor?: string;
  delimitedPrefixes?: string[];
}

/**
 * KVNamespace
 * Key-value storage binding.
 */
export interface KVNamespace {
  get(key: string, options?: { type?: 'text' | 'json' | 'arrayBuffer' | 'stream' }): Promise<unknown>;
  put(key: string, value: string | ArrayBuffer, options?: {
    expirationTtl?: number;
    metadata?: Record<string, string>;
  }): Promise<void>;
  delete(key: string): Promise<void>;
  getWithMetadata(key: string, options?: { type?: 'text' | 'json' | 'arrayBuffer' }): Promise<{
    value: unknown;
    metadata: Record<string, string> | null;
  }>;
}

/**
 * Queue
 * Message queue producer binding.
 */
export interface Queue {
  send(messages: QueueMessage | QueueMessage[], options?: { contentType?: string; delaySeconds?: number }): Promise<void>;
}

/**
 * QueueMessage
 * Message to send to a queue.
 */
export interface QueueMessage {
  body: unknown;
}

/**
 * Ai
 * Workers AI binding for running models.
 */
export interface Ai {
  run(modelName: string, input: Record<string, unknown>, options?: {
    gateway?: { id: string; headers?: Record<string, string> };
    cache?: 'default' | 'bypass';
  }): Promise<Record<string, unknown>>;
}

/**
 * WorkflowsNamespace
 * Workflows binding for long-running tasks.
 */
export interface WorkflowsNamespace {
  create(workflowName: string, workflow: Record<string, unknown>): Promise<{ id: string }>;
  get(workflowName: string, id: string): Promise<{ status: string; output: unknown }>;
}
```

---

## Telegram Types

Telegram-specific types for the webhook handler.

```typescript
/**
 * TelegramUpdate
 * Update message from Telegram webhook.
 */
export interface TelegramUpdate {
  /** Unique update identifier */
  update_id: number;

  /** Incoming message (if this is a message update) */
  message?: TelegramMessage;

  /** Callback query (if this is a callback button press) */
  callback_query?: TelegramCallbackQuery;

  /** Edited message (if a message was edited) */
  edited_message?: TelegramMessage;

  /** Channel post (for channels) */
  channel_post?: TelegramMessage;
}

/**
 * TelegramMessage
 * Message received from a Telegram user.
 */
export interface TelegramMessage {
  /** Unique message ID */
  message_id: number;

  /** Sender user info */
  from: TelegramUser;

  /** Chat where message was sent */
  chat: TelegramChat;

  /** Unix timestamp of message */
  date: number;

  /** Message text (for text messages) */
  text?: string;

  /** Document (file) */
  document?: TelegramDocument;

  /** Photo */
  photo?: TelegramPhotoSize[];

  /** Voice message */
  voice?: TelegramAudio;

  /** Audio file */
  audio?: TelegramAudio;

  /** Video file */
  video?: TelegramVideo;

  /** Sticker */
  sticker?: TelegramSticker;

  /** Location */
  location?: { latitude: number; longitude: number };

  /** Venue */
  venue?: {
    location: { latitude: number; longitude: number };
    title: string;
    address: string;
  };

  /** Contact */
  contact?: { phone_number: string; first_name: string; last_name?: string; user_id?: number };

  /** Reply to another message */
  reply_to_message?: TelegramMessage;

  /** Message edit timestamp (if edited) */
  edit_date?: number;
}

/**
 * TelegramUser
 * User information in Telegram.
 */
export interface TelegramUser {
  /** Unique Telegram user ID */
  id: number;

  /** Whether user is a bot */
  is_bot: boolean;

  /** User's first name */
  first_name: string;

  /** User's last name */
  last_name?: string;

  /** Username (without @) */
  username?: string;

  /** User's language code (ISO 639-1) */
  language_code?: string;

  /** Whether user is a Telegram Premium subscriber */
  is_premium?: boolean;
}

/**
 * TelegramChat
 * Chat where message was sent (could be private chat or group).
 */
export interface TelegramChat {
  /** Unique chat ID */
  id: number;

  /**
   * Chat type
   * - 'private': Direct message with a user
   * - 'group': Group chat
   * - 'supergroup': Supergroup (up to 200k users)
   * - 'channel': Channel
   */
  type: 'private' | 'group' | 'supergroup' | 'channel';

  /** Chat title (for groups/channels) */
  title?: string;

  /** Username (for private chats & channels) */
  username?: string;

  /** First name (for private chats) */
  first_name?: string;

  /** Last name (for private chats) */
  last_name?: string;

  /** Invite link (for channels) */
  invite_link?: string;
}

/**
 * TelegramCallbackQuery
 * Result of user pressing an inline button.
 */
export interface TelegramCallbackQuery {
  /** Unique query ID */
  id: string;

  /** User who pressed the button */
  from: TelegramUser;

  /** Message that had the button */
  message?: TelegramMessage;

  /** Data associated with the button */
  data?: string;

  /** Inline keyboard callback data */
  inline_message_id?: string;

  /** Chat instance */
  chat_instance: string;
}

/**
 * TelegramDocument
 * File/document metadata.
 */
export interface TelegramDocument {
  /** File unique ID */
  file_unique_id: string;

  /** File ID (use this to download) */
  file_id: string;

  /** File size in bytes */
  file_size?: number;

  /** MIME type */
  mime_type?: string;

  /** File name */
  file_name?: string;

  /** Thumbnail */
  thumb?: TelegramPhotoSize;
}

/**
 * TelegramPhotoSize
 * Photo dimensions and file info.
 */
export interface TelegramPhotoSize {
  file_unique_id: string;
  file_id: string;
  width: number;
  height: number;
  file_size?: number;
}

/**
 * TelegramAudio
 * Audio/voice file metadata.
 */
export interface TelegramAudio {
  file_unique_id: string;
  file_id: string;
  duration: number; // Duration in seconds
  performer?: string;
  title?: string;
  mime_type?: string;
  file_size?: number;
  thumb?: TelegramPhotoSize;
}

/**
 * TelegramVideo
 * Video file metadata.
 */
export interface TelegramVideo {
  file_unique_id: string;
  file_id: string;
  width: number;
  height: number;
  duration: number;
  thumb?: TelegramPhotoSize;
  mime_type?: string;
  file_size?: number;
}

/**
 * TelegramSticker
 * Sticker metadata.
 */
export interface TelegramSticker {
  file_unique_id: string;
  file_id: string;
  type: 'regular' | 'mask' | 'custom_emoji';
  width: number;
  height: number;
  is_animated: boolean;
  is_video: boolean;
  thumb?: TelegramPhotoSize;
  emoji?: string;
  file_size?: number;
}

/**
 * TelegramSendMessage
 * Payload for sending a message via Telegram API.
 */
export interface TelegramSendMessage {
  /** Chat ID to send to */
  chat_id: number | string;

  /** Message text */
  text: string;

  /** Markdown or HTML for formatting */
  parse_mode?: 'Markdown' | 'HTML' | 'MarkdownV2';

  /** Inline keyboard layout */
  reply_markup?: { inline_keyboard: TelegramInlineButton[][] };

  /** Disable link previews */
  disable_web_page_preview?: boolean;

  /** Reply to specific message */
  reply_to_message_id?: number;
}

/**
 * TelegramInlineButton
 * Button in an inline keyboard.
 */
export interface TelegramInlineButton {
  /** Button text */
  text: string;

  /** URL to open */
  url?: string;

  /** Callback data sent when pressed */
  callback_data?: string;

  /** Switch inline query */
  switch_inline_query?: string;

  /** Inline query in current chat */
  switch_inline_query_current_chat?: string;

  /** Pay button */
  pay?: boolean;
}
```

---

## WebSocket Event Types

Real-time events pushed to connected dashboard clients.

```typescript
/**
 * WSMessage
 * Discriminated union of all possible WebSocket message types.
 */
export type WSMessage =
  | WSConnectionMessage
  | WSErrorMessage
  | WSAgentStatusMessage
  | WSMessageCountMessage
  | WSLLMCallMessage
  | WSWorkflowRunMessage
  | WSMemoryUpdateMessage
  | WSBudgetAlertMessage
  | WSUserPresenceMessage;

/**
 * WSConnectionMessage
 * Sent when client connects.
 */
export interface WSConnectionMessage {
  type: 'connection';
  tenant_id: string;
  connection_id: string;
  timestamp: string;
}

/**
 * WSErrorMessage
 * Sent when an error occurs.
 */
export interface WSErrorMessage {
  type: 'error';
  code: string;
  message: string;
  timestamp: string;
}

/**
 * WSAgentStatusMessage
 * Agent status changed (online/offline/error).
 */
export interface WSAgentStatusMessage {
  type: 'agent_status_changed';
  agent_id: string;
  status: 'active' | 'paused' | 'error';
  reason?: string;
  timestamp: string;
}

/**
 * WSMessageCountMessage
 * Agent processed a message.
 */
export interface WSMessageCountMessage {
  type: 'message_count_updated';
  agent_id: string;
  total_messages: number;
  messages_today: number;
  timestamp: string;
}

/**
 * WSLLMCallMessage
 * LLM call completed.
 */
export interface WSLLMCallMessage {
  type: 'llm_call_completed';
  agent_id: string;
  provider: string;
  model: string;
  tokens_used: number;
  cost_cents: number;
  latency_ms: number;
  trace_id: string;
  timestamp: string;
}

/**
 * WSWorkflowRunMessage
 * Workflow run status changed.
 */
export interface WSWorkflowRunMessage {
  type: 'workflow_run_updated';
  workflow_id: string;
  run_id: string;
  status: 'running' | 'completed' | 'failed' | 'cancelled' | 'waiting';
  progress?: { current_node: string; total_nodes: number };
  result?: Record<string, unknown>;
  error?: { message: string; code: string };
  timestamp: string;
}

/**
 * WSMemoryUpdateMessage
 * Long-term memory was updated.
 */
export interface WSMemoryUpdateMessage {
  type: 'memory_updated';
  agent_id: string;
  entity: string;
  action: 'learned' | 'updated' | 'removed';
  fact_type: string;
  timestamp: string;
}

/**
 * WSBudgetAlertMessage
 * Budget usage alert.
 */
export interface WSBudgetAlertMessage {
  type: 'budget_alert';
  alert_level: 'warning' | 'critical';
  tokens_used_today: number;
  tokens_budget_daily: number;
  messages_sent_today: number;
  messages_budget_daily: number;
  cost_today_cents: number;
  timestamp: string;
}

/**
 * WSUserPresenceMessage
 * User presence changed (for collaborative features).
 */
export interface WSUserPresenceMessage {
  type: 'user_presence';
  user_id: string;
  presence: 'online' | 'offline' | 'idle';
  timestamp: string;
}
```

---

## Middleware Context Types

Types attached to request context by middleware.

```typescript
/**
 * TenantContext
 * Attached to Hono context after auth middleware.
 * Represents the authenticated tenant and user making the request.
 */
export interface TenantContext {
  /** Authenticated user */
  user: User & { password_hash?: never }; // Exclude password hash

  /** User's tenants with their roles */
  tenants: Array<{
    tenant: Tenant;
    role: 'owner' | 'admin' | 'member' | 'viewer';
  }>;

  /** Currently selected tenant (can switch between tenants) */
  current_tenant: Tenant;

  /** User's role in the current tenant */
  current_role: 'owner' | 'admin' | 'member' | 'viewer';

  /** API key if authenticated via API key (instead of JWT) */
  api_key?: Omit<ApiKey, 'key_hash' | 'scopes_json'> & { scopes: string[] };

  /** Trace ID for debugging */
  trace_id: string;

  /** Request timestamp */
  request_at: string;
}

/**
 * HonoContext
 * Extended Hono Context with Global-Claw additions.
 */
export interface HonoContextExt {
  /** Bound environment variables */
  env: Env;

  /** Extracted tenant context (null if unauthenticated) */
  tenant?: TenantContext;

  /** Request ID for logging */
  req_id: string;
}
```

---

## Utility & Helper Types

```typescript
/**
 * DeepPartial
 * Makes all properties of T optional recursively.
 */
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

/**
 * Nullable
 * Makes a type nullable.
 */
export type Nullable<T> = T | null;

/**
 * AsyncResult
 * Result of an async operation (success or error).
 */
export type AsyncResult<T, E = ApiError> =
  | { ok: true; data: T }
  | { ok: false; error: E };

/**
 * Pagination helpers
 */
export interface PaginationMeta {
  page: number;
  per_page: number;
  total: number;
  total_pages: number;
}

/**
 * Rate limit info
 */
export interface RateLimitInfo {
  /** Requests remaining in this window */
  remaining: number;

  /** Requests allowed per window */
  limit: number;

  /** Unix timestamp when the window resets */
  reset_at: number;

  /** Whether rate limit was exceeded */
  exceeded: boolean;
}

/**
 * BudgetInfo
 * Current budget usage for a tenant.
 */
export interface BudgetInfo {
  /** Tokens used today */
  tokens_used_today: number;

  /** Daily token budget */
  tokens_budget_daily: number;

  /** Tokens remaining */
  tokens_remaining: number;

  /** Messages sent today */
  messages_sent_today: number;

  /** Daily message budget */
  messages_budget_daily: number;

  /** Messages remaining */
  messages_remaining: number;

  /** Estimated cost today (USD cents) */
  cost_today_cents: number;

  /** Cost threshold for warnings (USD cents) */
  cost_warning_threshold_cents: number;

  /** Percentage of budget used (0-100) */
  usage_percentage: number;
}

/**
 * HealthCheckResult
 */
export interface HealthCheckResult {
  /** Overall system health */
  status: 'healthy' | 'degraded' | 'unhealthy';

  /** D1 database status */
  database: { status: 'ok' | 'error'; latency_ms: number };

  /** Durable Objects status */
  durable_objects: { status: 'ok' | 'error' };

  /** LLM providers status */
  llm_providers: Array<{
    provider: string;
    status: 'ok' | 'error' | 'degraded';
    health_score: number;
  }>;

  /** Queue status */
  queues: { status: 'ok' | 'error' };

  /** R2 storage status */
  r2: { status: 'ok' | 'error' };

  /** Timestamp of check (ISO 8601) */
  checked_at: string;
}
```

---

## Summary

This specification document provides:

1. **Complete database model interfaces** matching the D1 schema
2. **All API request/response envelopes** for standard REST communication
3. **LLM router types** for the fail-closed governance architecture
4. **Durable Object state types** for per-tenant agent persistence
5. **Cloudflare binding definitions** matching wrangler.jsonc
6. **Telegram webhook types** for the bot integration
7. **WebSocket event types** for real-time dashboard updates
8. **Middleware context types** for request authentication

All interfaces are documented with JSDoc comments explaining field purposes, values, and relationships. Use these types as the single source of truth during the one-shot build to ensure consistency across all components.

---

**Last Updated:** 2026-03-05
**For:** Global-Claw One-Shot Build
**Status:** Complete Foundation Reference
