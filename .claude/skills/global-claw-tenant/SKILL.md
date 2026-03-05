---
name: global-claw-tenant
description: Tenant isolation and agent management patterns. Auto-load when working on Durable Objects, agent configuration, memory, or multi-tenant code.
user-invocable: false
---

# Tenant Agent — Durable Object Design

## TenantAgent Class (extends Agents SDK v0.7.x)
```typescript
import { Agent } from "agents";

export class TenantAgent extends Agent {
  // SQLite tables inside DO:
  // - agent_configs (id, name, soul_md, agents_md, primary_model, fallback_model, temp, max_tokens, languages_json)
  // - conversations (id, agent_id, telegram_user_id, created_at)
  // - messages (id, conversation_id, role, content, tokens_used, created_at)
  // - memory_facts (id, agent_id, fact, source, confidence, usage_count, created_at)
  // - connected_plugins (id, agent_id, provider, oauth_token_encrypted, scopes_json)

  async onMessage(message: TelegramMessage) {
    // 1. Identify agent by Telegram bot token
    // 2. Load conversation context from SQLite
    // 3. Retrieve relevant memory (facts + vector search)
    // 4. Build prompt from SOUL.md + context + memory
    // 5. Call LLM via executor (provider-agnostic)
    // 6. Execute any tool calls (MCP plugins)
    // 7. Store response + update memory
    // 8. Reply via Telegram
  }
}
```

## Agent SOUL.md / AGENTS.md
These are markdown files stored in SQLite that define agent personality and capabilities.
- SOUL.md: Identity, tone, personality, constraints
- AGENTS.md: Available tools, workflow triggers, escalation rules

## Memory System (Three-Tier)
1. **Conversation Memory**: Recent messages in SQLite `messages` table. Sliding window (last N messages as context).
2. **Long-Term Facts**: Extracted facts in `memory_facts` table. Confidence-scored. Auto-extracted after conversations.
3. **Vector Memory**: Embeddings in Vectorize index. Semantic search for relevant context. Per-tenant namespace.

## Agent Lifecycle
- Created via Dashboard or API
- Linked to Telegram bot (bot token stored encrypted)
- Configured with model, temperature, tools, languages
- Runs inside tenant's Durable Object
- Budget-limited (daily tokens + messages from tenant plan)

## Rate Limiting
Per-tenant, enforced in DO:
- Token budget: daily limit from plan tier
- Message budget: daily limit from plan tier
- Request rate: 60 req/min per tenant
- Stored in DO SQLite, reset daily via Cron Trigger
