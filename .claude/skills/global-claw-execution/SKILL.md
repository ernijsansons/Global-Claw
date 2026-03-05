---
name: global-claw-execution
description: Master execution plan for one-shot autonomous build. Canonical contract for phases -1 through 13.
disable-model-invocation: true
argument-hint: "[phase number or 'all']"
---

# GLOBAL-CLAW - One-Shot Execution Plan

## Usage
- Run `/global-claw-execution all` for full execution.
- Run `/global-claw-execution <phase>` to resume.

## Non-Negotiable Contract

### Source Of Truth
- Primary implementation contract: `CLAUDE.md`
- Execution workflow: this file
- Type contract: `GLOBAL-CLAW-TYPES-SPEC.md`
- Runtime config: `wrangler.jsonc`
- DB schema: `migrations/0001..0004`

If these disagree, fix documents before coding.

### Secrets Contract
Required secrets (Wrangler secrets + `.dev.vars` locally):
- `JWT_SECRET`
- `ENCRYPTION_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `TELEGRAM_WEBHOOK_SECRET`

Optional provider secrets (only if integrations enabled):
- `GOOGLE_OAUTH_CLIENT_ID`
- `GOOGLE_OAUTH_CLIENT_SECRET`
- `NOTION_OAUTH_CLIENT_ID`
- `NOTION_OAUTH_CLIENT_SECRET`

Important:
- `TELEGRAM_BOT_TOKEN` is NOT an env var.
- Bot tokens are per-agent and stored encrypted in `agents.telegram_bot_token_encrypted`.

### Non-Secret Vars (wrangler.jsonc `vars`)
- `ENVIRONMENT`
- `APP_URL`
- `AI_GATEWAY_SLUG`

### Database Contract (4 migrations required)
1. `0001_init.sql`
- `tenants` (status includes `deleted`)
- `users`, `tenant_users`, `subscriptions`, `api_keys`, `usage_daily`

2. `0002_llm_providers.sql`
- `llm_providers`, `llm_routing_rules`, `llm_usage_log`
- Seed providers inserted with `is_enabled=0`

3. `0003_agents_memory.sql`
- `agents`, `plugin_connections`, `workflows`, `workflow_runs`, `feature_flags`, `partners`, `tenant_partners`

4. `0004_operational.sql`
- `audit_log`, `stripe_events`
- performance indexes

### Route/File Contract
- `POST /api/auth/register` -> `src/api/auth.ts`
- `POST /api/auth/login` -> `src/api/auth.ts`
- `POST /api/auth/refresh` -> `src/api/auth.ts`
- `GET|POST /api/tenants` -> `src/api/tenants.ts`
- `GET|PATCH|DELETE /api/tenants/:id` -> `src/api/tenants.ts`
- `GET|POST|PATCH|DELETE /api/tenants/:id/agents` -> `src/api/agents.ts`
- `GET|POST|PATCH|DELETE /api/tenants/:id/workflows` -> `src/api/workflows.ts`
- `GET|POST|DELETE /api/tenants/:id/integrations` -> `src/api/integrations.ts`
- `GET|POST|DELETE /api/tenants/:id/memory` -> `src/api/memory.ts`
- `POST /api/signup` -> `src/api/signup.ts`
- `POST /api/stripe/webhook` -> `src/api/stripe.ts`
- `GET|POST|PATCH|DELETE /api/providers` -> `src/api/providers.ts`
- `GET|POST|PATCH|DELETE /api/routing-rules` -> `src/api/routing-rules.ts`
- `GET /api/dashboard/overview` -> `src/api/dashboard/overview.ts`
- `GET /api/dashboard/analytics` -> `src/api/dashboard/analytics.ts`
- `GET /api/dashboard/llm-cost` -> `src/api/dashboard/llm-cost.ts`
- `GET /api/health` -> `src/api/health.ts`
- `GET /api/ws` -> `src/api/ws.ts`
- `GET|POST|PATCH|DELETE /api/tenants/:id/users` -> `src/api/users.ts`
- `GET|POST /api/partners` -> `src/api/partners.ts`
- `GET /api/partners/:pid` -> `src/api/partners.ts`
- `GET|POST /api/partners/:pid/tenants` -> `src/api/partners.ts`
- `POST /tg/webhook/:agentId` -> `src/telegram/webhook.ts`
- `POST /api/tenants/:id/telegram/setup` -> `src/telegram/webhook.ts`
- `GET /oauth/:provider/callback` -> `src/api/integrations.ts`

Telegram webhook contract:
- Path includes `agentId` to resolve tenant/agent.
- Header `X-Telegram-Bot-Api-Secret-Token` must equal `TELEGRAM_WEBHOOK_SECRET`.

### Platform Rules
- Use cross-platform npm/node commands only.
- No bash-only loops in scripts.
- Production deploy is manual due Claude permissions.

---

## PHASE -1: Consistency Gate
Goal: validate contracts before coding.

Actions:
1. `npm install`
2. `npm run verify:contracts`
3. `npm run typecheck`

Exit criteria:
- Contract script passes.
- Type generation + TS check passes.

---

## PHASE 0: Cloudflare Resource Setup
Goal: create or verify required Cloudflare resources.

Required resources:
- D1: `global-claw-primary`
- KV: `RATE_LIMIT_KV`
- R2: `global-claw-assets`
- Queues: `global-claw-audit`, `global-claw-notifications`, `global-claw-audit-dlq`
- Vectorize: `global-claw-memory`

Actions:
1. Create missing resources with Wrangler.
2. Fill IDs in `wrangler.jsonc`.
3. Create `.dev.vars` from `.env.example`.

Exit criteria:
- `npx wrangler whoami` works.
- D1 and KV IDs are not placeholders for active env.

---

## PHASE 1: Scaffold + Migrations
Goal: initialize project skeleton and DB.

Actions:
1. Create source/test folder structure.
2. Generate worker types: `npx wrangler types`.
3. Apply migrations in order:
   - `npm run db:migrate:local`

Exit criteria:
- All 4 migrations applied.
- `GET /api/health` minimal endpoint works.

---

## PHASE 2: Types + Core Middleware + Auth Foundation
Goal: establish type safety, middleware stack, and auth primitives.

Build:
- `src/types/env.ts` and shared types from `GLOBAL-CLAW-TYPES-SPEC.md`
- `src/lib/crypto.ts` (AES-256-GCM)
- `src/lib/errors.ts`
- Middleware:
  - `src/middleware/cors.ts`
  - `src/middleware/logger.ts`
  - `src/middleware/rate-limit.ts`
  - `src/middleware/tenant-context.ts`
  - `src/middleware/error-handler.ts`
- Auth primitives:
  - `src/lib/auth/jwt.ts`
  - `src/lib/auth/api-key.ts`

Exit criteria:
- `npm run typecheck`
- `npm run test` (or unit subset if tests are staged)

---

## PHASE 3: LLM Router
Goal: fail-closed, provider-agnostic routing.

Build:
- `src/lib/llm/providers/{base,anthropic,qwen,openai}.ts`
- `src/lib/llm/router.ts`
- `src/lib/llm/circuit-breaker.ts`
- `src/lib/llm/executor.ts`
- `src/lib/llm/prompt-loader.ts`
- Provider/routing APIs

Rules:
- All LLM calls go via executor.
- No direct provider fetches outside executor.
- Decrypt provider keys only in execution path.

Exit criteria:
- LLM router/circuit breaker tests pass.

---

## PHASE 4: Tenant Durable Object
Goal: per-tenant runtime isolation and message orchestration.

Build:
- `src/agents/tenant-agent.ts`
- DO initialization + conversation/memory logic
- budget enforcement via D1 plan/usage data

Module export rule:
- Single default export object containing `fetch` and `queue` handlers where needed.

Exit criteria:
- DO initialization and tenant isolation tests pass.

---

## PHASE 5: Telegram Integration
Goal: wire Telegram updates into tenant agents safely.

Build:
- `src/telegram/bot-api.ts`
- `src/telegram/commands.ts`
- `src/telegram/webhook.ts`
- `POST /api/tenants/:id/telegram/setup`

Contract:
- Webhook endpoint: `/tg/webhook/:agentId`
- Header verification with `TELEGRAM_WEBHOOK_SECRET`

Exit criteria:
- secret verification test
- routing to correct tenant/agent test
- dedupe test for repeated updates

---

## PHASE 6: Provisioning + Stripe
Goal: zero-touch tenant provisioning and billing lifecycle.

Build:
- `src/workflows/provisioning.ts`
- `src/api/signup.ts`
- `src/api/stripe.ts`

Contract:
- Stripe idempotency must use `stripe_events` table.
- Audit events written into `audit_log`.

Exit criteria:
- workflow integration test
- webhook idempotency test

---

## PHASE 7: Integrations + OAuth
Goal: plugin integrations via OAuth with encrypted token storage.

Build:
- OAuth flow in `src/api/integrations.ts` (+ helper libs)
- Store tokens in `plugin_connections` (`oauth_*_token_encrypted`)
- soft-disable by `status` transitions, not unknown columns

Exit criteria:
- OAuth state validation test
- token encryption + refresh flow test

---

## PHASE 8: Dashboard API + WebSocket
Goal: dashboard data + real-time stream.

Build:
- Dashboard APIs
- `src/api/ws.ts`

WS contract:
- Message types must match `GLOBAL-CLAW-TYPES-SPEC.md`
- `timestamp` format must be consistent across docs and code
- scrub credentials from logs

Exit criteria:
- WebSocket auth and tenant scoping tests

---

## PHASE 9: Dashboard MVP (4 screens)
Goal: SvelteKit dashboard MVP on Cloudflare Pages.

Build under `dashboard/`:
- Overview
- Agents
- Workflows
- Providers
- shared components, stores, i18n (LV/RU/EN)

Exit criteria:
- `cd dashboard && npm run build`

---

## PHASE 10: Integration Tests + Staging Deploy
Goal: validate end-to-end and deploy staging.

Actions:
1. run integration tests
2. deploy Worker staging
3. deploy Pages staging
4. run staging smoke checks

Exit criteria:
- staging health endpoint healthy
- critical flows pass on staging

---

## PHASE 11: Post-MVP Screens
Goal: implement remaining 7 dashboard screens.

Screens:
- Memory
- Integrations
- Conversations
- Analytics
- Tenants Admin
- Billing
- Settings

---

## PHASE 12: Partner Portal
Goal: reseller workflow and earnings visibility.

Build:
- partner signup
- partner tenant management
- partner earnings dashboard
- partner APIs

---

## PHASE 13: Production Deploy (Manual)
Goal: production rollout with human approval.

Manual-only steps:
1. set production secrets
2. pre-deploy checks
3. deploy Worker + Pages
4. post-deploy smoke + monitoring checks

Exit criteria:
- production health green
- monitoring alerts configured

---

## Verification Commands (Canonical)
- `npm run verify:contracts`
- `npm run lint`
- `npm run typecheck`
- `npm run test`
- `npm run test:integration` (when integration tests exist)
- `npm run db:migrate:local`
- `npm run deploy:staging`

## Checkpoint Format
At the end of each phase, persist:
- completed phase number
- migrations applied
- unresolved blockers
- pending secrets/resources
- test status (passed/failed with counts)
