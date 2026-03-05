# Global-Claw — Cloudflare-Native AI Automation SaaS

## What This Is
Telegram-first AI agent platform. Multi-tenant. Provider-agnostic LLM routing. Cloudflare-only infrastructure. Non-US market focus (LV/RU/EN primary).

## Commands
- Dev: `npx wrangler dev --local`
- Deploy staging: `npx wrangler deploy --env staging`
- Deploy prod: `npx wrangler deploy --env production` (MANUAL — requires human confirmation)
- Types: `npx wrangler types`
- Test: `npx vitest run`
- Test watch: `npx vitest`
- Lint: `npx biome check --write .`
- DB migrate (local): `npm run db:migrate:local` (runs all 4 migrations via cross-platform script)
- DB migrate (staging): `npm run db:migrate:staging`
- DB migrate (prod): `npm run db:migrate:production`

## Migrations (4 required, applied in order)
- `0001_init.sql` — tenants (status includes 'deleted' for soft-delete), users, tenant_users, subscriptions, api_keys, usage_daily
- `0002_llm_providers.sql` — llm_providers (seeded disabled, is_enabled=0), llm_routing_rules, llm_usage_log
- `0003_agents_memory.sql` — agents, plugin_connections, workflows, workflow_runs, feature_flags, partners, tenant_partners
- `0004_operational.sql` — audit_log, stripe_events (idempotency), performance indexes

## Secrets Contract
| Variable | Where stored | Purpose |
|----------|-------------|---------|
| JWT_SECRET | wrangler secret / .dev.vars | HMAC-SHA256 signing for JWTs |
| ENCRYPTION_KEY | wrangler secret / .dev.vars | AES-256-GCM encrypt/decrypt secrets at rest |
| STRIPE_SECRET_KEY | wrangler secret / .dev.vars | Stripe API calls |
| STRIPE_WEBHOOK_SECRET | wrangler secret / .dev.vars | Stripe webhook signature verification |
| TELEGRAM_WEBHOOK_SECRET | wrangler secret / .dev.vars | Verifies X-Telegram-Bot-Api-Secret-Token header |
| TELEGRAM_BOT_TOKEN | **NOT an env var** | Per-agent, encrypted in D1 `agents.telegram_bot_token_encrypted` |

Non-secret vars set in wrangler.jsonc `vars{}`: ENVIRONMENT, APP_URL, DASHBOARD_URL, AI_GATEWAY_SLUG

## Architecture Rules (Non-Negotiable)
1. **Cloudflare-only** — No AWS, no Vercel, no external databases. D1 + Durable Objects + R2 + Queues + Workers AI + Workflows + KV.
2. **Provider-agnostic LLM** — NEVER hardcode any LLM provider. All providers come from D1 `llm_providers` table. Admin dashboard adds/removes/configures providers at runtime. AI Gateway as unified proxy.
3. **Tenant isolation** — Every tenant gets its own Durable Object (`TenantAgent`). SQLite state inside DO. No cross-tenant data leaks.
4. **Fail-closed LLM governance** — All LLM calls go through `src/lib/llm/executor.ts`. No raw `fetch()` to LLM APIs. Circuit breaker + fallback chain.
5. **1-click integrations** — All plugin connections use OAuth. No API key entry for end users. MCP remote tools behind OAuth flow.
6. **Latvian + Russian first** — These are P0 home-market languages. All user-facing strings must support i18n. Use ICU MessageFormat.

