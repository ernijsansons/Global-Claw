# Global-Claw — Business Plan
**Version:** v1.0 (Feb 2026)
**Domain:** global-claw.com
**Classification:** Confidential

---

## Executive Summary

Global-Claw is a **Cloudflare-native, Telegram-first AI automation SaaS** for non-US markets. Businesses pay, receive an instantly provisioned Telegram bot + dashboard, and are live in under 10 seconds — zero setup required.

**The distribution engine is resellers.** Agencies, MSPs, and local "digital consultants" in Europe, MENA, LATAM, and South Asia resell Global-Claw under their own brand. Global-Claw charges wholesale; resellers own the customer relationship.

**Why non-US:** Telegram has dominant messaging market share in DACH, Eastern Europe, MENA, and South Asia. US-centric competitors (built on Slack/Teams/SMS) do not compete here. Reseller ecosystems in these markets are active, under-served by SaaS tooling, and hungry for recurring revenue.

---

## 1. The Opportunity

### Why Telegram Outside the US

| Region | Telegram Active Users | SMB Density | Reseller Ecosystem |
|--------|----------------------|-------------|-------------------|
| DACH (DE/AT/CH) | 35M+ | High spend | Strong agencies |
| Eastern Europe (PL/RO/CZ/Baltics) | 60M+ | Medium spend | Very active IT MSPs |
| MENA (UAE/SA/EG/MA) | 80M+ | High spend | Fast-growing |
| Southern Europe (ES/IT/PT) | 50M+ | High density | Agency-heavy |
| South Asia (IN) | 200M+ | Massive SMB base | Price-sensitive but volume |
| LATAM (MX/BR/CO/CL) | 70M+ | Medium spend | WhatsApp-first but Telegram real |

WhatsApp-first solutions carry per-conversation API fees (Meta Business API: $0.03–0.08/conversation). Telegram is free. This creates structurally better unit economics for both Global-Claw and its customers.

### The Gap No One Fills

US-built AI automation tools (Make, Zapier AI, ChatBase, Tidio) are:
- Priced in USD with no PPP localization
- English-only or low-quality translations
- Not Telegram-native
- Not reseller-friendly (no white-label, no margin structure)
- Focused on email/Slack/website chat

Global-Claw is none of those things.

---

## 2. Product

### What the Customer Gets

**One tenant. Immediately live. No technical knowledge required.**

| Component | Description |
|-----------|-------------|
| Telegram Bot | Pre-wired, ready to use via `/start` link |
| Web Dashboard | 3 tabs: Overview, Plugins, Packs |
| Preset Packs | Workflows enabled by vertical (salon, clinic, real estate, etc.) |
| Plugin Marketplace | 1-click OAuth connectors (Google, Microsoft, HubSpot...) |
| LLM Router | Cheap-first (DeepSeek → Kimi → MiniMax), hard budget caps |
| Subdomain | `<tenant>.global-claw.com` or reseller white-label domain |
| API Key | For advanced/developer tenants |

### Provisioning: < 10 Seconds

```
User pays Stripe → Webhook → Cloudflare Workflow:
  CreateUser → CreateTenant → AllocateSubdomain → SeedTemplates
  → CreateTenantDO → ActivateDefaultPacks → IssueApiKey
  → Telegram start link → Email notification
```

Zero human involvement. No waiting.

### Packs (v1 — Telegram-Only)

1. **Lead Capture** — qualifies inbound, routes to team member, logs to CRM
2. **Appointment Intake** — takes booking requests, sends confirmation, syncs to calendar (plugin)
3. **FAQ + Escalation** — answers common questions, escalates to human when needed
4. **Review Collector** — post-service feedback capture, routes 5-stars to Google/Trustpilot
5. **Internal Ops** — daily reminders, checklist bot, internal Q&A

Each pack has **localized copy** for every supported language.

### LLM Strategy: Cheap-First

- **Primary:** DeepSeek API (cache-hit pricing, lowest cost)
- **Secondary:** Kimi / MiniMax
- **Premium fallback:** disabled by default, opt-in per tenant plan
- Per-tenant daily token budget enforced at Durable Object level
- Circuit breaker on provider failures

---

## 3. Reseller Program

The reseller channel is the primary growth engine. Global-Claw does not acquire SMB customers directly in v1 — resellers do.

### Who Resellers Are

- Digital agencies (web, SEO, ads, "digital transformation" consultants)
- IT MSPs and technology consultants
- Industry specialists (salon software consultants, clinic IT services)
- Local "SaaS resellers" who already bundle tools for SMBs

**Reseller's value prop:** Sell a complete AI automation product without building software. Earn recurring revenue. Speak the local language. Own the customer.

---

### Reseller Tier Structure

