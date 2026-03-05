-- Global-Claw D1 Schema — Agent & Memory Tables
-- Migration 0003: Agent definitions, plugins, memory, workflows

-- Agent definitions (global registry, state lives in DO)
CREATE TABLE IF NOT EXISTS agents (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  telegram_bot_token_encrypted TEXT,
  telegram_bot_username TEXT,
  soul_md TEXT NOT NULL DEFAULT '# Agent\nYou are a helpful assistant.',
  agents_md TEXT NOT NULL DEFAULT '# Capabilities\n- General conversation',
  primary_model TEXT NOT NULL DEFAULT 'claude-sonnet-4',
  fallback_model TEXT,
  temperature REAL NOT NULL DEFAULT 0.7 CHECK (temperature >= 0.0 AND temperature <= 2.0),
  max_tokens INTEGER NOT NULL DEFAULT 4096,
  languages_json TEXT NOT NULL DEFAULT '["en"]',
  avatar_url TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'error')),
  total_messages INTEGER NOT NULL DEFAULT 0,
  total_conversations INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(tenant_id, slug)
);

-- Plugin connections (OAuth tokens per agent)
CREATE TABLE IF NOT EXISTS plugin_connections (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  agent_id TEXT REFERENCES agents(id) ON DELETE SET NULL,
  provider TEXT NOT NULL,
  display_name TEXT NOT NULL,
  oauth_access_token_encrypted TEXT,
  oauth_refresh_token_encrypted TEXT,
  token_expires_at TEXT,
  scopes_json TEXT NOT NULL DEFAULT '[]',
  mcp_endpoint_url TEXT,
  status TEXT NOT NULL DEFAULT 'connected' CHECK (status IN ('connected', 'expired', 'revoked', 'error')),
  last_used_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Workflow definitions
CREATE TABLE IF NOT EXISTS workflows (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  nodes_json TEXT NOT NULL DEFAULT '[]',
  edges_json TEXT NOT NULL DEFAULT '[]',
  trigger_type TEXT NOT NULL DEFAULT 'manual' CHECK (trigger_type IN ('manual', 'message', 'schedule', 'webhook', 'event')),
  trigger_config_json TEXT DEFAULT '{}',
  is_enabled INTEGER NOT NULL DEFAULT 1,
  total_runs INTEGER NOT NULL DEFAULT 0,
  last_run_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(tenant_id, slug)
);

-- Workflow run history
CREATE TABLE IF NOT EXISTS workflow_runs (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  workflow_id TEXT NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  tenant_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed', 'cancelled', 'waiting')),
  trigger_data_json TEXT,
  result_json TEXT,
  started_at TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at TEXT,
  duration_ms INTEGER,
  error_message TEXT
);

-- Feature flags (per-tenant Cloudflare feature toggles)
CREATE TABLE IF NOT EXISTS feature_flags (
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  feature TEXT NOT NULL,
  is_enabled INTEGER NOT NULL DEFAULT 0,
  config_json TEXT DEFAULT '{}',
  PRIMARY KEY (tenant_id, feature)
);

-- Reseller/Partner program
CREATE TABLE IF NOT EXISTS partners (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id TEXT NOT NULL REFERENCES users(id),
  tier TEXT NOT NULL DEFAULT 'affiliate' CHECK (tier IN ('affiliate', 'partner', 'premium', 'master')),
  company_name TEXT,
  referral_code TEXT UNIQUE NOT NULL,
  commission_rate REAL NOT NULL DEFAULT 0.30,
  total_referrals INTEGER NOT NULL DEFAULT 0,
  total_earnings_cents INTEGER NOT NULL DEFAULT 0,
  parent_partner_id TEXT REFERENCES partners(id),
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Tenant-Partner mapping
CREATE TABLE IF NOT EXISTS tenant_partners (
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  partner_id TEXT NOT NULL REFERENCES partners(id),
  referred_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (tenant_id, partner_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_agents_tenant ON agents(tenant_id);
CREATE INDEX IF NOT EXISTS idx_agents_status ON agents(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_plugin_connections_tenant ON plugin_connections(tenant_id);
CREATE INDEX IF NOT EXISTS idx_plugin_connections_agent ON plugin_connections(agent_id);
CREATE INDEX IF NOT EXISTS idx_workflows_tenant ON workflows(tenant_id);
CREATE INDEX IF NOT EXISTS idx_workflow_runs_workflow ON workflow_runs(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_runs_tenant ON workflow_runs(tenant_id, started_at);
CREATE INDEX IF NOT EXISTS idx_feature_flags_tenant ON feature_flags(tenant_id);
CREATE INDEX IF NOT EXISTS idx_partners_referral ON partners(referral_code);
CREATE INDEX IF NOT EXISTS idx_partners_user ON partners(user_id);
CREATE INDEX IF NOT EXISTS idx_tenant_partners_partner ON tenant_partners(partner_id);

-- Seed default feature flags for new tenants
-- (Applied during provisioning workflow)
-- Features: agents_sdk, workflows, vectorize, browser_rendering, ai_gateway,
-- realtime_sync, email_service, analytics_engine, hyperdrive, mcp_tools,
-- ai_search, queue_processing, d1_global_replication, r2_event_notifications
