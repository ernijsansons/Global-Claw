# Global-Claw — Claude Code Execution Prompt

Copy this entire prompt into Claude Code (or paste as your initial message) to begin autonomous execution of the Global-Claw build.

---

## PROMPT START

You are building **Global-Claw**, a Cloudflare-native, Telegram-first AI automation SaaS platform. The entire specification package is already in this repository — your job is to execute it phase by phase, writing all source code, tests, and deploying to staging.

---

## EXECUTION METHODOLOGY: Template-First Iterative Build

Global-Claw follows a **template-first development methodology**. For every component, you MUST follow this decision tree before writing any custom code:

1. **Does an official Cloudflare template exist for this?** → Scaffold from it using `npm create cloudflare@latest -- --template=<template-id>`
2. **Does a community template exist with the pattern?** → Adapt it
3. **Does a Cloudflare tutorial/guide cover this?** → Follow it
4. **Only if none of the above apply** → Write custom code

This is NOT optional. The Template Bible (`GLOBAL-CLAW-TEMPLATE-BIBLE-v1.docx`) maps **17 official Cloudflare templates** to Global-Claw components. Using these templates eliminates 60-70% of boilerplate and ensures battle-tested patterns.

### Iterative Loop (per phase)

For each phase, follow this cycle:

```
SCAFFOLD → CUSTOMIZE → VERIFY → INTEGRATE → TEST → CHECKPOINT
```

1. **SCAFFOLD**: Use the mapped template from the Template Bible as starting point
2. **CUSTOMIZE**: Adapt the template scaffold to Global-Claw's specific needs
3. **VERIFY**: Run `npm run verify:contracts && npm run typecheck && npm run lint`
4. **INTEGRATE**: Wire the new component into the existing codebase
5. **TEST**: Write and run tests: `npm run test && npm run test:integration`
6. **CHECKPOINT**: Document what was built, what passed, what's next

---

## REQUIRED READING (in this exact order, before writing ANY code)

### Technical Specifications (Implementation Contract First)

1. **`CLAUDE.md`** — Master project instructions: architecture rules, file structure, API routes (complete list), middleware stack order, code style, secrets contract, testing strategy. **Primary implementation source of truth.**

2. **`.claude/skills/global-claw-execution/SKILL.md`** — Phase-by-phase execution plan with contracts, exit criteria, and route-to-file mapping.

3. **`GLOBAL-CLAW-TYPES-SPEC.md`** — Complete TypeScript interface specification (2500+ lines). Copy types from here verbatim — do NOT reinvent interfaces.

4. **`GLOBAL-CLAW-DASHBOARD-UX-PLAN.md`** — Full UI/UX design system ("Neural Cartography") with wireframes for all 11 dashboard screens, design tokens, color palette, typography scale, and interaction patterns.

### Bible Documents (Vision + Architecture + Template Rationale)

5. **`GLOBAL-CLAW-MASTER-BIBLE-v2.docx`** — Full Product Design Review: 2026 Cloudflare stack reference (Agents SDK v0.7, Workflows GA, D1 Global Read Replication), architecture, tenant isolation model, plugin system, LLM router design, preset packs, abuse controls.

6. **`GLOBAL-CLAW-TEMPLATE-BIBLE-v1.docx`** — Template Utilization Bible: Maps 17 official Cloudflare templates to every Global-Claw component with exact scaffolding commands. Follow this for scaffold decisions.

7. **`GLOBAL-CLAW-MASTER-BIBLE-v1.docx`** — Original vision document with Mermaid architecture diagrams, provisioning state machine, LLM router pseudocode, D1 schema design, and business plan.

---

## MASTER TEMPLATE → COMPONENT MAPPING

Reference this table for every component you build. The Template Bible has deep dives on each:

