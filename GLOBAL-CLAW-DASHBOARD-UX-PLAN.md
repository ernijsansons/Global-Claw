# GLOBAL-CLAW DASHBOARD — UI/UX MASTER DESIGN PLAN

## Design Philosophy: "Neural Cartography"

We map the invisible topology of autonomous intelligence. Every surface is a living instrument panel — clean enough for a first-time operator, deep enough for a systems architect. The dashboard does not explain agents; it reveals them the way satellite imagery reveals terrain: at a glance you see the whole, on zoom you see every pore.

The aesthetic borrows from mission-control sobriety (dark carbon surfaces, surgical accent lighting) fused with the organic confidence of a premium automotive HUD. Data is not decorated — it is shaped into spatial meaning through density, luminance, and motion. Color is reserved, almost clinical, until something demands attention; then it burns with purpose. Every pixel placement is the product of deep expertise, painstaking attention to hierarchy, and master-level execution.

Whitespace is structural, not empty. Rounded containers float on near-black fields the way instruments float on a cockpit panel. Micro-animations are physics-based (spring, damped oscillation) — never decorative, always informational. The interface breathes: skeleton pulses on load, cards ease into position, status rings animate in real-time. Typography is thin, modern, and restrained — GeistMono for data, InstrumentSans for UI chrome, YoungSerif for rare editorial moments. The overall impression must be: "this was built by the best team in the world, and they sweated every detail."

---

## 1. DESIGN SYSTEM FOUNDATIONS

### Color Palette

| Token | Hex | Usage |
|---|---|---|
| `--bg-root` | `#0A0A0F` | App background (near-black with blue undertone) |
| `--bg-surface` | `#12121A` | Card/panel surfaces |
| `--bg-elevated` | `#1A1A26` | Modals, dropdowns, hover states |
| `--border-subtle` | `#1F1F2E` | Dividers, card borders |
| `--border-focus` | `#3B82F6` | Focus rings, active states |
| `--text-primary` | `#F0F0F5` | Headings, primary content |
| `--text-secondary` | `#8B8BA3` | Labels, metadata |
| `--text-muted` | `#4A4A6A` | Placeholders, disabled |
| `--accent-blue` | `#3B82F6` | Primary actions, links |
| `--accent-emerald` | `#10B981` | Success, healthy, online |
| `--accent-amber` | `#F59E0B` | Warnings, attention |
| `--accent-rose` | `#EF4444` | Errors, critical alerts |
| `--accent-violet` | `#8B5CF6` | AI/agent-specific elements |
| `--accent-cyan` | `#06B6D4` | Workflows, automation |

### Typography Scale

- **Display**: InstrumentSans Bold 32px / 40px line-height
- **H1**: InstrumentSans Bold 24px / 32px
- **H2**: InstrumentSans Medium 20px / 28px
- **Body**: InstrumentSans Regular 14px / 22px
- **Caption**: InstrumentSans Regular 12px / 18px
- **Mono/Data**: GeistMono Regular 13px / 20px
- **Editorial accent**: YoungSerif Regular (sparingly, for empty states or onboarding)

### Spacing & Grid

- Base unit: 4px
- Content max-width: 1440px
- Sidebar: 240px collapsed to 64px
- Grid: 12-column with 24px gutters
- Card padding: 20px (compact) / 24px (standard)
- Card border-radius: 12px
- Section gap: 32px

### Motion

- Micro: 150ms ease-out (hover, focus)
- Standard: 250ms spring(1, 80, 12) (card entry, panel open)
- Emphasis: 400ms spring(1, 60, 8) (page transitions, modal)
- Skeleton pulse: 1.5s ease-in-out infinite

---

## 2. INFORMATION ARCHITECTURE

### Primary Navigation (Left Sidebar)

```
┌─────────────────────────┐
│  🔵 GLOBAL CLAW          │
│                           │
│  ◉ Overview               │ ← Mission control
│  ◎ Agents                 │ ← Agent fleet management
│  ◎ Workflows              │ ← Lobster visual editor
│  ◎ Memory                 │ ← Knowledge & context
│  ◎ Integrations           │ ← 1-click plugin marketplace
│  ◎ LLM Providers          │ ← Provider-agnostic router
│  ◎ Conversations          │ ← Telegram + channel logs
│  ◎ Analytics              │ ← Usage, costs, performance
│  ───────────────────────  │
│  ◎ Tenants                │ ← Multi-tenant admin (admin only)
│  ◎ Billing                │ ← Subscription & usage
│  ◎ Settings               │ ← Team, API keys, branding
│                           │
│  ┌─ Tenant Switcher ────┐ │
│  │ 🏢 Acme Corp    ▼    │ │
│  └──────────────────────┘ │
└─────────────────────────┘
```

### Progressive Disclosure Strategy

**Level 0 — Glance** (sidebar + top-level cards): Status at a glance. Green/amber/red health rings. Key metrics as large numbers.

**Level 1 — Scan** (expanded cards, list views): Agent list with inline status, workflow run history, memory search results. Enough to act on most tasks.

**Level 2 — Deep Dive** (slide-over panels, detail views): Full agent config, workflow node editor, memory document viewer, conversation replay.

**Level 3 — Expert** (modals, raw views): JSON schema editor, SQL query console, raw log viewer, advanced LLM routing rules.

---

## 3. KEY SCREENS

### 3.1 OVERVIEW — Mission Control

The hero screen. A single-pane-of-glass for the entire Global-Claw deployment.

