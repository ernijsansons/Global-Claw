# Production Deployment Runbook

## Overview

This runbook covers the production deployment process for Global-Claw.

**Owner:** Platform Team
**Last Updated:** 2026-03-05

## Pre-Deployment Checklist

### Code Quality Gates

- [ ] All tests pass: `npm run test` (97/97 passing)
- [ ] Lint passes: `npm run lint`
- [ ] Types pass: `npm run typecheck`
- [ ] Contracts validated: `npm run verify:contracts`
- [ ] Security scan completed (Phase 4 verification)

### Staging Verification

- [ ] Staging smoke tests pass (see `staging-smoke-checklist.md`)
- [ ] No critical errors in staging logs (last 24h)
- [ ] Staging has run with current code for minimum 4 hours

### Go/No-Go Approval

- [ ] Go/no-go checklist completed (see `go-no-go.md`)
- [ ] Product owner approval obtained
- [ ] On-call engineer identified

## Deployment Steps

### 1. Apply Database Migrations

```bash
npm run db:migrate:production
```

Verify migration success:
```bash
npx wrangler d1 execute global-claw-primary --env production \
  --command "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
```

Expected tables: `agents`, `api_keys`, `audit_log`, `feature_flags`, `llm_providers`, `llm_routing_rules`, `llm_usage_log`, `partners`, `plugin_connections`, `stripe_events`, `subscriptions`, `tenant_partners`, `tenant_users`, `tenants`, `usage_daily`, `users`, `workflow_runs`, `workflows`

### 2. Set/Verify Secrets

Ensure all secrets are set (one-time or when rotating):

```bash
# Check existing secrets
npx wrangler secret list --env production

# Set secrets if needed (MANUAL - requires human input)
npx wrangler secret put JWT_SECRET --env production
npx wrangler secret put ENCRYPTION_KEY --env production
npx wrangler secret put STRIPE_SECRET_KEY --env production
npx wrangler secret put STRIPE_WEBHOOK_SECRET --env production
npx wrangler secret put TELEGRAM_WEBHOOK_SECRET --env production
```

### 3. Deploy Worker

```bash
npm run deploy:production
```

Expected output:
- Upload size: ~300-350 KiB
- Worker Startup Time: <50ms
- All bindings listed correctly

### 4. Verify Deployment

Health check:
```bash
curl https://api.global-claw.com/api/health
```

Expected: `{ "success": true, "data": { "status": "ok", ... } }`

### 5. Deploy Dashboard (Optional)

If dashboard changes are included:

```bash
cd dashboard && npm install && npm run build
npx wrangler pages deploy .svelte-kit/cloudflare --project-name global-claw-dashboard --branch production
```

## Post-Deployment Verification

1. **Health Check:** `curl https://api.global-claw.com/api/health`
2. **Root Endpoint:** `curl https://api.global-claw.com/`
3. **Dashboard:** Visit https://app.global-claw.com
4. **Cloudflare Dashboard:** Check for errors in last 15 minutes

## Rollback Procedure

If issues are detected, see `rollback-plan.md` for immediate rollback steps.

## Incident Contacts

| Role | Contact |
|------|---------|
| Platform Lead | TBD |
| On-Call Engineer | TBD |
| Product Owner | TBD |
