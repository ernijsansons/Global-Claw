<script lang="ts">
import { api } from "$lib/api";
import { onMount } from "svelte";

// Demo data for when not authenticated
const demoMetrics = {
	active_agents: { count: 12, change_pct: 8 },
	messages_today: {
		count: 847,
		sparkline: [10, 20, 30, 45, 60, 80, 90, 85, 70, 60, 50, 40],
	},
	uptime: { pct: 99.7, days: 30 },
	llm_cost_24h: { amount_usd: 23.4, change_pct: -12 },
	agent_fleet_health: [
		{ id: "1", name: "Sales-LV", status: "online" as const, messages_hr: 42, llm_provider: "anthropic" },
		{ id: "2", name: "Support-EN", status: "online" as const, messages_hr: 28, llm_provider: "qwen" },
		{ id: "3", name: "Lead-Qualify", status: "idle" as const, messages_hr: 5, llm_provider: "openai" },
		{ id: "4", name: "Data-Analyst", status: "error" as const, messages_hr: 0, llm_provider: "anthropic" },
	],
	active_workflows: [
		{ id: "1", name: "Onboarding Flow", status: "running" as const, last_run: "2 min ago" },
		{ id: "2", name: "Support Triage", status: "running" as const, last_run: "5 min ago" },
		{ id: "3", name: "Data Sync", status: "paused" as const, last_run: "1 hour ago" },
	],
	recent_activity: [
		{ type: "agent", description: "Agent 'Sales-LV' handled 23 tickets", timestamp: "2m ago" },
		{ type: "workflow", description: "Workflow 'Onboard' completed run #847", timestamp: "5m ago" },
		{ type: "integration", description: "Google Calendar connected", timestamp: "1h ago" },
	],
};

type OverviewData = typeof demoMetrics;
let _metrics: OverviewData = demoMetrics;
let _loading = true;
let _error: string | null = null;

onMount(async () => {
	if ($tenantId) {
		try {
			const response = await api.getOverview($tenantId);
			if (response.success && response.data) {
				_metrics = response.data as OverviewData;
			}
		} catch (_e) {
			_error = "Failed to load dashboard data";
		}
	}
	_loading = false;
});

function getGreeting() {
	const hour = new Date().getHours();
	if (hour < 12) return "Good morning";
	if (hour < 17) return "Good afternoon";
	return "Good evening";
}

function getStatusClass(status: string) {
	switch (status) {
		case "online":
		case "running":
			return "gc-status-online";
		case "idle":
		case "paused":
			return "gc-status-idle";
		default:
			return "gc-status-error";
	}
}
</script>

<svelte:head>
	<title>Overview | Global Claw</title>
</svelte:head>

