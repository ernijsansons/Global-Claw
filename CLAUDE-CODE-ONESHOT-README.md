# GLOBAL-CLAW — Claude Code One-Shot Execution Package

## What You Have (Complete Inventory)

### Strategy Documents (WHAT to build)
| File | Purpose | Status |
|------|---------|--------|
| `GLOBAL-CLAW-MASTER-BIBLE-v2.docx` | Full PDR: product, architecture, business plan, pricing, GTM | Complete |
| `GLOBAL-CLAW-TEMPLATE-BIBLE-v1.docx` | Cloudflare template → component mapping (17 templates) | Complete |
| `BUSINESS_PLAN.md` | Original business plan with reseller model | Complete |
| `MASTER_BUILD_SPEC.json` | Infrastructure spec, API routes, data model, staging resources | Complete |
| `Global Claw.txt` | Original PDR source text | Complete |

### Design Documents (HOW it looks)
| File | Purpose | Status |
|------|---------|--------|
| `GLOBAL-CLAW-DASHBOARD-UX-PLAN.md` | Full design system + ALL 11 screen wireframes | Complete |
| `NEURAL-CARTOGRAPHY-PHILOSOPHY.md` | Design philosophy manifesto | Complete |
| `GLOBAL-CLAW-DASHBOARD-OVERVIEW.png` | Mission Control screen mockup (2560x1600) | Complete |
| `GLOBAL-CLAW-DASHBOARD-AGENTS.png` | Agent Management screen mockup | Complete |
| `GLOBAL-CLAW-DASHBOARD-WORKFLOWS.png` | Workflow Editor screen mockup | Complete |
| `GLOBAL-CLAW-DASHBOARD-LLM-PROVIDERS.png` | LLM Provider Router screen mockup | Complete |

### Technical Specifications (HOW it's structured)
| File | Purpose | Status |
|------|---------|--------|
| `GLOBAL-CLAW-TYPES-SPEC.md` | All TypeScript interfaces: DB models, API types, DO types, WS events | NEW |
| `GLOBAL-CLAW-GAP-ANALYSIS.md` | Comprehensive audit findings and resolution log | NEW |

### Claude Code Execution Files (HOW to build it)
| File | Purpose | Status |
|------|---------|--------|
| `CLAUDE.md` | Project instructions: commands, architecture rules, full API routes, middleware stack, encryption strategy, WebSocket spec, MVP scope | UPDATED |
| `.claude/settings.json` | Hooks: auto-format, LLM lock-in guard, infra guard, deploy warning | Complete |
| `.claude/skills/global-claw-arch/SKILL.md` | Architecture reference (stack versions, tenant model, templates) | Complete |
| `.claude/skills/global-claw-llm/SKILL.md` | LLM router patterns (provider-agnostic design, executor, routing) | Complete |
| `.claude/skills/global-claw-tenant/SKILL.md` | Tenant Agent DO patterns (memory, rate limiting, lifecycle) | Complete |
| `.claude/skills/global-claw-execution/SKILL.md` | 15-phase execution plan (Phase -1 to 13: consistency gate through production deploy) | UPDATED |

### Project Config Files (ready to use)
| File | Purpose | Status |
|------|---------|--------|
| `wrangler.jsonc` | Multi-environment Cloudflare config (staging IDs pre-filled) | NEW |
| `package.json` | Dependencies + scripts (including `@hono/zod-openapi`, migrations, contract checks) | NEW |
| `tsconfig.json` | TypeScript strict mode, Workers types, path aliases | NEW |
| `biome.json` | Linting: no any, no unused imports, tab indent, 120 width | NEW |
| `vitest.config.ts` | Miniflare pool workers config, 70% coverage threshold | NEW |
| `.env.example` | All environment variables documented | NEW |
| `.gitignore` | Ignore local secrets/cache/build artifacts | NEW |

### Database Migrations (4 required, applied in order)
| File | Purpose | Status |
|------|---------|--------|
| `migrations/0001_init.sql` | Core: tenants (status includes 'deleted'), users, tenant_users, subscriptions, api_keys, usage_daily | Complete |
| `migrations/0002_llm_providers.sql` | LLM: providers (seeded disabled, is_enabled=0), routing_rules, usage_log | Complete |
| `migrations/0003_agents_memory.sql` | Agents, plugins, workflows, feature_flags, partners | Complete |
| `migrations/0004_operational.sql` | audit_log, stripe_events (idempotency), performance indexes | NEW |