| Global-Claw Component | Primary Template | Command | What You Get Free |
|---|---|---|---|
| Control Plane API | `chanfana-openapi-template` | `npm create cloudflare@latest -- --template=cloudflare/templates/chanfana-openapi-template` | Hono + D1 + auto OpenAPI docs + Vitest tests |
| Tenant Agent (DO) | `agents-starter` | `npm create cloudflare@latest -- --template=cloudflare/agents-starter` | Agents SDK + DO + SQLite state + MCP + streaming + human-in-loop + tool calling + task scheduling |
| Provisioning Workflow | `workflows-starter-template` | `npm create cloudflare@latest -- --template=cloudflare/workflows-starter` | Durable execution + step types + retry patterns + real-time status |
| Auth Server | `openauth-template` | `npm create cloudflare@latest -- --template=cloudflare/templates/openauth-template` | Login + registration + password reset + D1 + KV sessions |
| LLM Chat / Router | `llm-chat-app-template` | `npm create cloudflare@latest -- --template=cloudflare/templates/llm-chat-app-template` | Workers AI + streaming responses + AI Gateway patterns |
| Dashboard (SvelteKit) | `saas-admin-template` (study patterns) | `npm create cloudflare@latest -- --template=cloudflare/templates/saas-admin-template` | Admin panels + Tailwind + auth patterns (adapt to SvelteKit) |
| D1 with Global Replication | `d1-starter-sessions-api-template` | `npm create cloudflare@latest -- --template=cloudflare/templates/d1-starter-sessions-api-template` | D1 Sessions API + read replication + sequential consistency |
| R2 File Management | `r2-explorer-template` | `npm create cloudflare@latest -- --template=cloudflare/templates/r2-explorer-template` | R2 interface + upload/download + browse patterns |
| DO Real-time Chat | `durable-chat-template` | `npm create cloudflare@latest -- --template=cloudflare/templates/durable-chat-template` | DO + PartyKit + WebSocket + real-time messaging |
| Multi-tenant Platform | `workers-for-platforms-template` | `npm create cloudflare@latest -- --template=cloudflare/templates/workers-for-platforms-template` | Dispatch Namespace + per-tenant isolation patterns |
| Payment Gate Middleware | `x402-proxy-template` | `npm create cloudflare@latest -- --template=cloudflare/templates/x402-proxy-template` | Payment-gated routes + Stripe verification |
| Basic DO Patterns | `hello-world-do-template` | `npm create cloudflare@latest -- --template=cloudflare/templates/hello-world-do-template` | DO initialization + state management + fetch handler |
| Build Notifications | `workers-builds-notifications-template` | `npm create cloudflare@latest -- --template=cloudflare/templates/workers-builds-notifications-template` | Slack/Discord webhooks + build status alerts |

**IMPORTANT**: You do NOT scaffold each template into a separate project. Instead:
- Scaffold the template into a **temporary directory**
- Study its patterns, code structure, and Cloudflare API usage
- Extract the relevant patterns into Global-Claw's unified monorepo structure defined in `CLAUDE.md`
- Delete the temp scaffold

This approach gives you battle-tested code patterns while maintaining Global-Claw's single-Worker architecture.

---

## AGENTS-STARTER: The Core of Global-Claw

The `agents-starter` template is the single most important template. It provides the TenantAgent architecture out of the box. What you get FREE:

| Feature | Status | Global-Claw Use |
|---|---|---|
| Durable Object with SQLite | Built-in | Per-tenant state, conversation history, pack configs |
| Agents SDK v0.7+ | Built-in | Agent message patterns, tool dispatch, state management |
| Streaming AI Chat | Built-in | Real-time response streaming to Telegram and dashboard |
| Server-side Tool Calling | Built-in | Pack execution, plugin invocation, MCP tool dispatch |
| Human-in-the-Loop | Built-in | Approval workflows for sensitive operations |
| Task Scheduling | Built-in | Scheduled pack executions, reminder packs |
| MCP Support (McpAgent) | Built-in | Plugin interop via Model Context Protocol |
| Resumable Streaming | Built-in | Conversations survive disconnects |
| keepAlive() API | Built-in | Prevent DO eviction during long workflows |
| State Syncing | Built-in | Real-time UI updates when agent state changes |