<div class="space-y-6">
	<!-- Greeting -->
	<div class="flex items-center justify-between">
		<h2 class="text-2xl font-bold">{getGreeting()}</h2>
		<span class="text-gc-text-secondary">{new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}</span>
	</div>

	<!-- Metric Cards -->
	<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
		<!-- Active Agents -->
		<div class="gc-metric-card">
			<div class="flex items-start justify-between">
				<div>
					<p class="gc-metric-value">{metrics.active_agents.count}</p>
					<p class="gc-metric-label">Active Agents</p>
				</div>
				<span class="text-2xl">🤖</span>
			</div>
			{#if metrics.active_agents.change_pct !== 0}
				<p class="text-sm" class:text-gc-accent-emerald={metrics.active_agents.change_pct > 0} class:text-gc-accent-rose={metrics.active_agents.change_pct < 0}>
					{metrics.active_agents.change_pct > 0 ? "+" : ""}{metrics.active_agents.change_pct}% vs last week
				</p>
			{/if}
		</div>

		<!-- Messages Today -->
		<div class="gc-metric-card">
			<div class="flex items-start justify-between">
				<div>
					<p class="gc-metric-value">{metrics.messages_today.count.toLocaleString()}</p>
					<p class="gc-metric-label">Messages Today</p>
				</div>
				<span class="text-2xl">💬</span>
			</div>
			<!-- Mini sparkline -->
			<div class="flex items-end gap-0.5 h-8 mt-2">
				{#each metrics.messages_today.sparkline as value}
					<div
						class="flex-1 bg-gc-accent-blue rounded-sm"
						style="height: {(value / Math.max(...metrics.messages_today.sparkline)) * 100}%"
					/>
				{/each}
			</div>
		</div>

		<!-- Uptime -->
		<div class="gc-metric-card">
			<div class="flex items-start justify-between">
				<div>
					<p class="gc-metric-value">{metrics.uptime.pct}%</p>
					<p class="gc-metric-label">Uptime ({metrics.uptime.days}d)</p>
				</div>
				<span class="text-2xl">⚡</span>
			</div>
			<div class="w-full bg-gc-bg-elevated rounded-full h-2 mt-2">
				<div
					class="bg-gc-accent-emerald h-2 rounded-full"
					style="width: {metrics.uptime.pct}%"
				/>
			</div>
		</div>

		<!-- LLM Cost -->
		<div class="gc-metric-card">
			<div class="flex items-start justify-between">
				<div>
					<p class="gc-metric-value">${metrics.llm_cost_24h.amount_usd.toFixed(2)}</p>
					<p class="gc-metric-label">LLM Cost/24h</p>
				</div>
				<span class="text-2xl">💰</span>
			</div>
			<p class="text-sm" class:text-gc-accent-emerald={metrics.llm_cost_24h.change_pct < 0} class:text-gc-accent-rose={metrics.llm_cost_24h.change_pct > 0}>
				{metrics.llm_cost_24h.change_pct > 0 ? "+" : ""}{metrics.llm_cost_24h.change_pct}% vs yesterday
			</p>
		</div>
	</div>

	<!-- Two Column Layout -->
	<div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
		<!-- Agent Fleet Health (2 cols) -->
		<div class="lg:col-span-2 gc-card">
			<h3 class="text-lg font-semibold mb-4">Agent Fleet Health</h3>
			<div class="grid grid-cols-2 sm:grid-cols-4 gap-4">
				{#each metrics.agent_fleet_health as agent}
					<div class="p-4 bg-gc-bg-elevated rounded-lg">
						<div class="flex items-center gap-2 mb-2">
							<span class={getStatusClass(agent.status)} />
							<span class="text-sm font-medium truncate">{agent.name}</span>
						</div>
						<p class="text-2xl font-bold">{agent.messages_hr}</p>
						<p class="text-xs text-gc-text-secondary">msgs/hr • {agent.llm_provider}</p>
					</div>
				{/each}
			</div>
		</div>

		<!-- Active Workflows (1 col) -->
		<div class="gc-card">
			<h3 class="text-lg font-semibold mb-4">Active Workflows</h3>
			<div class="space-y-3">
				{#each metrics.active_workflows as workflow}
					<div class="flex items-center gap-3 p-3 bg-gc-bg-elevated rounded-lg">
						<span class={getStatusClass(workflow.status)} />
						<div class="flex-1 min-w-0">
							<p class="text-sm font-medium truncate">{workflow.name}</p>
							<p class="text-xs text-gc-text-secondary">{workflow.last_run}</p>
						</div>
						<span class="text-xs px-2 py-1 rounded bg-gc-bg-surface text-gc-text-secondary">
							{workflow.status}
						</span>
					</div>
				{/each}
			</div>
		</div>
	</div>

	<!-- Recent Activity -->
	<div class="gc-card">
		<h3 class="text-lg font-semibold mb-4">Recent Activity</h3>
		<div class="space-y-3">
			{#each metrics.recent_activity as activity}
				<div class="flex items-center gap-4 p-3 hover:bg-gc-bg-elevated rounded-lg transition-colors">
					<span class="text-xl">
						{activity.type === "agent" ? "🤖" : activity.type === "workflow" ? "⚡" : "🔗"}
					</span>
					<div class="flex-1">
						<p class="text-sm">{activity.description}</p>
					</div>
					<span class="text-xs text-gc-text-secondary">{activity.timestamp}</span>
				</div>
			{/each}
		</div>
	</div>
</div>