#### Tier 1 — Affiliate (Entry)
- Revenue share: **30% recurring for 24 months**
- Access: referral link + tracking dashboard
- Requirements: none
- Payout: monthly via Stripe (or local payment method where available)
- Support: knowledge base only
- Branding: "Powered by Global-Claw" on all tenant dashboards

#### Tier 2 — Partner (Active Reseller)
- Wholesale margin: **40% off RRP**
- Access: partner portal, spawn tenants directly, custom pricing for own customers
- Requirements: minimum 5 active paying tenants
- Payout: net 30 from tenant billing
- Support: dedicated partner Telegram group (per language)
- Branding: co-branded ("Powered by [Partner] + Global-Claw") or white-label add-on
- Extras: vertical pitch pages (PDF + web), proposal generator, demo flows

#### Tier 3 — Premium Partner (White-Label)
- Wholesale margin: **50% off RRP**
- Access: full white-label (own domain, own brand, remove Global-Claw branding)
- Requirements: minimum 25 active paying tenants OR €500 MRR through channel
- One-time setup fee: €499 (white-label domain + brand config)
- Payout: net 30
- Support: direct Slack/Telegram line with Global-Claw team
- Extras: custom pack development (2/year), priority feature requests, co-marketing

#### Tier 4 — Master Partner (Sub-Reseller Network)
- Margin: **55% off RRP**
- Access: recruit sub-resellers, earn override on sub-reseller sales (10% override)
- Requirements: minimum 50 active tenants OR 5 active Tier 2+ sub-resellers
- Market exclusivity: optional exclusive territory deals (per-language or per-vertical)
- Dedicated account manager
- Custom SLA agreement

---

### Reseller Program Rules

**Anti-abuse:**
- Resellers are responsible for their tenants' compliance
- Abuse by tenant → first suspension falls on reseller account (warning)
- Repeated abuse → reseller account suspended
- Fraud / fake tenants → immediate termination, payout forfeiture

**Pricing floors:**
- Resellers cannot sell below Global-Claw RRP minus 20% (protects brand value)
- No race-to-bottom permitted

**Attribution:**
- Last-touch attribution (referral link or direct partner spawn)
- 90-day cookie window for Affiliate links
- Direct spawns are always attributed to the spawning partner

**Payout methods (by region):**
- EU: Stripe, SEPA bank transfer
- MENA: Wise, local bank (UAE/SA first)
- LATAM: Wise, local PayPal-equivalent
- South Asia: Wise, Razorpay (India)

---

### Reseller Onboarding Flow

1. Partner lands on `/partners` page in their language
2. Self-serve signup → email verified
3. Partner dashboard unlocked immediately (Affiliate tier)
4. Automated email drip (3 emails over 7 days): product overview → first sale guide → case study
5. Telegram community invite (per-language group)
6. Upgrade to Partner tier: connect 5 tenants → automatic tier upgrade

---

### Reseller Enablement Materials (per language)

- 10 vertical pitch pages (PDF + web) per language
- Proposal generator (fill-in your customer name → branded PDF)
- Demo Telegram bot flows (shareable links)
- Objection handling guide ("why not WhatsApp?", "why Telegram?")
- Case study templates (localized, vertical-specific)
- Pricing calculator (shows reseller margin at different retail prices)
- ROI calculator for end customer (hours saved, leads captured)

---

## 4. Target Markets — Phased Entry

### Phase 1 Launch Markets (Month 1)

| Market | Language | Currency | Reseller Focus |
|--------|----------|----------|----------------|
| Germany/DACH | 🇩🇪 German | EUR | Agencies, IT MSPs |
| Spain | 🇪🇸 Spanish | EUR | Digital agencies |
| Italy | 🇮🇹 Italian | EUR | Marketing agencies |
| Poland | 🇵🇱 Polish | PLN | IT MSPs, agencies |
| UAE/MENA | 🇦🇪 Arabic + English | USD/AED | Tech consultants |

### Phase 2 Expansion (Month 2–3)

| Market | Language | Currency | Reseller Focus |
|--------|----------|----------|----------------|
| Brazil | 🇧🇷 Portuguese (BR) | BRL | Digital marketing agencies |
| France | 🇫🇷 French | EUR | MSPs, consultants |
| India | 🇮🇳 English + Hindi | INR/USD | IT services, BPO-adjacent |
| Romania/Baltics | RO/EN | EUR | Tech-savvy MSPs |
| Mexico | 🇲🇽 Spanish (MX) | MXN/USD | Marketing agencies |

### Phase 3 (Month 4+)

Turkey 🇹🇷, Morocco 🇲🇦, Colombia 🇨🇴, Chile 🇨🇱, Czech Republic 🇨🇿

---

## 5. Multilingual Website Strategy

