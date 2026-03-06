# Post-Release Monitoring Checklist

**Release:** v1.0.0
**Date:** 2026-03-06
**Status:** Active Monitoring

---

## Phase 1: Critical Window (0–2 hours)
**Check Frequency:** Every 15 minutes

### Health Endpoint
```bash
curl -s https://api.global-claw.com/api/health | jq .
```
- [ ] Returns 200 OK
- [ ] `success: true`
- [ ] `database.ok: true`
- [ ] Latency < 500ms

### Dashboard Availability
```bash
curl -s -o /dev/null -w "%{http_code}" https://app.global-claw.com/
```
- [ ] Returns 200

### API Error Rate
- [ ] Check Cloudflare Analytics → Workers → global-claw
- [ ] Error rate < 1%
- [ ] No 5xx spike

### Auth Validation
```bash
curl -s -o /dev/null -w "%{http_code}" https://api.global-claw.com/api/tenants
```
- [ ] Returns 401 (unauthorized correctly)

---

## Phase 2: Stabilization (2–24 hours)
**Check Frequency:** Every hour

### Core Metrics
| Metric | Target | Check Command |
|--------|--------|---------------|
| Health | 200 OK | `curl https://api.global-claw.com/api/health` |
| Uptime | > 99.9% | Cloudflare Analytics |
| Error Rate | < 0.5% | Cloudflare Analytics |
| P95 Latency | < 500ms | Cloudflare Analytics |

### Infrastructure Checks
- [ ] **D1 Database**
  - Queries succeeding
  - No timeout errors
  - Read/write latency normal

- [ ] **Queue Health**
  - `global-claw-audit`: No backlog
  - `global-claw-notifications`: No backlog
  - DLQ: Empty (no failed messages)

- [ ] **Worker Exceptions**
  - Cloudflare Dashboard → Workers → Logs
  - No unhandled exceptions
  - No memory limit errors

- [ ] **Durable Objects**
  - TenantAgent instances healthy
  - No storage errors

### Auth & Security
- [ ] JWT validation working
- [ ] Rate limiting active
- [ ] No unusual traffic patterns

---

## Phase 3: Extended Monitoring (24–72 hours)
**Check Frequency:** Twice daily (morning/evening)

### Daily Health Summary
| Check | Morning | Evening |
|-------|---------|---------|
| Health endpoint | [ ] OK | [ ] OK |
| Dashboard load | [ ] OK | [ ] OK |
| Error rate < 0.1% | [ ] Yes | [ ] Yes |
| P95 < 300ms | [ ] Yes | [ ] Yes |

### Weekly Metrics Review
- [ ] Total requests served
- [ ] Unique tenants active
- [ ] LLM token usage
- [ ] Cost tracking (D1, R2, Workers)

### Capacity Planning
- [ ] D1 storage usage (< 80%)
- [ ] R2 storage usage
- [ ] Queue throughput trending

---

## Alert Response Procedures

### Critical Alerts (Immediate Response)
| Alert | Threshold | Action |
|-------|-----------|--------|
| Health endpoint down | Non-200 for 2+ checks | Page on-call, check worker status |
| Error rate spike | > 5% | Check logs, consider rollback |
| D1 failures | Any | Check database health, contact CF support |

### Warning Alerts (15-minute Response)
| Alert | Threshold | Action |
|-------|-----------|--------|
| Latency increase | P95 > 1s | Check DO load, database queries |
| Queue backlog | > 50 messages | Check consumer health |
| Auth failures spike | > 10/min | Check for attack, rate limit |

---

## Monitoring Commands Quick Reference

```bash
# Health check
curl -s https://api.global-claw.com/api/health | jq .

# Dashboard status
curl -s -o /dev/null -w "%{http_code}\n" https://app.global-claw.com/

# Auth test (should 401)
curl -s -o /dev/null -w "%{http_code}\n" https://api.global-claw.com/api/tenants

# Worker deployments
npx wrangler deployments list --env production

# Secret verification
npx wrangler secret list --env production

# Tail worker logs (real-time)
npx wrangler tail global-claw --env production
```

---

## Escalation Contacts

| Role | Contact |
|------|---------|
| On-Call Engineer | [Configure] |
| Platform Lead | [Configure] |
| Cloudflare Support | https://support.cloudflare.com |

---

## Sign-Off

| Phase | Completed | Signed By | Date |
|-------|-----------|-----------|------|
| 0–2h monitoring | [ ] | | |
| 2–24h monitoring | [ ] | | |
| 24–72h monitoring | [ ] | | |
| Production stable | [ ] | | |