## File Structure
```
src/
  index.ts              # Main Worker entry (Hono router) — combined module export: { fetch, queue }
  types/
    index.ts            # Shared TypeScript interfaces (Tenant, User, Agent, etc.)
    env.ts              # Worker Env bindings type
  lib/
    llm/
      executor.ts       # Fail-closed LLM executor (ALL LLM calls go here)
      prompt-loader.ts  # Versioned prompt templates
      router.ts         # Provider-agnostic routing logic
      circuit-breaker.ts # Provider health tracking
      providers/
        base.ts         # Provider adapter interface
        anthropic.ts    # Claude adapter
        qwen.ts         # Alibaba Qwen adapter
        openai.ts       # OpenAI-compatible adapter
    auth/
      jwt.ts            # JWT creation/verification (Workers crypto)
      api-key.ts        # API key hashing + validation
      middleware.ts     # Hono auth middleware (JWT or API key → tenant context)
    billing/
      stripe.ts         # Stripe subscription + webhook handling
    crypto.ts           # AES-GCM encrypt/decrypt for secrets at rest
    errors.ts           # Error classes + error handler middleware
    i18n/
      index.ts          # ICU MessageFormat loader
      lv.json           # Latvian (P0)
      ru.json           # Russian (P0)
      en.json           # English (P0)
  middleware/
    cors.ts             # CORS configuration per environment
    rate-limit.ts       # Per-tenant rate limiting (KV-backed)
    tenant-context.ts   # Extract + attach tenant context to request
    logger.ts           # Structured logging with trace IDs
    error-handler.ts    # Global error handler → standard error response
  agents/
    tenant-agent.ts     # TenantAgent Durable Object (extends Agents SDK)
  workflows/
    provisioning.ts     # TenantProvisioningWorkflow (Cloudflare Workflow)
  api/
    auth.ts             # /api/auth/register|login|refresh
    tenants.ts          # /api/tenants CRUD
    users.ts            # /api/tenants/:id/users management (invite, role, remove)
    agents.ts           # /api/tenants/:id/agents CRUD
    providers.ts        # /api/providers LLM provider admin CRUD
    routing-rules.ts    # /api/routing-rules management
    workflows.ts        # /api/tenants/:id/workflows CRUD + run history
    integrations.ts     # /api/tenants/:id/integrations + OAuth flows
    memory.ts           # /api/tenants/:id/memory search + CRUD
    signup.ts           # /api/signup → triggers provisioning workflow
    stripe.ts           # /api/stripe/webhook
    partners.ts         # /api/partners + /api/partners/:id/tenants
    health.ts           # /api/health
    ws.ts               # /api/ws
    dashboard/
      overview.ts       # Metrics aggregation
      analytics.ts      # Time-series data for charts
      llm-cost.ts       # Cost breakdown by provider
  telegram/
    webhook.ts          # POST /tg/webhook/:agentId handler
    bot-api.ts          # Telegram Bot API wrapper
    commands.ts         # /start, /help, /settings, /language handlers
dashboard/              # SvelteKit app (Cloudflare Pages)
  src/
    routes/             # SvelteKit routes for all 11 screens
    lib/
      components/       # Shared UI components (Neural Cartography design system)
      stores/           # Svelte stores for state management
      api.ts            # API client for backend
      ws.ts             # WebSocket client for real-time updates
      i18n.ts           # Frontend i18n (LV/RU/EN)
migrations/
  0001_init.sql         # Core: tenants, users, tenant_users, subscriptions, api_keys, usage_daily
  0002_llm_providers.sql # LLM: providers, routing_rules, usage_log + seed data
  0003_agents_memory.sql # Agents, plugins, workflows, feature_flags, partners
  0004_operational.sql  # audit_log, stripe_events (idempotency), performance indexes
scripts/
  migrate.mjs           # Cross-platform Node.js migration runner (Windows + Linux)
tests/
  unit/
    auth.test.ts
    llm-router.test.ts
    circuit-breaker.test.ts
    crypto.test.ts
  integration/
    tenants.test.ts
    telegram.test.ts
    provisioning.test.ts
    oauth.test.ts
    dashboard-api.test.ts
  fixtures/             # Shared test data + mock factories
    tenants.ts
    providers.ts
    agents.ts
  helpers/
    setup.ts            # Test DB setup + teardown
    mocks.ts            # Mock Telegram API, LLM providers, Stripe
wrangler.jsonc          # Multi-environment config (staging IDs pre-filled)
package.json
tsconfig.json
biome.json
vitest.config.ts
.env.example            # Environment variable documentation
```

## Code Style
- TypeScript strict mode, no `any`
- Hono for HTTP routing
- Drizzle ORM for D1 queries
- ES modules only (import/export)
- Biome for formatting + linting
- Error responses: `{ success: false, error: { code: string, message: string } }`
- Success responses: `{ success: true, data: T, meta?: { page, total, hasMore } }`

