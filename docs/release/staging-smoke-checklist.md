# Staging Smoke Test Checklist

## Pre-Deploy Checks

- [ ] All tests pass: `npm run test`
- [ ] Lint passes: `npm run lint`
- [ ] Types pass: `npm run typecheck`
- [ ] Contracts validated: `npm run verify:contracts`
- [ ] Migrations applied: `npm run db:migrate:staging`

## Deploy

```bash
npm run deploy:staging
```

## Smoke Tests

### Health Check
```bash
curl https://global-claw-staging.ernijs-ansons.workers.dev/api/health
```
**Expected:** `{ "success": true, "data": { "status": "ok", ... } }`

### Root Endpoint
```bash
curl https://global-claw-staging.ernijs-ansons.workers.dev/
```
**Expected:** `{ "success": true, "data": { "name": "Global-Claw API", "version": "1.0.0", "environment": "staging" } }`

### Auth Register
```bash
curl -X POST https://global-claw-staging.ernijs-ansons.workers.dev/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "password": "testpassword123"}'
```
**Expected:** `{ "success": true, "data": { "token": "...", "user": {...} } }`

### Auth Login
```bash
curl -X POST https://global-claw-staging.ernijs-ansons.workers.dev/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "password": "testpassword123"}'
```
**Expected:** `{ "success": true, "data": { "token": "..." } }`

### Protected Endpoint (without auth)
```bash
curl https://global-claw-staging.ernijs-ansons.workers.dev/api/tenants
```
**Expected:** 401 `{ "success": false, "error": { "code": "UNAUTHORIZED", ... } }`

### 404 Handler
```bash
curl https://global-claw-staging.ernijs-ansons.workers.dev/nonexistent
```
**Expected:** 404 `{ "success": false, "error": { "code": "NOT_FOUND", ... } }`

## Success Criteria

- [ ] Health endpoint returns 200 with status "ok"
- [ ] Root endpoint returns API info
- [ ] Protected endpoints return 401 without auth
- [ ] 404 handler works for unknown paths
- [ ] No 500 errors in Cloudflare dashboard logs

## Post-Smoke Actions

1. Check Cloudflare dashboard for any errors
2. Verify D1 database has expected schema
3. Verify KV namespace is accessible
4. Verify R2 bucket is accessible
