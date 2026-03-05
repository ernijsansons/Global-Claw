-- Global-Claw D1 Schema — LLM Provider Tables
-- Migration 0002: Provider-agnostic LLM routing

-- LLM Providers (admin-managed, runtime-configurable)
CREATE TABLE IF NOT EXISTS llm_providers (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  api_base_url TEXT NOT NULL,
  api_key_encrypted TEXT NOT NULL,
  auth_header TEXT NOT NULL DEFAULT 'Authorization',
  auth_prefix TEXT NOT NULL DEFAULT 'Bearer',
  models_json TEXT NOT NULL DEFAULT '[]',
  cost_per_1m_input_cents INTEGER NOT NULL DEFAULT 0,
  cost_per_1m_output_cents INTEGER NOT NULL DEFAULT 0,
  cost_tier TEXT NOT NULL DEFAULT 'standard' CHECK (cost_tier IN ('budget', 'standard', 'premium')),
  weight INTEGER NOT NULL DEFAULT 50 CHECK (weight >= 0 AND weight <= 100),
  max_requests_per_min INTEGER NOT NULL DEFAULT 60,
  is_enabled INTEGER NOT NULL DEFAULT 1,
  health_score REAL NOT NULL DEFAULT 1.0 CHECK (health_score >= 0.0 AND health_score <= 1.0),
  last_health_check TEXT,
  total_requests INTEGER NOT NULL DEFAULT 0,
  total_failures INTEGER NOT NULL DEFAULT 0,
  avg_latency_ms INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- LLM Routing Rules (conditional routing)
CREATE TABLE IF NOT EXISTS llm_routing_rules (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  name TEXT NOT NULL,
  priority INTEGER NOT NULL DEFAULT 0,
  condition_json TEXT NOT NULL,
  routes_json TEXT NOT NULL,
  is_enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- LLM Usage Log (per-request tracking)
CREATE TABLE IF NOT EXISTS llm_usage_log (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  tenant_id TEXT NOT NULL,
  provider_id TEXT NOT NULL REFERENCES llm_providers(id),
  model TEXT NOT NULL,
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  latency_ms INTEGER NOT NULL DEFAULT 0,
  cost_cents INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'success' CHECK (status IN ('success', 'error', 'timeout', 'fallback')),
  trace_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Seed default providers (DISABLED until real API keys are configured via admin dashboard)
INSERT OR IGNORE INTO llm_providers (id, name, slug, api_base_url, api_key_encrypted, models_json, cost_per_1m_input_cents, cost_per_1m_output_cents, cost_tier, weight, is_enabled) VALUES
  ('prov_anthropic', 'Anthropic Claude', 'anthropic', 'https://api.anthropic.com/v1', 'PLACEHOLDER_ENCRYPT_ME', '["claude-sonnet-4","claude-haiku-4.5","claude-opus-4"]', 300, 1500, 'premium', 60, 0),
  ('prov_qwen', 'Alibaba Qwen', 'qwen', 'https://dashscope.aliyuncs.com/compatible-mode/v1', 'PLACEHOLDER_ENCRYPT_ME', '["qwen-2.5-72b-instruct","qwen-2.5-7b-instruct","qwen-max"]', 27, 110, 'budget', 30, 0),
  ('prov_openai', 'OpenAI', 'openai', 'https://api.openai.com/v1', 'PLACEHOLDER_ENCRYPT_ME', '["gpt-4o","gpt-4o-mini"]', 250, 1000, 'standard', 10, 0);

-- Seed default routing rules
INSERT OR IGNORE INTO llm_routing_rules (id, name, priority, condition_json, routes_json) VALUES
  ('rule_complex', 'Complex Reasoning', 10,
   '{"field":"task_type","operator":"eq","value":"complex_reasoning"}',
   '[{"provider_slug":"anthropic","model":"claude-sonnet-4","weight":80},{"provider_slug":"qwen","model":"qwen-2.5-72b-instruct","weight":20}]'),
  ('rule_simple', 'Simple Chat', 20,
   '{"field":"task_type","operator":"eq","value":"simple_chat"}',
   '[{"provider_slug":"qwen","model":"qwen-2.5-7b-instruct","weight":90},{"provider_slug":"anthropic","model":"claude-haiku-4.5","weight":10}]'),
  ('rule_translation', 'Translation (LV/RU)', 5,
   '{"field":"task_type","operator":"eq","value":"translation","extra":{"languages":["lv","ru"]}}',
   '[{"provider_slug":"anthropic","model":"claude-sonnet-4","weight":100}]');

-- Indexes
CREATE INDEX IF NOT EXISTS idx_llm_providers_enabled ON llm_providers(is_enabled);
CREATE INDEX IF NOT EXISTS idx_llm_providers_slug ON llm_providers(slug);
CREATE INDEX IF NOT EXISTS idx_llm_routing_rules_priority ON llm_routing_rules(priority);
CREATE INDEX IF NOT EXISTS idx_llm_usage_log_tenant ON llm_usage_log(tenant_id, created_at);
CREATE INDEX IF NOT EXISTS idx_llm_usage_log_provider ON llm_usage_log(provider_id, created_at);