### Scripts
| File | Purpose | Status |
|------|---------|--------|
| `scripts/migrate.mjs` | Cross-platform Node.js migration runner (Windows + Linux) | NEW |
| `scripts/verify-contracts.mjs` | Contract consistency gate (schema/config/dependency checks) | NEW |
| `scripts/test-integration.mjs` | Safe integration test runner (passes when tests are absent) | NEW |

---

## How to Execute (The "Ralph Loop")

### Step 0: Prerequisites
- Cloudflare Workers paid plan (for Durable Objects + Workflows)
- Node.js 20+ installed
- Wrangler CLI authenticated: `npx wrangler login`

### Step 1: Copy everything to your project directory
```powershell
# PowerShell (Windows) — or use your file manager
$src = "Global Claw"
$dst = "C:\dev\Global Claw\global-claw"
Copy-Item -Recurse "$src\.claude" "$dst\" -Force
Copy-Item "$src\CLAUDE.md" "$dst\"
Copy-Item "$src\wrangler.jsonc" "$dst\"
Copy-Item "$src\package.json" "$dst\"
Copy-Item "$src\tsconfig.json" "$dst\"
Copy-Item "$src\biome.json" "$dst\"
Copy-Item "$src\vitest.config.ts" "$dst\"
Copy-Item "$src\.env.example" "$dst\"
Copy-Item -Recurse "$src\migrations" "$dst\" -Force
Copy-Item -Recurse "$src\scripts" "$dst\" -Force
```

### Step 2: Open Claude Code in the project
```bash
cd "C:/dev/Global Claw/global-claw"
claude
```

### Step 3: Execute the one-shot build
```
/global-claw-execution all
```

Claude Code will:
1. Read CLAUDE.md (automatic on session start)
2. Auto-load architecture + LLM + tenant skills (based on context)
3. Execute Phase -1 (consistency gate) through Phase 13 (production deploy)
4. Run verification at each phase checkpoint
5. If context compacts, the PreCompact hook preserves progress state
6. Resume from last checkpoint automatically
7. Phase 13 (production deploy) is MANUAL — Claude outputs commands, you run them

### Step 4: If it stalls or needs correction
```
/global-claw-execution 5   # Resume from Phase 5
```

---

## Execution Phases Overview

| Phase | Name | Estimated Time | Key Deliverable |
|-------|------|---------------|-----------------|
| -1 | Consistency Gate | 10 min | Automated verification of all 4 migrations, bindings, secrets |
| 0 | Pre-Scaffold Setup | 30 min | Cloudflare resources provisioned, IDs in config |
| 1 | Project Scaffold | 30 min | npm install, 4 migrations applied, dev server running |
| 2 | Auth + Core API + Utilities | 2 hours | JWT, API keys, middleware stack (origin-reflection CORS), encryption, types |
| 3 | LLM Router | 2 hours | Provider-agnostic routing, 3 adapters, circuit breaker |
| 4 | Tenant Agent DO + Queue Consumer | 3 hours | TenantAgent with SQLite, combined module export (fetch + queue) |
| 5 | Telegram Integration | 2 hours | Webhook → TenantAgent pipeline (TELEGRAM_WEBHOOK_SECRET for verification) |
| 6 | Provisioning Workflow | 1.5 hours | Zero-touch signup → tenant creation, stripe_events idempotency |
| 7 | Plugin System + OAuth | 2 hours | Google Calendar/Sheets integration |
| 8 | Dashboard API + WebSocket | 2 hours | Metrics, analytics, real-time events (token scrubbing in logs) |
| 9 | Dashboard Frontend (MVP) | 6 hours | 4 core screens in SvelteKit on Cloudflare Pages |
| 10 | Integration Testing + Staging Deploy | 4 hours | E2E tests, Worker API deploy + Pages deploy |
| 11 | Post-MVP Screens | 8 hours | 7 additional dashboard screens |
| 12 | Partner Portal | 4 hours | Referral system, earnings dashboard |
| 13 | Production Deploy | 1 hour | MANUAL — human runs deploy commands |

---

## Hooks In Action

### What happens when Claude writes code:
1. **PreToolUse prompt hook** checks: "Does this hardcode an LLM provider?" → BLOCK if yes
2. **PreToolUse prompt hook** checks: "Does this import AWS/Vercel?" → BLOCK if yes
3. Code is written
4. **PostToolUse command hook** runs: `npx biome check --write` → Auto-formats