```
┌─────────────────────────────────────────────────────────┐
│  Good morning, Ernie                     🔔  👤  🌐 LV │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌─────────┐│
│  │ 12       │  │ 847      │  │ 99.7%    │  │ $23.40  ││
│  │ Active   │  │ Messages │  │ Uptime   │  │ LLM     ││
│  │ Agents   │  │ Today    │  │ 30d      │  │ Cost/24h││
│  │ ●●●●○○   │  │ ▁▃▅▇█▇  │  │ ━━━━━━━○ │  │ ↓12%    ││
│  └──────────┘  └──────────┘  └──────────┘  └─────────┘│
│                                                         │
│  ┌─ Agent Fleet Health ─────────────────────────────┐  │
│  │  [Live grid of agent status dots — color-coded]  │  │
│  │  Hover reveals: name, status, last message,      │  │
│  │  messages/hr, current LLM, memory size           │  │
│  └──────────────────────────────────────────────────┘  │
│                                                         │
│  ┌─ Active Workflows ────┐  ┌─ Recent Activity ──────┐ │
│  │ ▶ Onboarding Flow  ●  │  │ • Agent "Sales-LV"     │ │
│  │ ▶ Support Triage   ●  │  │   handled 23 tickets   │ │
│  │ ⏸ Data Sync       ○  │  │ • Workflow "Onboard"   │ │
│  │ ▶ Lead Qualify     ●  │  │   completed run #847   │ │
│  └───────────────────────┘  └────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

**Key design decisions:**
- Large metric cards with sparkline micro-charts (not just numbers)
- Agent fleet as a "heatmap grid" — each dot is an agent, color = health
- Real-time activity feed with relative timestamps
- Greeting is personalized + locale-aware (Latvian/Russian/English)

### 3.2 AGENTS — Fleet Management

```
┌─ Agents ──────────────────────── [+ New Agent] [⚙] ──┐
│                                                         │
│  🔍 Search agents...    [All ▼] [Online ▼] [Sort ▼]   │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │ ●  Sales Assistant LV          online    ▸      │   │
│  │    claude-sonnet-4  ·  247 msgs today  ·  LV/RU │   │
│  ├─────────────────────────────────────────────────┤   │
│  │ ●  Support Bot EN              online    ▸      │   │
│  │    qwen-2.5-72b  ·  89 msgs today  ·  EN       │   │
│  ├─────────────────────────────────────────────────┤   │
│  │ ○  Data Analyst                sleeping  ▸      │   │
│  │    gpt-4o  ·  0 msgs today  ·  EN/DE           │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  ┌─ Agent Detail (slide-over panel) ──────────────┐    │
│  │                                                 │    │
│  │  Sales Assistant LV            [Edit] [⋮]      │    │
│  │  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━   │    │
│  │                                                 │    │
│  │  ┌─ Identity ───────────────────────────┐      │    │
│  │  │ SOUL.md    [Edit in Monaco editor]   │      │    │
│  │  │ AGENTS.md  [Edit in Monaco editor]   │      │    │
│  │  │ Avatar     [Upload / Generate]       │      │    │
│  │  └─────────────────────────────────────┘      │    │
│  │                                                 │    │
│  │  ┌─ Model Config ──────────────────────┐      │    │
│  │  │ Primary:   [claude-sonnet-4    ▼]   │      │    │
│  │  │ Fallback:  [qwen-2.5-72b      ▼]   │      │    │
│  │  │ Temp:      [0.7 ━━━━●━━━━━━━━━]    │      │    │
│  │  │ Max tokens:[4096 ━━━━━━━●━━━━━]    │      │    │
│  │  └─────────────────────────────────────┘      │    │
│  │                                                 │    │
│  │  ┌─ Tools & Integrations ──────────────┐      │    │
│  │  │ ☑ Google Calendar  ☑ Notion         │      │    │
│  │  │ ☑ Stripe          ☐ GitHub          │      │    │
│  │  │        [+ Add Integration]           │      │    │
│  │  └─────────────────────────────────────┘      │    │
│  │                                                 │    │
│  │  ┌─ Memory ────────────────────────────┐      │    │
│  │  │ Conversations: 1,247 stored          │      │    │
│  │  │ Long-term facts: 89 entries          │      │    │
│  │  │ Vector embeddings: 3,402             │      │    │
│  │  │         [View Memory →]              │      │    │
│  │  └─────────────────────────────────────┘      │    │
│  └─────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────┘
```

**Key design decisions:**
- List view with inline status indicators (dot color + label)
- Each agent shows: current LLM, message volume, supported languages
- Detail panel slides in from right (50% width) — no page navigation
- SOUL.md / AGENTS.md editable with syntax-highlighted Monaco editor
- Model selector shows all providers from D1 `llm_providers` table
- Integration toggles are visual — checkboxes with service icons
- Memory section shows volume stats + link to deep dive

### 3.3 WORKFLOWS — Visual Lobster Editor

```
┌─ Workflows ─────────────────── [+ New Workflow] [⚙] ──┐
│                                                         │
│  ┌─ Workflow List ──┐  ┌─ Canvas ─────────────────────┐│
│  │ ▶ Onboarding    │  │                               ││
│  │ ▶ Support Triage│  │   ┌─────┐    ┌─────┐         ││
│  │ ⏸ Data Sync    │  │   │Start│───▸│Route│         ││
│  │ ▶ Lead Qualify  │  │   └─────┘    └──┬──┘         ││
│  │                  │  │           ┌─────┼─────┐      ││
│  │ [+ New]          │  │           ▼     ▼     ▼      ││
│  │                  │  │        ┌────┐┌────┐┌────┐    ││
│  │                  │  │        │ LV ││ EN ││ RU │    ││
│  │                  │  │        └──┬─┘└──┬─┘└──┬─┘    ││
│  │                  │  │           └─────┼─────┘      ││
│  │                  │  │                 ▼             ││
│  │                  │  │           ┌──────────┐        ││
│  │                  │  │           │ Respond  │        ││
│  │                  │  │           └──────────┘        ││
│  └──────────────────┘  └─────────────────────────────┘│
│                                                         │
│  ┌─ Node Inspector (bottom panel) ────────────────────┐│
│  │  Route Node          Type: Conditional              ││
│  │  Condition: message.language                        ││
│  │  Branches: LV → latvian_handler | EN → english_... ││
│  └────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────┘
```

**Key design decisions:**
- Split-pane: workflow list (left, 220px) + visual canvas (center) + node inspector (bottom, collapsible)
- Canvas powered by React Flow — nodes are rounded cards with status indicators
- Drag-and-drop node creation from a palette
- Real-time run visualization: active nodes pulse with accent-cyan glow
- Node types: Trigger, Condition, Action, LLM Call, Human-in-the-Loop, Wait, Sub-workflow
- Each node shows: type icon, name, last run status, avg duration
- Minimap in corner for large workflows

### 3.4 MEMORY — Three-Tier Knowledge System

```
┌─ Memory ───────────────────────────────────────────────┐
│                                                         │
│  ┌─ Conversation Memory ─┐ ┌─ Long-Term Facts ─┐ ┌─ Vector ─┐
│  │ 12,847 messages        │ │ 342 facts          │ │ 8,901    │
│  │ across 1,247 sessions  │ │ across 12 agents   │ │ chunks   │
│  └────────────────────────┘ └────────────────────┘ └──────────┘
│                                                         │
│  🔍 Search across all memory...                        │
│                                                         │
│  ┌─ Memory Explorer ──────────────────────────────────┐│
│  │                                                     ││
│  │  TIMELINE VIEW  │  GRAPH VIEW  │  TABLE VIEW       ││
│  │  ━━━━━━━━━━━━━━                                    ││
│  │                                                     ││
│  │  ● Mar 4 — Customer "TechCo" asked about pricing   ││
│  │    Agent: Sales-LV | Confidence: 0.94              ││
│  │    [View context] [Edit] [Delete]                   ││
│  │                                                     ││
│  │  ● Mar 3 — Learned: TechCo budget is €50K/yr       ││
│  │    Agent: Sales-LV | Source: conversation #892      ││
│  │    [View context] [Edit] [Delete]                   ││
│  │                                                     ││
│  │  ● Mar 3 — FAQ: "How to reset password" → ...      ││
│  │    Agent: Support-EN | Used 47 times                ││
│  │    [View context] [Edit] [Delete]                   ││
│  └────────────────────────────────────────────────────┘│
│                                                         │
│  ┌─ Memory Graph (Graph View) ────────────────────────┐│
│  │                                                     ││
│  │     [Interactive force-directed graph showing       ││
│  │      entities, relationships, and knowledge         ││
│  │      clusters. Nodes = entities/facts.              ││
│  │      Edges = relationships. Size = usage freq.      ││
│  │      Color = recency. Click to inspect.]            ││
│  │                                                     ││
│  └────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────┘
```

**Key design decisions:**
- Three-tier summary cards at top (conversation, long-term, vector)
- Universal search across all memory types
- Three view modes: Timeline (chronological), Graph (knowledge map), Table (spreadsheet)
- Graph view uses D3 force-directed layout — entity-relationship visualization
- Each memory entry shows: agent source, confidence score, usage count
- Inline edit/delete with confirmation
- Bulk operations: export, clear by date range, merge duplicates

### 3.5 LLM PROVIDERS — Provider-Agnostic Router

```
┌─ LLM Providers ─────────────── [+ Add Provider] ──────┐
│                                                         │
│  ┌─ Active Providers ─────────────────────────────────┐│
│  │                                                     ││
│  │  ┌────────────────────────────────────────────┐    ││
│  │  │ ● Anthropic Claude                          │    ││
│  │  │   Models: sonnet-4, haiku-4.5              │    ││
│  │  │   Cost: $3/$15 per 1M tokens               │    ││
│  │  │   Usage: 67% of traffic   ▓▓▓▓▓▓▓░░░      │    ││
│  │  │   Latency: 1.2s avg   Health: ● 99.9%     │    ││
│  │  │                  [Configure] [Disable]      │    ││
│  │  └────────────────────────────────────────────┘    ││
│  │                                                     ││
│  │  ┌────────────────────────────────────────────┐    ││
│  │  │ ● Alibaba Qwen                              │    ││
│  │  │   Models: qwen-2.5-72b, qwen-2.5-7b       │    ││
│  │  │   Cost: $0.27/$1.10 per 1M tokens          │    ││
│  │  │   Usage: 28% of traffic   ▓▓▓░░░░░░░      │    ││
│  │  │   Latency: 0.8s avg   Health: ● 99.2%     │    ││
│  │  │                  [Configure] [Disable]      │    ││
│  │  └────────────────────────────────────────────┘    ││
│  │                                                     ││
│  │  ┌────────────────────────────────────────────┐    ││
│  │  │ ○ OpenAI (disabled)                         │    ││
│  │  │   Models: gpt-4o, gpt-4o-mini              │    ││
│  │  │                     [Enable] [Remove]       │    ││
│  │  └────────────────────────────────────────────┘    ││
│  └────────────────────────────────────────────────────┘│
│                                                         │
│  ┌─ Routing Rules ────────────────────────────────────┐│
│  │  Default: Cost-optimized                            ││
│  │  ┌──────────────────────────────────────────┐      ││
│  │  │ IF task = "complex reasoning"            │      ││
│  │  │    → claude-sonnet-4 (weight: 80%)       │      ││
│  │  │    → qwen-2.5-72b (weight: 20%)          │      ││
│  │  │ IF task = "simple chat"                  │      ││
│  │  │    → qwen-2.5-7b (weight: 90%)           │      ││
│  │  │    → haiku-4.5 (weight: 10%)              │      ││
│  │  └──────────────────────────────────────────┘      ││
│  │                    [+ Add Rule] [Edit Rules]        ││
│  └────────────────────────────────────────────────────┘│
│                                                         │
│  ┌─ Cost Dashboard ───────────────────────────────────┐│
│  │  $23.40 today   $487.20 this month   Budget: $600  ││
│  │  ▁▂▃▅▇█▇▅▃▂▁▂▃▅▇ (30-day cost trend)              ││
│  └────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────┘
```

### 3.6 INTEGRATIONS — 1-Click Plugin Marketplace

```
┌─ Integrations ──────────────────────────────────────────┐
│                                                          │
│  🔍 Search integrations...  [All ▼] [Connected ▼]      │
│                                                          │
│  ┌─ Connected (4) ───────────────────────────────────┐  │
│  │  [Icon] Google Calendar  ● Connected  [Manage]    │  │
│  │  [Icon] Notion           ● Connected  [Manage]    │  │
│  │  [Icon] Stripe           ● Connected  [Manage]    │  │
│  │  [Icon] Telegram         ● Connected  [Manage]    │  │
│  └───────────────────────────────────────────────────┘  │
│                                                          │
│  ┌─ Available ───────────────────────────────────────┐  │
│  │                                                    │  │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐│  │
│  │  │ [Icon]  │ │ [Icon]  │ │ [Icon]  │ │ [Icon]  ││  │
│  │  │ GitHub  │ │ Slack   │ │ HubSpot │ │ Jira    ││  │
│  │  │         │ │         │ │         │ │         ││  │
│  │  │[Connect]│ │[Connect]│ │[Connect]│ │[Connect]││  │
│  │  └─────────┘ └─────────┘ └─────────┘ └─────────┘│  │
│  │                                                    │  │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐│  │
│  │  │ Shopify │ │ Zapier  │ │ Discord │ │ Linear  ││  │
│  │  │[Connect]│ │[Connect]│ │[Connect]│ │[Connect]││  │
│  │  └─────────┘ └─────────┘ └─────────┘ └─────────┘│  │
│  └───────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────┘
```

**Key design decisions:**
- 1-click OAuth connect buttons — no API key entry for non-technical users
- Connected integrations at top with status + manage link
- Available integrations as icon cards in a responsive grid
- Each card shows: icon, name, brief description, connect button
- Post-connect: permission scopes shown clearly before authorizing
- MCP remote tool integration happens transparently behind OAuth flow

### 3.7 CONVERSATIONS — Telegram & Channel Logs

```
┌─ Conversations ────────────────────────────────────────┐
│                                                         │
│  🔍 Search conversations...  [Agent ▼] [7d ▼] [Sort ▼]│
│                                                         │
│  ┌─ Conversation List ─┐  ┌─ Message Thread ─────────┐│
│  │                      │  │                           ││
│  │  ┌────────────────┐  │  │  Sales-LV | @customer_id ││
│  │  │ 👤 Sarah M.    │  │  │  ━━━━━━━━━━━━━━━━━━━━━━ ││
│  │  │ "Quick demo... │  │  │                           ││
│  │  │ Agent: Sales   │  │  │  Customer    Mar 5 10:23  ││
│  │  │ 2 hours ago    │  │  │  Hi, can you explain the ││
│  │  │ ● Open         │  │  │  pricing model?          ││
│  │  └────────────────┘  │  │                           ││
│  │                      │  │  Agent (claude-sonnet)    ││
│  │  ┌────────────────┐  │  │  Mar 5 10:24             ││
│  │  │ 👤 John D.     │  │  │  Of course! We offer...  ││
│  │  │ "Thanks for    │  │  │  [Response quality: 0.92]││
│  │  │ Agent: Support │  │  │  [Latency: 1.2s]         ││
│  │  │ 1 hour ago     │  │  │  [Tokens: 342]           ││
│  │  │ ● Closed       │  │  │                           ││
│  │  └────────────────┘  │  │  Customer    Mar 5 10:25  ││
│  │                      │  │  Got it. Can I get a     ││
│  │  ┌────────────────┐  │  │  trial account?          ││
│  │  │ 👤 Emma L.     │  │  │                           ││
│  │  │ "Does it work  │  │  │  Agent (claude-sonnet)    ││
│  │  │ Agent: Support │  │  │  Mar 5 10:26             ││
│  │  │ 45 mins ago    │  │  │  Absolutely! Let me set  ││
│  │  │ ○ Escalated    │  │  │  that up...              ││
│  │  └────────────────┘  │  │  [Response quality: 0.88]││
│  │                      │  │  [Latency: 0.9s]         ││
│  │  [Show older...]     │  │  [Tokens: 287]           ││
│  └──────────────────────┘  │                           ││
│                             │  [Export CSV] [Escalate] ││
│                             │  [Flag] [Delete]         ││
│                             └─────────────────────────┘│
│                                                         │
│  Filters: [All Languages] [Active] [7 Days] [Agent: All]
└─────────────────────────────────────────────────────────┘
```

**Key design decisions:**
- Split-pane layout: conversation list (left, 35%) + message thread (right, 65%)
- Each conversation shows: user avatar, message preview, agent name, timestamp, status badge
- Status badges: "Open" (green accent-emerald), "Closed" (gray), "Escalated" (yellow accent-amber)
- Message thread alternates user (left) and agent (right) with aligned bubbles
- Each agent message includes metadata: model used, response latency, tokens consumed
- Response quality score (0-1) indicates LLM confidence and satisfaction
- Quick action buttons at bottom: Export, Escalate to Human, Flag, Delete
- Filters above list: agent, date range, language, status (using dropdown selectors)
- Search is full-text (searches message content + user names)

### 3.8 ANALYTICS — Usage & Performance Dashboard

```
┌─ Analytics ────────────────────────────────────────────┐
│                                                         │
│  Date range: [Mar 1 — Mar 5] [Last 7 days ▼]  [Export] │
│                                                         │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌─────────┐│
│  │ 1.2s     │  │ 87.4%    │  │ 4.2/5.0  │  │ $127.84 ││
│  │ Avg      │  │ Issue    │  │ Customer │  │ 7-Day   ││
│  │ Response │  │ Resolution│  │Satisfaction│ │ Cost    ││
│  │ Time     │  │ Rate     │  │          │  │         ││
│  └──────────┘  └──────────┘  └──────────┘  └─────────┘│
│                                                         │
│  ┌─ Messages Over Time ──────────────────────────────┐ │
│  │                                                    │ │
│  │   Messages/Day                                    │ │
│  │   1200│                  ▁ ┌──┐                  │ │
│  │       │    ┌──┐    ┌──┐ ┌─┘ └──┘    ┌──┐        │ │
│  │   800 │   ┌┘  └────┘  └─┘         ┌─┘  └──      │ │
│  │       │  ┌┘                       ┘              │ │
│  │   400 │┌─┘                                       │ │
│  │       │                                          │ │
│  │     0 └──────────────────────────────────────────│ │
│  │      Mar 1  Mar 2  Mar 3  Mar 4  Mar 5           │ │
│  └────────────────────────────────────────────────┘ │
│                                                      │
│  ┌─ Agent Performance ───────────────────────────────┐│
│  │                                                    ││
│  │  Agent            │ Messages │ Avg Resp │ Escape ││
│  │  ━━━━━━━━━━━━━━━━┼──────────┼──────────┼────── ││
│  │  Sales-LV         │    847   │   1.1s   │  2.3% ││
│  │  Support-EN       │    623   │   1.4s   │  5.1% ││
│  │  Support-RU       │    234   │   1.2s   │  3.8% ││
│  │  Lead-Qualify     │    189   │   0.8s   │  1.2% ││
│  │  Data-Collector   │     45   │   2.3s   │  0.0% ││
│  └────────────────────────────────────────────────┘│
│                                                      │
│  ┌─ LLM Cost Breakdown ──────┐  ┌─ Language Dist ───┐│
│  │                            │  │                   ││
│  │  Claude: 65%  $82.91       │  │  LV: 42% ▓▓▓▓▓░  ││
│  │  [████████░░░░░░░░░░░░]    │  │  EN: 35% ▓▓▓▓░░  ││
│  │                            │  │  RU: 23% ▓▓░░░░  ││
│  │  Qwen:   28%  $35.83       │  │                   ││
│  │  [███░░░░░░░░░░░░░░░░░░░]  │  │                   ││
│  │                            │  │                   ││
│  │  Other:  7%   $9.10        │  │                   ││
│  │  [░░░░░░░░░░░░░░░░░░░░░░░] │  │                   ││
│  └──────────────────────────┘  └───────────────────┘│
│                                                      │
│  ┌─ Peak Hours Heatmap ─────────────────────────────┐│
│  │   Intensity (messages/hour)                       ││
│  │                                                    ││
│  │   24│  ░░░░░░░░░░░░░░░░░░░░░░                    ││
│  │   20│  ░░▓▓▓▓░░░░░░░░░░░░░░░░░                   ││
│  │   16│  ░▓▓▓▓▓▓░░░░░░░░░░▓▓▓▓░                    ││
│  │   12│  ▓▓▓▓▓▓▓▓░░░░░░░░▓▓▓▓▓▓░                   ││
│  │    8│  ▓▓▓▓▓▓▓▓▓░░░░░░▓▓▓▓▓▓▓░                   ││
│  │    4│  ▓▓▓▓▓▓▓▓▓░░░░░▓▓▓▓▓▓▓▓░                   ││
│  │    0│  ─────────────────────────                 ││
│  │      Mon Tue Wed Thu Fri Sat Sun                 ││
│  └────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────┘
```

**Key design decisions:**
- KPI cards at top with sparklines (metric + micro-chart + percent change)
- Main time-series chart shows message volume over selected period (7d/30d/custom)
- Agent performance table sortable by any column; escalation rate key metric
- Cost breakdown pie chart shows provider distribution with dollar amounts
- Language distribution bar chart shows message volume by language
- Peak hours heatmap (7 days × 24 hours grid) identifies busiest times
- Color intensity in heatmap: darker = more traffic
- All filters sticky at top (date range, export button)
- Inline sparklines in each metric card show trend direction

### 3.9 BILLING — Subscription & Usage

```
┌─ Billing ─────────────────────────────────────────────┐
│                                                         │
│  ┌─ Current Plan ──────────────────────────────────┐  │
│  │                                                  │  │
│  │  Pro Plan              Renews Mar 25, 2026      │  │
│  │  $79 / month                                    │  │
│  │                                                  │  │
│  │  ┌──────────────────────────────────────────┐   │  │
│  │  │ Tokens Budget                             │   │  │
│  │  │ 10M used / 50M limit        [████████░░] │   │  │
│  │  │ $45.20 of $120 remaining                 │   │  │
│  │  │                                            │   │  │
│  │  │ Messages Budget                           │   │  │
│  │  │ 8,924 used / 10,000 limit    [████████░░] │   │  │
│  │  │ ~76 messages remaining today              │   │  │
│  │  │                                            │   │  │
│  │  │ Active Agents                             │   │  │
│  │  │ 3 of 5 agents deployed       [███░░░░░░░] │   │  │
│  │  └──────────────────────────────────────────┘   │  │
│  │                                                  │  │
│  │  [Upgrade Plan] [Manage Payment Method]         │  │
│  └──────────────────────────────────────────────┘  │
│                                                      │
│  ┌─ Plan Comparison ────────────────────────────────┐ │
│  │                                                  │ │
│  │  [Starter] [Pro] [Business] [Enterprise]        │ │
│  │            ■■■■■                               │ │
│  │                                                  │ │
│  │  Monthly Price: $29 | $79 | $149 | Custom      │ │
│  │  Token Budget: 5M | 50M | 500M | Unlimited     │ │
│  │  Message Limit: 2,500 | 10,000 | 100,000 | U.  │ │
│  │  Agents: 1 | 5 | 25 | Unlimited                │ │
│  │  Priority Support: ○ | ● | ● | ●               │ │
│  │  Custom LLM Routes: ○ | ● | ● | ●              │ │
│  │                                                  │ │
│  │          [View Details] [Upgrade to Business]   │ │
│  └──────────────────────────────────────────────┘ │
│                                                      │
│  ┌─ Invoice History ─────────────────────────────┐  │
│  │                                                │  │
│  │  Date       │ Amount │ Status   │ Actions      │  │
│  │  ━━━━━━━━━━┼────────┼──────────┼──────────    │  │
│  │  Feb 25     │ $79.00 │ Paid     │ [View] [⋮]  │  │
│  │  Jan 25     │ $79.00 │ Paid     │ [View] [⋮]  │  │
│  │  Dec 25     │ $79.00 │ Paid     │ [View] [⋮]  │  │
│  │  Nov 25     │ $49.00 │ Paid     │ [View] [⋮]  │  │
│  │  [Show older...]                               │  │
│  └────────────────────────────────────────────┘  │
│                                                      │
│  ┌─ Referral Program ─────────────────────────────┐ │
│  │                                                │ │
│  │  Your referral code: ERNIE-2026               │ │
│  │  Share to earn 20% recurring commission        │ │
│  │  Current referrals: 3 (pending 1)             │ │
│  │                                                │ │
│  │  Earnings: $47.40 this month                  │ │
│  │  [Copy Code] [View Referral Dashboard]        │ │
│  └────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────┘
```

**Key design decisions:**
- Current plan card at top with renewal date and key features
- Usage meters show: consumed / limit + visual progress bar + remaining $$ or items
- Plan comparison modal (accessible via [Upgrade Plan] button) shows 4-column grid
- Checkmarks/dots indicate feature availability across plans
- Invoice history table is sortable, downloadable as PDF per row
- [Manage Payment Method] link opens Stripe customer portal
- Referral code visibly displayed for partner program participants
- Color coding: green for healthy usage, amber for approaching limits, red for exceeded
- Renewal date prominently shown to prevent surprise overages

### 3.10 SETTINGS — Team & Configuration

```
┌─ Settings ────────────────────────────────────────────┐
│                                                         │
│  [Team] [API Keys] [Branding] [Notifications] [Danger]│
│  ━━━━━━                                               │
│                                                         │
│  ┌─ Team Members ────────────────────────────────────┐│
│  │                                                    ││
│  │  👤 Ernie Ismail        ernie@acmecorp.com       ││
│  │     Owner              [Edit] [Remove]           ││
│  │                                                    ││
│  │  👤 Jane Smith          jane@acmecorp.com        ││
│  │     Admin               [Edit] [Remove]          ││
│  │                                                    ││
│  │  👤 Bob Johnson         bob@acmecorp.com         ││
│  │     Member              [Edit] [Remove]          ││
│  │                                                    ││
│  │  ┌─ Invite Team Member ──────────────────────┐  ││
│  │  │                                             │  ││
│  │  │  Email: [________________] Role: [Admin ▼] │  ││
│  │  │                       [Send Invitation]     │  ││
│  │  └─────────────────────────────────────────┘  ││
│  │                                                    ││
│  │  Pending invitations: 1                           ││
│  │  • invited@acmecorp.com (sent 2 days ago)        ││
│  │    [Resend] [Cancel]                             ││
│  └────────────────────────────────────────────────┘│
│                                                         │
│  ┌─ API Keys ─────────────────────────────────────┐  │
│  │                                                 │  │
│  │  ┌─────────────────────────────────────────┐   │  │
│  │  │ Production Key                           │   │  │
│  │  │ gc_live_••••••••••••••••••••••••••••••   │   │  │
│  │  │ Created: Jan 15, 2026                   │   │  │
│  │  │ Last used: Mar 5, 2026                  │   │  │
│  │  │ Scopes: agents.read, agents.write,      │   │  │
│  │  │         conversations.read              │   │  │
│  │  │                [Copy] [Revoke]          │   │  │
│  │  └─────────────────────────────────────────┘   │  │
│  │                                                 │  │
│  │  ┌─────────────────────────────────────────┐   │  │
│  │  │ Staging Key                              │   │  │
│  │  │ gc_test_••••••••••••••••••••••••••••••   │   │  │
│  │  │ Created: Feb 10, 2026                   │   │  │
│  │  │ Last used: Mar 4, 2026                  │   │  │
│  │  │ Scopes: agents.read, workflows.read     │   │  │
│  │  │                [Copy] [Revoke]          │   │  │
│  │  └─────────────────────────────────────────┘   │  │
│  │                                                 │  │
│  │  ┌─ Create New Key ────────────────────────┐   │  │
│  │  │ Key name: [______________]              │   │  │
│  │  │ Scopes:                                 │   │  │
│  │  │ ☑ agents.read      ☑ workflows.read    │   │  │
│  │  │ ☑ agents.write     ☑ workflows.write   │   │  │
│  │  │ ☑ conversations.read                   │   │  │
│  │  │ ☐ admin.read       ☐ admin.write       │   │  │
│  │  │              [Create Key]               │   │  │
│  │  └─────────────────────────────────────────┘   │  │
│  └────────────────────────────────────────────────┘  │
│                                                         │
│  ┌─ Branding ─────────────────────────────────────┐  │
│  │                                                 │  │
│  │  Logo Upload                                   │  │
│  │  [Click to upload or drag & drop]              │  │
│  │                                                 │  │
│  │  Widget Color Theme                            │  │
│  │  Primary: [████] #3B82F6         [Color Picker] │  │
│  │  Accent:  [████] #8B5CF6         [Color Picker] │  │
│  │                                                 │  │
│  │  Widget Display Name                           │  │
│  │  [My Company Chatbot ______________]           │  │
│  │                                                 │  │
│  │  Custom Domain (Enterprise only)               │  │
│  │  ☐ Use custom domain                          │  │
│  │    subdomain: [_____________].global-claw.com  │  │
│  │                                                 │  │
│  │  ┌─ Preview ──────────┐                       │  │
│  │  │ Chatbot preview    │                       │  │
│  │  │ showing colors     │                       │  │
│  │  │ and logo           │                       │  │
│  │  └────────────────────┘                       │  │
│  │                              [Save Changes]    │  │
│  └────────────────────────────────────────────────┘  │
│                                                         │
│  ┌─ Notifications ─────────────────────────────────┐  │
│  │                                                 │  │
│  │  Email Notifications                           │  │
│  │  ☑ Daily summary report                        │  │
│  │  ☑ Agent errors & downtime                     │  │
│  │  ☑ Usage approaching limit                     │  │
│  │  ☐ New team member joined                      │  │
│  │                                                 │  │
│  │  Telegram Notifications                        │  │
│  │  ☑ Critical alerts only                        │  │
│  │  ☐ Daily metrics                               │  │
│  │                                                 │  │
│  │                              [Save Changes]    │  │
│  └────────────────────────────────────────────────┘  │
│                                                         │
│  ┌─ Danger Zone ───────────────────────────────────┐  │
│  │                                                 │  │
│  │  Delete This Tenant                            │  │
│  │  This action cannot be undone. All agents,     │  │
│  │  conversations, and data will be permanently   │  │
│  │  deleted.                                      │  │
│  │                      [Delete Tenant]  (red)    │  │
│  │                                                 │  │
│  │  Export All Data                               │  │
│  │  Download a JSON export of all tenant data,    │  │
│  │  conversations, and memory.                    │  │
│  │                      [Export as JSON]          │  │
│  └────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────┘
```

**Key design decisions:**
- Tab-based navigation (Team, API Keys, Branding, Notifications, Danger Zone)
- Team tab shows current members with role badges + quick edit/remove actions
- Invite form is minimally intrusive (below member list)
- API keys shown masked except first/last 8 chars; last-used timestamp provided
- Key scopes shown as checklist (not all users see all scope options)
- Branding section includes live color picker + preview pane
- Custom domain available only on Enterprise plan
- Notification preferences split by channel (email, Telegram)
- Danger Zone in separate tab with prominent red delete button (requires confirmation)
- All settings auto-save where possible (with toast confirmation)

### 3.11 TENANTS — Admin Multi-Tenant Panel (Super Admin Only)

```
┌─ Tenants (Admin) ─────────────────────────────────────┐
│                                                         │
│  🔍 Search tenants...  [Plan ▼] [Status ▼] [Sort ▼]   │
│                                                         │
│  ┌─ Tenant Directory ─────────────────────────────────┐│
│  │                                                     ││
│  │  Tenant Name      │ Plan  │ Status │ Agents │ MRR  ││
│  │  ━━━━━━━━━━━━━━━━┼───────┼────────┼────────┼─────  ││
│  │  Acme Corporation │ Pro   │ ● Live │   5    │ $237 ││
│  │  Tech Startup Inc │ Starter│● Live │   1    │ $29  ││
│  │  Global Solutions │Business│⊘ Susp │   8    │ $447 ││
│  │  Local Services   │ Pro   │ ● Live │   3    │ $158 ││
│  │  Premium Partners │ Enterprise│● Live │ 12   │ $2,400 ││
│  │  Demo Account     │ Pro   │ ⊘ Susp │   0    │ $0   ││
│  │                                                     ││
│  │  [Show older...]                                    ││
│  └─────────────────────────────────────────────────────┘│
│                                                         │
│  ┌─ Tenant Detail (Slide-over) ────────────────────┐  │
│  │                                                  │  │
│  │  Acme Corporation         [Edit] [⋮]           │  │
│  │  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━   │  │
│  │                                                  │  │
│  │  Subscription                                   │  │
│  │  Plan: Pro | Status: ● Live                    │  │
│  │  Stripe ID: cus_L9x2K...                       │  │
│  │  MRR: $237 | Churn risk: Low                   │  │
│  │  Renewal: Apr 15, 2026                         │  │
│  │                                                  │  │
│  │  ┌─ Usage (Last 30 Days) ──────────────────┐   │  │
│  │  │ Messages: 12,847 / 50,000              │   │  │
│  │  │ [████████░░░░░░░░░░░░░░░░]            │   │  │
│  │  │                                          │   │  │
│  │  │ Tokens: 489M / 500M                    │   │  │
│  │  │ [███████████████████░░░░]             │   │  │
│  │  │                                          │   │  │
│  │  │ Cost: $189.23 / $200 budget            │   │  │
│  │  │ [████████████████░░░░░]               │   │  │
│  │  └──────────────────────────────────────┘   │  │
│  │                                                  │  │
│  │  ┌─ Quick Actions ──────────────────────────┐  │  │
│  │  │ [Suspend Tenant] [Upgrade Plan]         │  │  │
│  │  │ [Send Notification] [View Audit Log]    │  │  │
│  │  └──────────────────────────────────────────┘  │  │
│  │                                                  │  │
│  │  ┌─ Partner Info ────────────────────────────┐  │  │
│  │  │ Reseller Tier: Partner                    │  │  │
│  │  │ Partner ID: ACME-2024                    │  │  │
│  │  │ Referred by: John Martinez (jm-001)      │  │  │
│  │  │ Commission: 40% off RRP                  │  │  │
│  │  └──────────────────────────────────────────┘  │  │
│  │                                                  │  │
│  │  ┌─ Team ────────────────────────────────────┐  │  │
│  │  │ Owner: Sarah Chen (sarah@acmecorp.com)   │  │  │
│  │  │ Users: 4 members                         │  │  │
│  │  │         [View Team]                      │  │  │
│  │  └──────────────────────────────────────────┘  │  │
│  └──────────────────────────────────────────────┘  │
│                                                      │
│  Bulk Actions: [Suspend Selected] [Upgrade Selected] ▼
└──────────────────────────────────────────────────────┘
```

**Key design decisions:**
- Visible only to platform super-admins (role-based access control)
- Main table shows: tenant name, plan tier, status (online/suspended), agent count, MRR
- Status indicators: green dot (active), warning symbol (suspended)
- Table is sortable by all columns and filterable (plan, status, partner tier)
- Detail slide-over shows: subscription info, usage meters, quick actions, partner info, team details
- Usage meters show consumption vs. limit + cost forecast
- Quick actions include: Suspend/Reactivate, Upgrade Plan, Send notification to tenant, View audit log
- Partner info section shows: reseller tier, referral chain, commission rate
- Bulk actions at bottom allow: suspend multiple tenants, upgrade plan tier for multiple
- Search is full-text (tenant name, customer email, Stripe ID, partner ID)
- Color coding: green for healthy, amber for near limits, red for critical issues
- Each row's status toggle (● / ⊘) can be clicked to suspend/activate instantly

---

## 4. INTERACTION PATTERNS

### Non-Technical User Experience
1. **Guided Setup Wizard**: First-time users get a 4-step onboarding (Create Agent → Choose Model → Connect Integrations → Test in Telegram)
2. **Template Gallery**: Pre-built agent templates (Sales Bot, Support Agent, Scheduler, Data Collector)
3. **Natural Language Config**: "Make my agent respond in Latvian and Russian" → auto-configures language settings
4. **Preview & Test**: In-dashboard Telegram simulator before deploying

### Admin Power Features
1. **Keyboard shortcuts**: Cmd+K command palette, Cmd+/ search, Cmd+N new agent
2. **Bulk operations**: Select multiple agents → change model, update config, toggle integrations
3. **Raw JSON editor**: Toggle between visual UI and raw config JSON
4. **API playground**: Test API endpoints with live request/response

### Real-Time Elements
- Agent status dots pulse when processing
- Message counters increment in real-time via WebSocket
- Workflow nodes glow when executing
- Toast notifications for completed tasks
- Cost ticker updates live

---

## 5. RESPONSIVE & ACCESSIBILITY

### Breakpoints
- Desktop: 1440px+ (full sidebar + content + panels)
- Laptop: 1024-1439px (collapsed sidebar + content)
- Tablet: 768-1023px (bottom nav + full content)
- Mobile: <768px (bottom nav + stacked cards)

### Accessibility (WCAG AA)
- All interactive elements: 44px minimum touch target
- Color contrast: 4.5:1 minimum for text
- Focus indicators: 2px accent-blue ring on all focusable elements
- Screen reader: ARIA labels on all dynamic content
- Reduced motion: Respect prefers-reduced-motion media query

---

## 6. VISUAL DESIGN SCREENS TO PRODUCE

For the canvas-design execution, we will create the following hero screens as high-fidelity visual designs:

**Screen 1: Overview — Mission Control Dashboard**
The flagship screen showing the full overview with metric cards, agent fleet heatmap, workflow status, and activity feed. Dark theme. Shows the product at its most impressive.

**Screen 2: Agent Management + Detail Panel**
Split view showing agent list with the slide-over detail panel open, displaying SOUL.md editor, model config, and integration toggles.

**Screen 3: Workflow Visual Editor**
The Lobster workflow canvas with connected nodes, minimap, and bottom inspector panel. Shows a real workflow in action with live execution indicators.

**Screen 4: LLM Provider Router**
Provider cards with traffic distribution bars, routing rules, and cost dashboard. The "zero lock-in" screen.

---

*This plan synthesizes: OpenClaw architecture patterns, analysis of 10 competing platforms (Dify, Langflow, Flowise, Botpress, Voiceflow, CrewAI, n8n, Rivet, Langbase, AgentGPT), and 2025-2026 dashboard UX best practices.*