**What you customize on top:**
- Tenant isolation: wrap agent in `tenant_id` namespace routing from control plane
- Pack system: register packs as MCP tools based on tenant config
- Plugin tokens: inject encrypted OAuth tokens from D1 into agent tool context
- LLM router: replace default Workers AI call with provider-agnostic router via AI Gateway
- Telegram adapter: translate Telegram messages into agent chat messages
- Budget enforcement: token/message counting middleware before each LLM call

---

## What Already Exists (DO NOT recreate)

These files are already complete and audited (73 findings across 3 audit rounds, all resolved):

- `CLAUDE.md` — Master project instructions
- `wrangler.jsonc` — Multi-environment Cloudflare Workers config (dev/staging/production with real IDs)
- `package.json` — Dependencies and scripts (Hono, Drizzle, Zod, Vitest, Wrangler)
- `tsconfig.json` — TypeScript strict config
- `biome.json` — Linter/formatter config
- `vitest.config.ts` — Miniflare-based test config with coverage thresholds
- `.env.example` — Environment variable documentation
- `.gitignore` — Standard ignores
- `.github/workflows/ci.yml` — CI pipeline
- `migrations/0001_init.sql` through `0004_operational.sql` — 4 D1 migrations (18 tables)
- `scripts/migrate.mjs` — Cross-platform migration runner
- `scripts/verify-contracts.mjs` — Contract verification script
- `GLOBAL-CLAW-TYPES-SPEC.md` — Complete TypeScript interface specification (2500+ lines)
- `GLOBAL-CLAW-DASHBOARD-UX-PLAN.md` — Full UI/UX design system with wireframes
- `GLOBAL-CLAW-TEMPLATE-BIBLE-v1.docx` — Template-to-component mapping (17 templates)
- `GLOBAL-CLAW-MASTER-BIBLE-v2.docx` — Full PDR + 2026 Cloudflare stack reference
- `GLOBAL-CLAW-MASTER-BIBLE-v1.docx` — Original vision + architecture diagrams
- `.claude/skills/global-claw-execution/SKILL.md` — Phase plan with contracts
- `MASTER_BUILD_SPEC.json` — Legacy planning artifact (reference only)

---

## PHASE EXECUTION

### PHASE -1: Consistency Gate

```bash
npm install
npm run verify:contracts
npm run typecheck
```
All must pass before proceeding. If `verify:contracts` fails, fix the issue and re-run.

### PHASE 0: Cloudflare Resource Setup + Template Study

0. **Approval gate**: Before creating/modifying any Cloudflare resource, pause and request explicit human approval.
1. Run `npx wrangler whoami` to confirm auth.
2. Check if D1 database `global-claw-primary` exists. If not, create it after approval and update `wrangler.jsonc`.
3. Create `.dev.vars` from `.env.example` with test values for local development.
4. Create any missing queues after approval: `global-claw-audit`, `global-claw-notifications`, and their DLQ variants.
5. Create Vectorize index `global-claw-memory` after approval if it doesn't exist.
6. **TEMPLATE STUDY** (critical step): Scaffold the following templates into `.tmp/template-study/` (repo-local, cross-platform) to study patterns:
   - `npm create cloudflare@latest .tmp/template-study/tpl-agents -- --template=cloudflare/agents-starter` — Study DO + Agents SDK patterns
   - `npm create cloudflare@latest .tmp/template-study/tpl-api -- --template=cloudflare/templates/chanfana-openapi-template` — Study Hono + OpenAPI patterns
   - `npm create cloudflare@latest .tmp/template-study/tpl-workflows -- --template=cloudflare/workflows-starter` — Study Workflow step patterns
   - `npm create cloudflare@latest .tmp/template-study/tpl-llm -- --template=cloudflare/templates/llm-chat-app-template` — Study AI Gateway + streaming patterns
   - Read their `src/` directories, understand their patterns, then use those patterns throughout the build.

### PHASE 1: Scaffold + Migrations