### Domain Structure

```
global-claw.com/          → IP-detect → redirect to best language
global-claw.com/en/       → English (default/fallback)
global-claw.com/de/       → German
global-claw.com/es/       → Spanish
global-claw.com/it/       → Italian
global-claw.com/pt-br/    → Brazilian Portuguese
global-claw.com/fr/       → French
global-claw.com/pl/       → Polish
global-claw.com/ar/       → Arabic (RTL)
global-claw.com/tr/       → Turkish
global-claw.com/hi/       → Hindi
```

### Pages Per Language (Core)

| Page | Purpose |
|------|---------|
| `/` | Hero + value prop + pricing + CTA |
| `/partners` | Reseller program overview + signup |
| `/partners/tiers` | Detailed tier comparison |
| `/pricing` | Localized pricing + currency |
| `/packs` | Pack descriptions + use cases |
| `/plugins` | Integration marketplace |
| `/blog` | SEO content (vertical + use case articles) |
| `/legal/privacy` | GDPR-compliant privacy policy |
| `/legal/terms` | Terms of service |

### Programmatic SEO (Vertical Landing Pages)

For each language, generate vertical-specific pages:

```
/de/telegram-bot-friseursalon       → "Telegram Bot für Friseursalons"
/de/telegram-bot-arztpraxis         → "Telegram Bot für Arztpraxen"
/de/telegram-bot-immobilien         → "Telegram Bot für Immobilienmakler"
/es/bot-telegram-clinica            → "Bot de Telegram para Clínicas"
/es/bot-telegram-inmobiliaria       → "Bot de Telegram para Inmobiliarias"
/pt-br/bot-telegram-clinica         → "Bot do Telegram para Clínicas"
/ar/telegram-bot-عقارات             → Arabic real estate
```

Each page: localized headline, pack description, ROI calculator, customer proof, CTA.

### Translation Quality Rules

- Phase 1 languages: human-reviewed + back-translation check
- Legal pages: professional legal translation only
- In-app UX (bot messages): native speaker review mandatory
- Phase 2+ languages: AI-translated with native speaker spot-check
- Pricing + currency: localized by IP geolocation + manual override

### Localization Beyond Text

- Pricing in local currency (EUR, PLN, AED, BRL, INR, etc.)
- Date/time formats per locale
- Payment methods per region (SEPA, Pix, UPI, etc.)
- VAT/tax display by country
- Arabic: full RTL support
- Customer support language routing

---

## 6. Pricing

### End-Customer Pricing (EUR base, PPP-adjusted per region)

| Plan | EUR | USE CASE |
|------|-----|----------|
| **Starter** | €29/mo | 1 bot, 2 packs, 1,000 messages/mo, basic limits |
| **Pro** | €79/mo | All packs, 5,000 messages/mo, 1-click integrations |
| **Business** | €149/mo | Multi-operator, 20,000 messages/mo, analytics, white-label bot name |
| **Usage add-on** | €0.01/1K messages above limit | Overage billing |

**PPP adjustments (approximate):**
- Poland: -25% (PLN equivalent)
- India: -50% (INR equivalent)
- Brazil: -30% (BRL equivalent)
- MENA: ±0% (USD pricing, high spend tolerance)

### Reseller Effective Pricing (Tier 2 Partner, 40% margin)

| Plan | RRP | Wholesale | Reseller earns |
|------|-----|-----------|----------------|
| Starter | €29 | €17.40 | €11.60/mo |
| Pro | €79 | €47.40 | €31.60/mo |
| Business | €149 | €89.40 | €59.60/mo |

A reseller with 20 Pro customers = **€632/mo recurring**. 50 customers = **€1,580/mo**.

---

## 7. Go-To-Market

### Phase 1: Build the Reseller Engine (Month 1)

**Week 1–2:**
- Launch partner portal in 5 languages
- Automated reseller drip email sequence
- Telegram partner communities per language
- SEO-optimized partner landing pages live

**Week 3–4:**
- Outreach to 50 agencies per target market (LinkedIn + email in local language)
- Post in local agency/MSP communities (Facebook groups, Reddit equivalents, local forums)
- YouTube/TikTok shorts — "How to resell Telegram automation" (per language)

**Goal:** 20 reseller signups, 50 trials started

### Phase 2: Reseller Activation (Month 2)

- Identify first 5 "champion resellers" per market (those who convert)
- Interview them: what's the pitch, what objections, what vertical
- Build case studies from their customers
- Amplify their content (co-marketing)

**Goal:** 100 resellers signed, 100 paying tenants

### Phase 3: CAC → Zero (Month 3+)

- Programmatic SEO generates organic partner inbound
- Reseller referrals generate new reseller signups
- "Powered by Global-Claw" badge in free/Starter tenants drives brand awareness
- Template marketplace: public pack links = viral loops

