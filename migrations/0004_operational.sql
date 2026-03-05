-- Global-Claw D1 Schema — Operational Tables
-- Migration 0004: Audit log, Stripe idempotency, performance indexes

-- Audit log (consumed by queue worker)
CREATE TABLE IF NOT EXISTS audit_log (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  tenant_id TEXT REFERENCES tenants(id) ON DELETE SET NULL,
  actor_id TEXT,
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT,
  details_json TEXT DEFAULT '{}',
  ip_address TEXT,
  trace_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Stripe event idempotency (prevents double-processing webhooks)
CREATE TABLE IF NOT EXISTS stripe_events (
  event_id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  processed_at TEXT NOT NULL DEFAULT (datetime('now')),
  result_json TEXT DEFAULT '{}'
);

-- Performance indexes (from gap analysis #26)
CREATE INDEX IF NOT EXISTS idx_agents_language ON agents(tenant_id, languages_json);
CREATE INDEX IF NOT EXISTS idx_workflows_trigger ON workflows(tenant_id, trigger_type);
CREATE INDEX IF NOT EXISTS idx_plugin_connections_provider ON plugin_connections(tenant_id, provider);
CREATE INDEX IF NOT EXISTS idx_llm_usage_log_tenant_day ON llm_usage_log(tenant_id, created_at);
CREATE INDEX IF NOT EXISTS idx_audit_log_tenant ON audit_log(tenant_id, created_at);
CREATE INDEX IF NOT EXISTS idx_audit_log_action ON audit_log(action, created_at);
CREATE INDEX IF NOT EXISTS idx_stripe_events_type ON stripe_events(event_type, processed_at);
