# Pull Request: Pre-Deploy Hardening

**Branch:** `release/predeploy-hardening-2026-03-05`
**Base:** `main`
**Date:** 2026-03-05

## Summary

This PR completes pre-production hardening for Global-Claw v1.0.0, addressing security, testing, configuration, and operational readiness requirements.

## Changes

### Bug Fixes
- **fix(rate-limit):** Increase KV TTL minimum to 60 seconds (Cloudflare requirement)
- **fix(health):** Move health endpoint before auth-protected routes to prevent 401
- **fix(config):** Add durable_objects, workflows, ai bindings to staging/production envs

### Test Coverage
- **test(security):** Add crypto unit tests (19 tests) - AES-256-GCM, constant-time comparison
- **test(security):** Add Stripe signature tests (15 tests) - HMAC-SHA256, replay protection

### Documentation
- **docs(release):** Add staging-smoke-checklist.md
- **docs(release):** Add production-runbook.md
- **docs(release):** Add rollback-plan.md
- **docs(release):** Add go-no-go.md

### Configuration
- **chore:** Make lint non-mutating (biome check vs biome check --write)
- **chore:** Add .playwright-mcp/ to .gitignore

## Quality Gates

| Gate | Status |
|------|--------|
| `npm run lint` | **PASS** (14 complexity warnings, 0 errors) |
| `npm run typecheck` | **PASS** |
| `npm run test` | **PASS** (97/97 tests) |
| `npm run verify:contracts` | **PASS** |

## Staging Verification

| Check | Status |
|-------|--------|
| Deploy | **PASS** - Version 2b9d1ec1 |
| Health endpoint | **PASS** - 200 OK |
| Root endpoint | **PASS** - Returns API info |
| Auth protection | **PASS** - 401 for unauthenticated |
| 404 handler | **PASS** - Returns proper error |

**Staging URL:** https://global-claw-staging.ernijs-ansons.workers.dev

## Commits (10)

```
8e5d45e chore(format): fix wrangler.jsonc formatting
fb9dd15 fix(config): address audit findings for production readiness
c44c9c8 fix(lint): remove unused type imports from index.ts
5089bd8 docs(release): add deployment runbook artifacts
255ae84 fix(health): move health endpoint before auth-protected routes
0246be9 fix(rate-limit): increase KV TTL minimum to 60 seconds
ceaf77e test(security): add unit tests for crypto and stripe signature
e88085e fix(dashboard): auto-fix biome formatting issues
84b7c38 fix(api): align API handlers with D1 schema
caca298 fix(tests): align test schema with production migrations
```

## Files Changed

### New Files
- `tests/unit/crypto.test.ts`
- `tests/unit/stripe-signature.test.ts`
- `docs/release/staging-smoke-checklist.md`
- `docs/release/production-runbook.md`
- `docs/release/rollback-plan.md`
- `docs/release/go-no-go.md`
- `docs/release/PR-SUMMARY.md`

### Modified Files
- `src/index.ts` - Health endpoint positioning
- `src/middleware/rate-limit.ts` - KV TTL fix
- `wrangler.jsonc` - Env-scoped bindings
- `.gitignore` - Playwright logs exclusion
- `biome.json` - Svelte override

## Production Deploy (Manual)

After merge, production deployment requires manual execution:

```bash
npm run db:migrate:production
npm run deploy:production
curl https://api.global-claw.com/api/health
```

See `docs/release/production-runbook.md` for complete procedures.

## Checklist

- [x] All quality gates pass
- [x] Staging deployed and verified
- [x] Release documentation complete
- [x] No new features (hardening only)
- [ ] Remote configured and branch pushed
- [ ] PR created
- [ ] Code review approved
- [ ] Merge to main