Using patterns learned from the template study:
- Create the full directory structure from CLAUDE.md's "File Structure" section.
- Run `npx wrangler types` to generate Worker type bindings.
- Run `npm run db:migrate:local` to apply all 4 migrations.
- Create a minimal `src/index.ts` with Hono router + `GET /api/health` endpoint. Use the Hono patterns from `chanfana-openapi-template`.
- Verify: `npx wrangler dev --local` serves health check.

### PHASE 2: Types + Core Middleware + Auth

**Template reference**: Use patterns from `chanfana-openapi-template` (middleware pipeline, error handling) and `openauth-template` (auth flows, session management).

Build in this order:
1. `src/types/env.ts` — Copy Env interface from `GLOBAL-CLAW-TYPES-SPEC.md`
2. `src/types/index.ts` — Copy all shared interfaces (Tenant, User, Agent, etc.) from types spec
3. `src/lib/crypto.ts` — AES-256-GCM encrypt/decrypt using Workers `crypto.subtle`
4. `src/lib/errors.ts` — Error classes (AppError, AuthError, NotFoundError, ValidationError, RateLimitError)
5. `src/middleware/cors.ts` — Origin-reflection CORS (check request Origin against per-env allowlist, echo back specific origin — NOT wildcard)
6. `src/middleware/logger.ts` — Structured JSON logging with `x-trace-id`, MUST scrub `?token=` from logged URLs
7. `src/middleware/rate-limit.ts` — KV-backed per-IP rate limiting (60/min unauth, 300/min auth)
8. `src/middleware/tenant-context.ts` — Extract tenant from JWT/API key, attach to `c.var.tenant`
9. `src/middleware/error-handler.ts` — Catch all errors → `{ success: false, error: { code, message } }`
10. `src/lib/auth/jwt.ts` — HMAC-SHA256 JWT create/verify using `crypto.subtle` (NOT a library). Must verify signature, check exp/iss/aud claims.
11. `src/lib/auth/api-key.ts` — SHA-256 hash key, lookup in D1 `api_keys`, verify not revoked
12. `src/lib/auth/middleware.ts` — Hono middleware: check Authorization header for Bearer JWT or API key → resolve tenant context

Wire middleware into `src/index.ts` in order: cors → logger → rate-limit → tenant-context → error-handler. Apply `tenant-context` only to protected route groups; keep health/auth routes public.

Run: `npm run verify:contracts && npm run typecheck && npm run lint && npm run test && npm run test:integration`

### PHASE 3: LLM Router

**Template reference**: Use patterns from `llm-chat-app-template` (AI Gateway routing, streaming responses) as the foundation. The Master Bible v2 §6 has the complete LLM Router design.

Build the provider-agnostic LLM routing system:
1. `src/lib/llm/providers/base.ts` — Abstract provider adapter interface
2. `src/lib/llm/providers/anthropic.ts` — Claude adapter
3. `src/lib/llm/providers/qwen.ts` — Alibaba Qwen adapter
4. `src/lib/llm/providers/openai.ts` — OpenAI-compatible adapter
5. `src/lib/llm/router.ts` — Route requests based on D1 `llm_routing_rules` (weight-based, task-type matching). Reference router pseudocode in Master Bible v1.
6. `src/lib/llm/circuit-breaker.ts` — Track provider health, trip circuit after N failures, auto-recover. Use thresholds from D1 `llm_providers.circuit_breaker_threshold`.
7. `src/lib/llm/executor.ts` — **FAIL-CLOSED** executor. ALL LLM calls go through here. No raw fetch() to LLM APIs anywhere else. Decrypt provider API keys via `src/lib/crypto.ts` only in execution path. Route through AI Gateway (`AI_GATEWAY_SLUG` env var).
8. `src/lib/llm/prompt-loader.ts` — Versioned prompt template loading
9. `src/api/providers.ts` — CRUD for `llm_providers` table (admin only)
10. `src/api/routing-rules.ts` — CRUD for `llm_routing_rules` table (admin only)

