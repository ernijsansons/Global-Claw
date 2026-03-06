# Rollback Plan

## When to Rollback

Initiate rollback immediately if:

- [ ] Health endpoint returns non-200 status
- [ ] Error rate exceeds 5% in first 10 minutes
- [ ] Critical functionality (auth, tenants, agents) broken
- [ ] Data corruption detected
- [ ] Security vulnerability discovered

## Rollback Decision

**Time Limit:** Decision to rollback must be made within 15 minutes of deployment.

**Decision Makers:** Platform Lead or On-Call Engineer

## Rollback Steps

### 1. Immediate Worker Rollback

Use Cloudflare's version rollback feature:

```bash
# List recent deployments
npx wrangler deployments list --env production

# Rollback to previous version
npx wrangler rollback --env production
```

Or via Cloudflare Dashboard:
1. Go to Workers & Pages
2. Select `global-claw` worker
3. Click "Deployments" tab
4. Find previous stable version
5. Click "Rollback to this deployment"

### 2. Database Rollback (If Migration Applied)

**CAUTION:** D1 migrations are forward-only. Rollback requires manual intervention.

If data was corrupted or schema change caused issues:

1. **Stop Traffic:** Temporarily return 503 from health endpoint
2. **Export Data:** `npx wrangler d1 export global-claw-primary --env production --output backup.sql`
3. **Contact Support:** For complex rollbacks, contact Cloudflare support

### 3. Dashboard Rollback (If Deployed)

```bash
# List Pages deployments
npx wrangler pages deployments list global-claw-dashboard

# Rollback to previous deployment
npx wrangler pages deployments rollback global-claw-dashboard <deployment-id>
```

## Post-Rollback Actions

1. **Verify Rollback:** Run smoke tests on rolled-back version
2. **Notify Team:** Alert all stakeholders of rollback
3. **Root Cause Analysis:** Document what went wrong
4. **Fix Forward:** Address issues before next deployment attempt

## Communication Template

```
INCIDENT: Production rollback initiated

Time: [TIMESTAMP]
Environment: Production
Reason: [BRIEF DESCRIPTION]
Impact: [USER IMPACT]
Status: Rollback complete / in progress

Next Steps:
- Root cause analysis in progress
- ETA for fix: TBD
```

## Recovery Verification

After rollback, verify:

- [ ] Health endpoint returns 200
- [ ] Error rate returned to baseline
- [ ] User authentication working
- [ ] Core functionality restored
- [ ] No lingering issues in logs