### What happens on deployment:
1. **PostToolUse command hook** detects wrangler deploy → Prints environment warning

### What happens on context compaction:
1. **PreCompact prompt hook** ensures summary preserves: migration state, route status, test count, current phase

---

## The Missing Pieces You Still Need (Manual)

These can't be generated by Claude — they need your input:

1. **Cloudflare API tokens** — Create a Workers + D1 + R2 API token in the Cloudflare dashboard
2. **Stripe keys** — Get test/live keys from Stripe dashboard
3. **Telegram bot tokens** — Create bots via @BotFather
4. **LLM API keys** — Get keys from providers (stored encrypted in D1 via admin dashboard)
5. **Domain configuration** — Point global-claw.com DNS to Cloudflare
6. **AI Gateway setup** — Create gateway in Cloudflare dashboard

Store these as Wrangler secrets:
```bash
npx wrangler secret put STRIPE_SECRET_KEY
npx wrangler secret put STRIPE_WEBHOOK_SECRET
npx wrangler secret put JWT_SECRET
npx wrangler secret put ENCRYPTION_KEY
npx wrangler secret put TELEGRAM_WEBHOOK_SECRET
```

---

## Document Consistency (55 findings — all resolved)

### Original audit (38 gaps)
| Issue | Resolution |
|-------|------------|
| No actual config files (wrangler.jsonc, package.json, etc.) | Created all 5 files |
| CLAUDE.md listed wrong migration names | Fixed to match actual files |
| No Phase 0 for resource provisioning | Added Phase 0 |
| No .env.example | Created .env.example |
| Dashboard UX plan missing 5 screens | Added all 5 wireframes |
| No TypeScript interfaces spec | Created GLOBAL-CLAW-TYPES-SPEC.md |
| Frontend tech undecided | SvelteKit chosen everywhere |
| + 31 more medium/low gaps | All resolved (see GAP-ANALYSIS.md) |

### Post-audit review (17 additional findings)
| Issue | Severity | Resolution |
|-------|----------|------------|
| Tenant status CHECK missing 'deleted' | CRITICAL | Added to 0001_init.sql |
| Missing audit_log table | CRITICAL | Created 0004_operational.sql |
| Missing stripe_events table | CRITICAL | Created 0004_operational.sql |
| Two conflicting `export default` | CRITICAL | Combined module export pattern |
| wrangler.jsonc missing per-env R2/Queues/Vectorize | CRITICAL | Full per-env overrides |
| Production deploy permission conflict | CRITICAL | MANUAL STEP in Phase 13 |
| Telegram secret naming inconsistent | CRITICAL | Canonicalized in all docs |
| Shell commands not cross-platform | HIGH | Node.js scripts/migrate.mjs |
| Seed providers enabled with placeholders | HIGH | is_enabled=0 |
| CORS uses invalid `*.workers.dev` pattern | HIGH | Origin-reflection pattern |
| vitest.config.ts missing Queue/AI/Vectorize | HIGH | Added queueProducers + mock docs |
| No SvelteKit Pages deploy path | HIGH | Added to Phase 10 |
| Phase count drift across docs | MEDIUM | Unified: Phase -1 to 13 |
| ORM choice inconsistent | MEDIUM | Drizzle primary, raw SQL for complex |
| WebSocket token in logs | MEDIUM | Logger scrubs ?token= |
| Gap claim overstated (38 vs actual) | MEDIUM | Updated to 55 total |
| Workflow API path drift | MEDIUM | Standardized routes |

---

## LLM Provider Decision (NEEDS YOUR INPUT)

The MASTER_BUILD_SPEC originally specified DeepSeek/Kimi/MiniMax as primary providers.
The migration seeds Anthropic/Qwen/OpenAI instead.

**Current state:** Migration 0002 seeds Anthropic (60% weight), Qwen (30%), OpenAI (10%) — all seeded **disabled** (`is_enabled=0`) with placeholder API keys. No provider will be active until you add real keys via the admin dashboard.

If you want to change to DeepSeek/Kimi/MiniMax, update the INSERT statements in `migrations/0002_llm_providers.sql`. The system is provider-agnostic — any provider can be added/removed via the admin dashboard at runtime.