---

## 8. Operations Model

### Support Philosophy

- **Global-Claw supports resellers. Resellers support end customers.**
- No direct SMB support tickets in v1
- Tier 3+ partners: direct Slack/Telegram line
- All other support: knowledge base per language + community

### Cost Controls

- Cheap-LLM first with hard budget caps per tenant → no runaway costs
- Telegram zero-cost messaging → no per-message variable cost
- Abuse controls: per-tenant rate limits, bot-farm detection, auto-suspend

### Key SaaS Metrics to Track

| Metric | Target (Month 3) |
|--------|-----------------|
| Reseller signups | 300+ |
| Active resellers (≥1 tenant) | 100+ |
| Productive resellers (≥3 tenants) | 30+ |
| Paying tenants | 300+ |
| Blended ARPU | €49–€89 |
| Monthly churn | <5% |
| Activation rate (pack enabled) | >40% |
| LLM cost per tenant/mo | <€3 |

---

## 9. Financial Model

### Revenue Build (Conservative)

| Month | Tenants | ARPU | MRR | Reseller Payout | Net MRR |
|-------|---------|------|-----|----------------|---------|
| 1 | 50 | €55 | €2,750 | €1,100 (40%) | €1,650 |
| 2 | 150 | €60 | €9,000 | €3,600 | €5,400 |
| 3 | 300 | €65 | €19,500 | €7,800 | €11,700 |
| 6 | 800 | €70 | €56,000 | €22,400 | €33,600 |
| 12 | 2,000 | €75 | €150,000 | €60,000 | €90,000 |

**Break-even at ~200–300 tenants** (assuming fixed infrastructure costs under €2,000/mo on Cloudflare).

### Cost Structure (Monthly at Scale)

| Item | Cost |
|------|------|
| Cloudflare (Workers/D1/R2/DO) | ~€500–€2,000 |
| LLM APIs (DeepSeek-first) | ~€3–€5/tenant/mo × tenants |
| Stripe fees | ~2.9% + fixed |
| Reseller payouts | 30–50% of gross |
| Marketing (content/ads) | €1,000–€3,000 |

**Gross margin target:** 60–70% after LLM + reseller payouts.

---

## 10. Compliance + Legal

### EU/GDPR (Primary Concern)

- Data residency: Cloudflare allows regional routing — EU tenants stay on EU PoPs
- Data processing agreement (DPA) available for resellers who need it
- User data export + deletion API: Day 1 requirement
- Cookie consent: per-language, geo-aware

### Tax Strategy

- Phase 1: Stripe Tax for EU VAT handling
- B2B-first: collect VAT IDs, apply reverse charge where applicable
- Phase 2 (if B2C volume grows): evaluate Merchant of Record (Paddle or Lemon Squeezy) to offload tax complexity in non-EU markets
- No US tax complexity (explicit non-US focus)

### Reseller Agreement (Required)

Each reseller signs a Partner Agreement covering:
- Prohibited verticals (spam, adult, financial advice, medical diagnosis)
- Acceptable use policy they must enforce on their tenants
- Payout terms and dispute resolution
- Termination conditions (fraud, abuse, minimum standards)
- Data processing responsibilities (reseller is sub-processor for their tenants)

---

## 11. Risks and Mitigations

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|-----------|
| Low Telegram adoption in target market | Medium | High | Launch only in verified high-adoption markets; WhatsApp as Phase 2 add-on |
| Resellers sell to wrong verticals (spam) | Medium | High | Partner agreement, auto-abuse detection, kill switch |
| Localization quality issues damage brand | High | Medium | Human QA for Phase 1 languages; lock legal pages |
| LLM provider pricing changes | Low | Medium | Multi-provider router; budget caps protect downside |
| Stripe not available in some markets | Medium | Medium | Evaluate Paddle/Wise for MENA and South Asia |
| Competitor launches Telegram-first product | Low | High | Speed advantage + reseller lock-in + language moat |

---

## 12. What Gets Built (Priority Order)

1. **Multilingual marketing site** — 5 languages, partner landing page, pricing
2. **Partner (reseller) portal** — signup, tiers, referral links, spawn tenants, payout tracking
3. **Core product** — provisioning workflow, Telegram bot, Durable Object agent, LLM router
4. **Pack library** — 5 packs with localized copy for Phase 1 languages
5. **Plugin framework** — manifest system, OAuth handlers
6. **Programmatic SEO templates** — vertical pages per language
7. **Analytics + reseller dashboard** — activation, retention, reseller productivity

---

## One-Line North Star

**"Any business anywhere that uses Telegram pays once, is live in 10 seconds, and gets an AI agent that works in their language — powered by their local partner."**
