---
name: global-claw-llm
description: Provider-agnostic LLM routing patterns. Auto-load when working on LLM calls, provider adapters, AI Gateway, or model configuration.
user-invocable: false
---

# LLM Router — Provider-Agnostic Design

## Core Principle
ZERO provider lock-in. Admin adds/removes providers from dashboard. No code changes needed.

## D1 Schema: llm_providers
```sql
CREATE TABLE llm_providers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,               -- "Anthropic Claude"
  api_base_url TEXT NOT NULL,       -- "https://api.anthropic.com/v1"
  api_key_encrypted TEXT NOT NULL,  -- Encrypted with Workers secret
  models_json TEXT NOT NULL,        -- '["claude-sonnet-4","claude-haiku-4.5"]'
  cost_tier TEXT DEFAULT 'standard',-- 'budget','standard','premium'
  weight INTEGER DEFAULT 50,        -- Routing weight (0-100)
  is_enabled INTEGER DEFAULT 1,
  health_score REAL DEFAULT 1.0,    -- 0.0-1.0, updated by health checks
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
```

## Routing Logic (src/lib/llm/router.ts)
```typescript
interface RoutingDecision {
  provider: LLMProvider;
  model: string;
  reason: 'weight' | 'cost' | 'fallback' | 'rule';
}

// 1. Check routing rules (D1 llm_routing_rules table)
// 2. If no rule matches, use weight-based selection among healthy providers
// 3. If primary fails, cascade to fallback chain
// 4. If all fail, return graceful error (never crash)
```

## Executor Pattern (src/lib/llm/executor.ts)
```typescript
// EVERY LLM call goes through this. No exceptions.
async function executeLLM(request: LLMRequest): Promise<LLMResponse> {
  const route = await router.decide(request);
  const traceId = generateTraceId('llm', Date.now());

  try {
    // Call via AI Gateway for logging, caching, rate limiting
    const response = await callViaAIGateway(route, request, traceId);
    await logUsage(request.tenantId, route, response);
    return response;
  } catch (error) {
    // Circuit breaker: mark provider unhealthy
    await router.markUnhealthy(route.provider.id);
    // Retry with fallback
    return executeLLM({ ...request, excludeProviders: [route.provider.id] });
  }
}
```

## Adding a New Provider (Admin Flow)
1. Admin opens Dashboard → LLM Providers → + Add Provider
2. Selects provider type or enters custom API base URL
3. Enters API key (encrypted at rest in D1)
4. Selects models available
5. Sets weight + cost tier
6. Provider immediately available for routing — zero deployment needed

## AI Gateway Configuration
All calls proxy through Cloudflare AI Gateway:
- Unified logging across all providers
- Automatic caching for identical prompts
- Rate limiting per provider
- DLP (Data Loss Prevention) scanning
- Cost tracking per tenant per provider