## Frontend Decision: SvelteKit
- **Framework**: SvelteKit (NOT React) on Cloudflare Pages
- **Styling**: Tailwind CSS with Neural Cartography design tokens
- **State**: Svelte stores + WebSocket for real-time
- **i18n**: svelte-i18n with ICU MessageFormat (LV/RU/EN)

## Middleware Stack (applied in order)
1. `cors.ts` — CORS origin-reflection per environment (dev: localhost, staging: allowlist *.workers.dev origins, prod: global-claw.com) — NOT wildcard patterns; check request Origin against allowlist and echo back the specific origin
2. `logger.ts` — Structured JSON logging with `x-trace-id` header propagation
3. `rate-limit.ts` — KV-backed per-IP rate limiting (60 req/min unauthenticated, 300 req/min authenticated)
4. `tenant-context.ts` — Extract tenant from JWT/API key, attach to `c.var.tenant`
5. `error-handler.ts` — Catch all errors, return standard `{ success: false, error: {...} }` response

## Encryption Strategy
- All secrets at rest (LLM API keys, OAuth tokens) encrypted with AES-256-GCM
- Encryption key stored as Wrangler secret `ENCRYPTION_KEY`
- `src/lib/crypto.ts` exports `encrypt(plaintext, key)` and `decrypt(ciphertext, key)`
- JWT uses HMAC-SHA256 via Workers `crypto.subtle`

## Stripe Integration Rules
- Webhook validation: verify `stripe-signature` header with `STRIPE_WEBHOOK_SECRET`
- Idempotency: dedupe by `event.id` stored in D1
- Plan mapping: starter ($29) → 3 agents/100K tokens, pro ($79) → 10 agents/500K tokens, business ($149) → unlimited
- Feature flags activated per plan during provisioning workflow
- Customer portal: redirect to Stripe-hosted portal for billing management

## WebSocket Real-Time Events
- Endpoint: `/api/ws` (upgraded from HTTP to WebSocket)
- Auth: JWT token passed as `?token=` query parameter (IMPORTANT: logger middleware MUST scrub `?token=` from access logs to prevent credential leakage)
- Message format: `{ type: string, ... , timestamp: string }` (ISO 8601)
- Event types: `connection`, `error`, `agent_status_changed`, `message_count_updated`, `llm_call_completed`, `workflow_run_updated`, `memory_updated`, `budget_alert`, `user_presence`
- Reconnect strategy: exponential backoff (1s, 2s, 4s, 8s, max 30s)

## API Routes (Complete)
```
# Auth
POST   /api/auth/register          # User registration
POST   /api/auth/login              # JWT issuance
POST   /api/auth/refresh            # Token refresh

# Tenants
GET    /api/tenants                 # List tenants for user
POST   /api/tenants                 # Create tenant (admin)
GET    /api/tenants/:id             # Get tenant details
PATCH  /api/tenants/:id             # Update tenant
DELETE /api/tenants/:id             # Delete tenant

# Users
GET    /api/tenants/:id/users       # List tenant users
POST   /api/tenants/:id/users       # Invite user
PATCH  /api/tenants/:id/users/:uid  # Update role
DELETE /api/tenants/:id/users/:uid  # Remove user

# Agents
GET    /api/tenants/:id/agents      # List agents
POST   /api/tenants/:id/agents      # Create agent
GET    /api/tenants/:id/agents/:aid # Get agent detail
PATCH  /api/tenants/:id/agents/:aid # Update agent config
DELETE /api/tenants/:id/agents/:aid # Delete agent

# LLM Providers (admin)
GET    /api/providers               # List providers
POST   /api/providers               # Add provider
PATCH  /api/providers/:pid          # Update provider
DELETE /api/providers/:pid          # Remove provider

# Routing Rules (admin)
GET    /api/routing-rules           # List rules
POST   /api/routing-rules           # Add rule
PATCH  /api/routing-rules/:rid      # Update rule
DELETE /api/routing-rules/:rid      # Delete rule

# Workflows
GET    /api/tenants/:id/workflows   # List workflows
POST   /api/tenants/:id/workflows   # Create workflow
PATCH  /api/tenants/:id/workflows/:wid  # Update workflow
DELETE /api/tenants/:id/workflows/:wid  # Delete workflow
GET    /api/tenants/:id/workflows/:wid/runs  # Run history

# Integrations (OAuth)
GET    /api/tenants/:id/integrations       # List connected plugins
POST   /api/tenants/:id/integrations       # Initiate OAuth connection
DELETE /api/tenants/:id/integrations/:iid  # Disconnect plugin
GET    /oauth/:provider/callback           # OAuth callback handler

# Memory
GET    /api/tenants/:id/memory      # Search memory (query param: ?q=)
POST   /api/tenants/:id/memory      # Add manual memory entry
DELETE /api/tenants/:id/memory/:mid # Delete memory entry

# Dashboard aggregation
GET    /api/dashboard/overview      # Key metrics (agents, messages, uptime, cost)
GET    /api/dashboard/analytics     # Time-series data
GET    /api/dashboard/llm-cost      # Cost breakdown by provider

# Signup + Provisioning
POST   /api/signup                  # Triggers provisioning workflow
POST   /api/stripe/webhook          # Stripe webhook handler

# Partners
GET    /api/partners                # List partners (admin)
POST   /api/partners                # Create partner
GET    /api/partners/:pid           # Partner detail
GET    /api/partners/:pid/tenants   # Tenants under partner
POST   /api/partners/:pid/tenants   # Assign tenant to partner

# Telegram
POST   /tg/webhook/:agentId         # Telegram update handler (agent-specific webhook)
POST   /api/tenants/:id/telegram/setup  # Register bot + set webhook

# Health
GET    /api/health                  # Health check endpoint

# Real-time
GET    /api/ws                      # WebSocket endpoint
```

