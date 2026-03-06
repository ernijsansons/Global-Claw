# Production Deployment Preflight Checklist

**Date:** 2026-03-06
**Target:** Production environment
**Commit:** `23fd045fb697fecf57e475546696ef890206ecbd`

## 1. Required Secrets

The following secrets must be configured in the production environment.
**Verification command:** `npx wrangler secret list --env production`

| Secret Name | Purpose | Status |
|-------------|---------|--------|
| `JWT_SECRET` | HMAC-SHA256 JWT signing | REQUIRED |
| `ENCRYPTION_KEY` | AES-256-GCM secrets at rest | REQUIRED |
| `STRIPE_SECRET_KEY` | Stripe API calls | REQUIRED |
| `STRIPE_WEBHOOK_SECRET` | Webhook signature verification | REQUIRED |
| `TELEGRAM_WEBHOOK_SECRET` | Telegram webhook validation | REQUIRED |

**To set secrets:**
```bash
npx wrangler secret put JWT_SECRET --env production
npx wrangler secret put ENCRYPTION_KEY --env production
npx wrangler secret put STRIPE_SECRET_KEY --env production
npx wrangler secret put STRIPE_WEBHOOK_SECRET --env production
npx wrangler secret put TELEGRAM_WEBHOOK_SECRET --env production
```

## 2. Production Bindings (wrangler.jsonc)

| Binding | Type | Value | Status |
|---------|------|-------|--------|
| `DB` | D1 | `d1306089-2049-44d7-b0d0-76fb99a74c96` | CONFIGURED |
| `RATE_LIMIT_KV` | KV | `f5752fe85e134eb3b76f0dfecc6a6fb6` | CONFIGURED |
| `ASSETS` | R2 | `global-claw-assets` | CONFIGURED |
| `AUDIT_QUEUE` | Queue | `global-claw-audit` | CONFIGURED |
| `NOTIFICATION_QUEUE` | Queue | `global-claw-notifications` | CONFIGURED |
| `MEMORY_INDEX` | Vectorize | `global-claw-memory` | CONFIGURED |
| `AI` | Workers AI | (automatic) | CONFIGURED |
| `TENANT_AGENT` | DO | `TenantAgent` | CONFIGURED |
| `PROVISIONING_WORKFLOW` | Workflow | `tenant-provisioning` | CONFIGURED |

**Production URLs:**
- Worker: `https://api.global-claw.com`
- Dashboard: `https://app.global-claw.com`
- Route: `api.global-claw.com/*` (zone: global-claw.com)

## 3. Migration Files

| Migration | Purpose | Status |
|-----------|---------|--------|
| `0001_init.sql` | Core tables (tenants, users, subscriptions) | PRESENT |
| `0002_llm_providers.sql` | LLM providers, routing rules | PRESENT |
| `0003_agents_memory.sql` | Agents, plugins, workflows, partners | PRESENT |
| `0004_operational.sql` | Audit log, Stripe events, indexes | PRESENT |

## 4. Rollback Readiness

| Item | Status |
|------|--------|
| Rollback plan documented | docs/release/rollback-plan.md |
| Worker rollback command | `npx wrangler rollback --env production` |
| Pages rollback command | `npx wrangler pages deployments rollback <id>` |
| Decision time limit | 15 minutes |
| Decision makers | Platform Lead / On-Call Engineer |

## 5. Deploy Commands (MANUAL EXECUTION REQUIRED)

```bash
# Step 1: Run database migrations
npm run db:migrate:production

# Step 2: Deploy worker
npm run deploy:production

# Step 3: Deploy dashboard
cd dashboard && npx wrangler pages deploy .svelte-kit/cloudflare \
  --project-name=global-claw-dashboard \
  --branch=main
```

## 6. Pre-Deploy Validation

- [x] All gates pass on main
- [x] wrangler.jsonc production env configured
- [x] Migration files present (0001-0004)
- [x] Rollback plan documented
- [ ] **Secrets verified** (manual check required)

---

## APPROVAL GATE

**All preflight checks complete. Production deployment requires explicit approval.**

**APPROVAL NEEDED: Reply "PROCEED_PRODUCTION_DEPLOY" to continue.**