**Critical rule**: NEVER hardcode any LLM provider. All providers come from D1 `llm_providers` table at runtime. Admin dashboard adds/removes/reweights providers with zero code changes.

Run: `npm run verify:contracts && npm run typecheck && npm run lint && npm run test && npm run test:integration`

### PHASE 4: Tenant Durable Object

**Template reference**: This is where `agents-starter` is critical. Study its DO class structure, SQLite patterns, MCP tool registration, streaming, and state management. Adapt all of these into `TenantAgent`.

Build `src/agents/tenant-agent.ts`:
- Extend Cloudflare Agents SDK (`agents` package) — use the exact patterns from `agents-starter`
- Per-tenant SQLite state inside DO (conversation history, pack configs, memory)
- MCP tool registration for pack execution and plugin invocation
- Resumable streaming support (conversations survive disconnects)
- Budget enforcement (check D1 plan limits before LLM calls)
- keepAlive() for long-running agentic workflows
- No cross-tenant data leaks

Module export in `src/index.ts` must be: `export default { fetch: app.fetch, async queue(batch, env) {...} }` plus `export { TenantAgent }` and `export { TenantProvisioningWorkflow }`.

### PHASE 5: Telegram Integration

**Template reference**: Master Bible v2 §4 has the complete Telegram webhook flow and abuse controls.

Build:
- `src/telegram/bot-api.ts` — Telegram Bot API wrapper (sendMessage, setWebhook, etc.)
- `src/telegram/commands.ts` — Handle /start, /help, /settings, /language
- `src/telegram/webhook.ts` — `POST /tg/webhook/:agentId` handler
- `POST /api/tenants/:id/telegram/setup` — Register bot + set webhook URL

**Contract**: Verify `X-Telegram-Bot-Api-Secret-Token` header equals `TELEGRAM_WEBHOOK_SECRET`. Decrypt per-agent bot token from `agents.telegram_bot_token_encrypted`. Route message to correct TenantAgent DO. Agent uses resumable streaming; keepAlive() prevents eviction during response generation.

### PHASE 6: Provisioning + Stripe

**Template reference**: Use `workflows-starter-template` patterns for the Workflow class definition, step API, retry logic, and waitForEvent. Use `x402-proxy-template` patterns for Stripe payment verification middleware.

Build:
- `src/workflows/provisioning.ts` — `TenantProvisioningWorkflow` (Cloudflare Workflow class) with steps:
  1. ValidateEvent (idempotent check via `stripe_events` table)
  2. CreateUser (D1 insert)
  3. CreateTenant (D1 insert)
  4. AllocateSubdomain (DNS via CF API)
  5. SeedTemplates (R2 copy)
  6. CreateTenantDO (DO stub.fetch() initialization)
  7. ActivateDefaultPacks (DO MCP tool registration)
  8. IssueApiKeys (crypto.randomUUID + D1 store)
  9. NotifyUser (Queue message)
- `src/api/signup.ts` — `POST /api/signup` triggers provisioning workflow
- `src/api/stripe.ts` — `POST /api/stripe/webhook` with signature verification using `STRIPE_WEBHOOK_SECRET`, idempotency via `stripe_events` table, plan mapping (starter $29/pro $79/business $149)

Write audit events to `audit_log` table via `AUDIT_QUEUE`.

### PHASE 7: Integrations + OAuth

**Template reference**: Use `openauth-template` patterns for OAuth flow, token exchange, and session management. Master Bible v2 §5 has the complete plugin system design.

Build `src/api/integrations.ts`:
- OAuth initiate flow (generate state, redirect to provider)
- `GET /oauth/:provider/callback` — Exchange code for tokens, encrypt with AES-256-GCM, store in `plugin_connections` table (`oauth_access_token_encrypted`, `oauth_refresh_token_encrypted`)
- List/disconnect integrations
- Token refresh logic (background Queue job refreshes before expiry)
- Redirect after OAuth completes to `DASHBOARD_URL` (from env), NOT `APP_URL`
- **Security rule** (from Master Bible): Only encrypted refresh tokens stored at rest. Short-lived access tokens exist only in DO memory and are never persisted.

