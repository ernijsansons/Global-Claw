---
name: global-claw-arch
description: Global-Claw architecture patterns. Auto-load when working on Workers, Durable Objects, Workflows, or any infrastructure code.
user-invocable: false
---

# Global-Claw Architecture Reference

## Cloudflare 2026 Stack Versions
- Workers: Wrangler v4, compatibility_date 2025-09-25
- Durable Objects: SQLite storage GA, 10GB/DO, Hibernation API
- Agents SDK: v0.7.x (extends DO with agent lifecycle)
- Workflows: GA, 10K concurrent, durable execution
- D1: Global Read Replication, 10GB/db
- R2: Event notifications, 10M objects free
- Queues: 5K msg/sec, Dead Letter Queues
- AI Gateway: Auto-setup, DLP, unified billing across providers
- Vectorize: 10M vectors/index, metadata filtering
- Workers AI: 50+ models, LoRA fine-tuning, GPU inference
- KV: 25MB values, list pagination
- Hyperdrive: GA + MySQL support
- Browser Rendering: REST API GA

## Tenant Isolation Model
```
Control Plane (shared Worker)
  ├── Hono router → /api/*, /tg/webhook, /oauth/*
  ├── Auth middleware (JWT + API key)
  └── Routes to per-tenant Durable Object

Per-Tenant Durable Object (TenantAgent)
  ├── SQLite state (agent configs, conversation history, memory)
  ├── MCP tool integration (connected plugins)
  ├── Rate limiting (per-tenant token/message budgets)
  ├── LLM routing (reads provider config from D1, calls via AI Gateway)
  └── WebSocket for real-time dashboard updates
```

## API Response Standard
```typescript
// Success
{ success: true, data: T, meta?: { page, total, hasMore } }

// Error
{ success: false, error: { code: "TENANT_NOT_FOUND", message: "...", details?: any } }
```

## Error Codes
- AUTH_REQUIRED, AUTH_INVALID, AUTH_EXPIRED
- TENANT_NOT_FOUND, TENANT_SUSPENDED, TENANT_LIMIT_REACHED
- PROVIDER_UNAVAILABLE, PROVIDER_RATE_LIMITED, PROVIDER_BUDGET_EXCEEDED
- WORKFLOW_FAILED, WORKFLOW_TIMEOUT
- PLUGIN_OAUTH_FAILED, PLUGIN_TOKEN_EXPIRED

## Template Mapping (from Template Bible)
- `agents-starter` → TenantAgent DO class
- `chanfana-openapi` → Control Plane API (auto-generated OpenAPI docs)
- `workflows-starter` → TenantProvisioningWorkflow
- `openauth` → Auth system (OAuth2 + JWT)
- `d1-starter-sessions-api` → Session management + D1 patterns
- `r2-explorer` → Asset management
- `durable-chat` → Real-time WebSocket comms