## Staging Resources (Already Deployed)
- Worker: `global-claw-staging`
- D1 ID: `51f1c24f-fc8b-411a-9d46-a3a8fee53222`
- R2: `global-claw-assets-staging`
- KV: `8b23325891774864961c245d1f8fdb36`
- Queues: `global-claw-audit-staging`, `global-claw-notifications-staging`

## Reference Documents
- @GLOBAL-CLAW-MASTER-BIBLE-v2.docx — Full PDR (product, architecture, business plan)
- @GLOBAL-CLAW-TEMPLATE-BIBLE-v1.docx — Cloudflare template mapping
- @GLOBAL-CLAW-DASHBOARD-UX-PLAN.md — Complete UI/UX design system
- @MASTER_BUILD_SPEC.json — Legacy planning artifact (not authoritative for execution; use this file + execution SKILL contract)

## Testing Strategy
- Unit tests for LLM router, auth, billing, crypto logic
- Integration tests for D1 queries, DO state, Workflow steps
- E2E tests with Miniflare for full request lifecycle
- CI enforced via `.github/workflows/ci.yml` — every PR must pass: `npx biome check && npx tsc --noEmit && npx wrangler types && npx vitest run && npm run verify:contracts`
- Coverage target: 70% statements, 60% branches
- Mocking: Use Miniflare's built-in D1/KV/R2 mocks. Mock external APIs (Telegram, Stripe, LLM providers) with test fixtures in `tests/fixtures/`
- Test DB: Each test run gets ephemeral Miniflare D1 instance. Migrations applied in `tests/helpers/setup.ts`

## Execution Scope (Phase -1 to 13)

Pre-build: Phase -1 (Consistency Gate) verifies all migrations, bindings, and secrets before coding begins.

Dashboard screens shipping in MVP (Phases 1-10):
1. Overview (Mission Control)
2. Agents (Fleet Management + detail panel)
3. Workflows (Visual Editor)
4. LLM Providers (Router + cost dashboard)

Post-MVP screens (Phases 11-12):
5. Memory (Timeline + Graph + Table views)
6. Integrations (1-click marketplace)
7. Conversations (Telegram + channel logs)
8. Analytics (Usage, costs, performance)
9. Tenants (Admin multi-tenant management)
10. Billing (Stripe portal + usage)
11. Settings (Team, API keys, branding)

Production deploy: Phase 13 (MANUAL — human runs `npx wrangler deploy --env production`)

## Git Conventions
- Branch: `feat/`, `fix/`, `chore/`
- Commits: Conventional Commits (feat:, fix:, docs:, chore:)
- PR title < 70 chars
- Squash merge to main