### PHASE 8: Dashboard API + WebSocket

**Template reference**: Use `durable-chat-template` patterns for WebSocket connection management, Hibernation API, and real-time message broadcasting.

Build remaining API routes:
- `src/api/tenants.ts` — Full CRUD
- `src/api/users.ts` — `GET|POST|PATCH|DELETE /api/tenants/:id/users`
- `src/api/agents.ts` — Full CRUD for agents
- `src/api/workflows.ts` — Full CRUD + run history
- `src/api/memory.ts` — Search + CRUD (Vectorize for semantic search)
- `src/api/partners.ts` — Partner management + tenant assignment
- `src/api/dashboard/overview.ts` — Aggregate metrics
- `src/api/dashboard/analytics.ts` — Time-series data
- `src/api/dashboard/llm-cost.ts` — Cost breakdown by provider
- `src/api/ws.ts` — WebSocket endpoint. Auth via `?token=` query param (JWT). Message format: `{ type: string, timestamp: ISO8601 }`. Event types defined in TYPES-SPEC.

### PHASE 9: Dashboard MVP (SvelteKit)

**Template reference**: Study `saas-admin-template` for admin panel patterns and `react-router-hono-fullstack-template` for full-stack patterns. Adapt to SvelteKit. Follow `GLOBAL-CLAW-DASHBOARD-UX-PLAN.md` for the "Neural Cartography" design system.

Create `dashboard/` as a SvelteKit app on Cloudflare Pages:
- `npx sv create dashboard` (current Svelte CLI; choose SvelteKit + TypeScript + no demo on prompts)
- Add adapter: `cd dashboard && npm install -D @sveltejs/adapter-cloudflare`
- 4 MVP screens: Overview, Agents, Workflows, LLM Providers
- Design system: dark theme (`#0A0A0F` background, `#12121A` surfaces, see full palette in UX Plan)
- Typography: InstrumentSans for UI, GeistMono for data
- Tailwind CSS with design tokens from the UX plan
- Svelte stores + WebSocket client for real-time updates
- i18n with `svelte-i18n` (LV/RU/EN — Latvian and Russian are P0)
- Shared component library following the design system

Build: `cd dashboard && npm run build`

### PHASE 10: Integration Tests + Staging Deploy

1. Write integration tests in `tests/integration/` covering: tenant CRUD, auth flows, Telegram webhook, provisioning workflow, dashboard API
2. Run full test suite: `npm run verify:contracts && npm run typecheck && npm run lint && npm run test && npm run test:integration`
3. **Approval gate**: Before any staging deploy, pause and request explicit human approval.
4. Deploy Worker to staging: `npm run deploy:staging`
5. Deploy Pages to staging: `cd dashboard && npx wrangler pages deploy .svelte-kit/cloudflare --project-name=global-claw-dashboard`
6. Run staging smoke tests (health endpoint, auth flow, agent creation)

### PHASE 11: Post-MVP Dashboard Screens

**Template reference**: Follow `GLOBAL-CLAW-DASHBOARD-UX-PLAN.md` §3.4-3.11 wireframes for each screen.

Add remaining 7 screens to `dashboard/`:
- Memory (Timeline + Graph + Table views) — use D3 force-directed layout for graph view
- Integrations (1-click OAuth marketplace) — icon cards in responsive grid
- Conversations (Telegram message logs, split-pane) — 35%/65% split with message metadata
- Analytics (Usage charts, cost breakdown, peak hours heatmap) — recharts or Chart.js
- Tenants Admin (super-admin multi-tenant panel) — sortable table with slide-over detail
- Billing (Stripe portal integration, usage meters, plan comparison)
- Settings (Team management, API keys, branding, notifications, danger zone)

### PHASE 12: Partner Portal

**Template reference**: Master Bible v1 §6 (Go-to-market) and Master Bible v2 §2.1 describe the reseller program.

