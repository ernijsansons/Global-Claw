# Rollback Readiness

**Date:** 2026-03-06
**Deployment:** Production v1.0.0
**Worker Version:** `fe075694-7f5a-4baf-88d2-a6376ca5a134`
**Pages Deployment:** `978dbdae`

## Rollback Triggers

Initiate rollback immediately if ANY of the following occur:

| Trigger | Threshold | Action |
|---------|-----------|--------|
| Health endpoint failure | Non-200 response | Immediate rollback |
| Error rate spike | > 5% in first 10 minutes | Immediate rollback |
| Auth failures | Mass 401s on valid tokens | Immediate rollback |
| Data corruption | Any evidence | Immediate rollback + investigation |
| Security vulnerability | Any discovery | Immediate rollback |
| Tenant isolation breach | Cross-tenant data access | Immediate rollback |

## Decision Window

| Parameter | Value |
|-----------|-------|
| Decision Window | 15 minutes from deploy |
| Decision Owner | Platform Lead / On-Call Engineer |
| Escalation Path | Platform Lead → CTO |

## Rollback Commands

### Worker Rollback

```bash
# List recent deployments to find previous version
npx wrangler deployments list --env production

# Rollback to previous version
npx wrangler rollback --env production

# Verify rollback
npx wrangler deployments list --env production
```

### Pages Rollback

```bash
# List Pages deployments
npx wrangler pages deployments list global-claw-dashboard

# Rollback to previous deployment (replace <deployment-id>)
npx wrangler pages deployments rollback global-claw-dashboard <deployment-id>
```

### D1 Database

**CAUTION:** D1 migrations are forward-only. Database rollback requires manual intervention.

If schema rollback is needed:
1. Stop traffic (return 503 from all endpoints)
2. Export current data: `npx wrangler d1 export global-claw-primary --env production --output backup.sql`
3. Contact Cloudflare support for complex rollbacks
4. Apply reverse migration manually if prepared

## Pre-Rollback Checklist

- [ ] Confirm symptoms match rollback criteria
- [ ] Notify team via Slack/Discord
- [ ] Document incident timeline
- [ ] Take snapshot of error logs
- [ ] Confirm decision with Platform Lead

## Post-Rollback Verification

After rollback, verify:

- [ ] Health endpoint returns 200
- [ ] Error rate returns to baseline
- [ ] User authentication working
- [ ] Core functionality restored
- [ ] No lingering errors in logs

## Communication Template

```
INCIDENT: Production rollback initiated

Time: [TIMESTAMP]
Environment: Production
Reason: [BRIEF DESCRIPTION]
Impact: [USER IMPACT]
Status: Rollback complete / in progress

Components Affected:
- Worker: [rolled back / unchanged]
- Dashboard: [rolled back / unchanged]
- Database: [unchanged / investigation needed]

Next Steps:
- Root cause analysis in progress
- ETA for fix: TBD
```

## Current Deployment State

| Component | Current Version | Previous Version |
|-----------|-----------------|------------------|
| Worker | `fe075694-7f5a-4baf-88d2-a6376ca5a134` | N/A (first deploy) |
| Dashboard | `978dbdae` | N/A (first deploy) |
| D1 Schema | v1.0.0 (0001-0004 applied) | N/A (first deploy) |

**Note:** This is the initial production deployment. No previous versions exist for rollback. If issues occur, the worker can be rolled back to an empty state or disabled entirely.

## Emergency Contacts

| Role | Contact Method |
|------|----------------|
| Platform Lead | [Configure in team docs] |
| On-Call Engineer | [Configure in team docs] |
| Cloudflare Support | support.cloudflare.com |
