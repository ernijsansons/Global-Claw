# Changelog

All notable changes to Global-Claw will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-03-06

### Added
- Multi-tenant AI agent platform on Cloudflare Workers
- Durable Objects for per-tenant state isolation (TenantAgent)
- D1 database schema (18 tables across 4 migrations)
- Provider-agnostic LLM routing with circuit breaker
- JWT and API key authentication
- SvelteKit dashboard on Cloudflare Pages
- Telegram bot webhook integration
- OAuth plugin connection framework
- Vectorize semantic memory search
- Queue-based audit and notification system
- Tenant provisioning workflow

### Infrastructure
- Cloudflare Workers (production + staging)
- D1 Database (global-claw-primary)
- R2 Storage (global-claw-assets)
- KV Namespace (rate limiting)
- Queues with DLQ (audit + notifications)
- Vectorize index (memory)
- Workflows (provisioning)

### API Endpoints
- `/api/auth/*` - Authentication
- `/api/tenants/*` - Tenant management
- `/api/tenants/:id/agents/*` - Agent CRUD
- `/api/providers/*` - LLM provider admin
- `/api/routing-rules/*` - LLM routing
- `/api/tenants/:id/workflows/*` - Workflows
- `/api/tenants/:id/integrations/*` - OAuth plugins
- `/api/tenants/:id/memory/*` - Semantic search
- `/api/health` - System health
- `/tg/webhook/:agentId` - Telegram webhooks

### Production URLs
- API: https://api.global-claw.com
- Dashboard: https://app.global-claw.com

### Known Issues
- 31 a11y warnings in dashboard (non-blocking)
- 16 complexity warnings in backend (non-blocking)
- Svelte runtime compatibility warnings (non-blocking)

[1.0.0]: https://github.com/ernijsansons/Global-Claw/releases/tag/v1.0.0