Build partner APIs and dashboard views:
- Partner signup and management
- Tenant spawning under partner (1-click)
- Earnings dashboard (30% recurring / 40-50% wholesale margin)
- Referral link system with attribution tracking

### PHASE 13: Production Deploy (MANUAL — DO NOT AUTO-EXECUTE)

**STOP HERE.** Output the following commands for human execution:
```bash
# 1. Set production secrets
npx wrangler secret put JWT_SECRET --env production
npx wrangler secret put ENCRYPTION_KEY --env production
npx wrangler secret put STRIPE_SECRET_KEY --env production
npx wrangler secret put STRIPE_WEBHOOK_SECRET --env production
npx wrangler secret put TELEGRAM_WEBHOOK_SECRET --env production

# 2. Production D1 and KV already created (IDs in wrangler.jsonc)
# D1 ID: d1306089-2049-44d7-b0d0-76fb99a74c96
# KV ID: f5752fe85e134eb3b76f0dfecc6a6fb6

# 3. Run production migrations
npm run db:migrate:production

# 4. Deploy
npx wrangler deploy --env production
cd dashboard && npx wrangler pages deploy .svelte-kit/cloudflare --project-name=global-claw-dashboard --branch=main

# 5. Verify
curl https://api.global-claw.com/api/health
curl https://app.global-claw.com
```

---

## Rules That Apply to ALL Phases

1. **Template-first** — Always check the Template Bible mapping before writing custom code. Scaffold, study, adapt.
2. **Cloudflare-only** — No AWS, Vercel, or external databases. D1 + DO + R2 + Queues + Workers AI + Workflows + KV + Vectorize + AI Gateway only.
3. **Provider-agnostic LLM** — NEVER hardcode providers. All from D1 `llm_providers` table. Admin dashboard manages providers at runtime.
4. **Agents SDK patterns** — TenantAgent MUST use Agents SDK v0.7+ patterns: MCP tools, resumable streaming, human-in-loop, keepAlive(), SQLite state.
5. **Tenant isolation** — Every tenant gets its own Durable Object. No cross-tenant data leaks. Fail-closed: missing tenant → 403/404, budget exceeded → hard stop.
6. **Fail-closed LLM governance** — All LLM calls through `src/lib/llm/executor.ts`. No raw `fetch()` to LLM APIs.
7. **TypeScript strict mode, no `any`** — Biome enforces this.
8. **ES modules only** — `"type": "module"` in package.json. Use `import`/`export`, never `require()`.
9. **Response format** — Success: `{ success: true, data: T, meta?: {...} }`. Error: `{ success: false, error: { code, message } }`
10. **Hono for routing, Drizzle for D1** — as specified in CLAUDE.md.
11. **LV/RU/EN first** — All user-facing strings support i18n. ICU MessageFormat.
12. **After each phase**: Run `npm run verify:contracts && npm run typecheck && npm run lint && npm run test && npm run test:integration`. Fix any failures before proceeding.
13. **Canonical docs change control** — Do not edit `CLAUDE.md`, `.claude/skills/global-claw-execution/SKILL.md`, `GLOBAL-CLAW-TYPES-SPEC.md`, or `wrangler.jsonc` unless contract inconsistencies are proven and human approval is given.

---

## Checkpoint Protocol

After completing each phase, write a brief checkpoint:
```
## Phase N Complete
- Template(s) used: [which templates informed this phase]
- Files created: [list]
- Tests: X passed, Y failed
- Blockers: [any issues]
- Next: Phase N+1
```

If you encounter a blocker that requires human input (missing API keys, Cloudflare auth issues, unclear requirements), **stop and ask** rather than making assumptions.

### Commit + Resume Protocol (mandatory)

After each phase passes validation:
```bash
git add -A
git commit -m "phase <N>: <short summary>"
```

If interrupted, resume from the latest committed phase checkpoint instead of redoing completed phases.

---

## Begin

Start with Phase -1. Read the Bible documents and technical specs in the order listed above. Then execute sequentially through Phase 12. Stop before Phase 13 (production deploy is manual).

## PROMPT END
