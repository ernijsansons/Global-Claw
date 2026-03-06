<script lang="ts">
// Date range
let dateRange = "7d";
const dateRangeOptions = [
	{ value: "24h", label: "Last 24 hours" },
	{ value: "7d", label: "Last 7 days" },
	{ value: "30d", label: "Last 30 days" },
	{ value: "custom", label: "Custom range" },
];

// KPI metrics
const kpis = {
	avgResponseTime: { value: 1.2, unit: "s", change: -15 },
	resolutionRate: { value: 87.4, unit: "%", change: 3.2 },
	customerSatisfaction: { value: 4.2, max: 5.0, change: 0.1 },
	cost7d: { value: 127.84, unit: "$", change: -8 },
};

// Messages over time data (simplified for SVG)
const messagesData = [
	{ day: "Mar 1", value: 450 },
	{ day: "Mar 2", value: 680 },
	{ day: "Mar 3", value: 820 },
	{ day: "Mar 4", value: 950 },
	{ day: "Mar 5", value: 847 },
];
const maxMessages = Math.max(...messagesData.map((d) => d.value));

// Agent performance
const agentPerformance = [
	{ name: "Sales-LV", messages: 847, avgResponse: 1.1, escapceRate: 2.3 },
	{ name: "Support-EN", messages: 623, avgResponse: 1.4, escapceRate: 5.1 },
	{ name: "Support-RU", messages: 234, avgResponse: 1.2, escapceRate: 3.8 },
	{ name: "Lead-Qualify", messages: 189, avgResponse: 0.8, escapceRate: 1.2 },
	{ name: "Data-Collector", messages: 45, avgResponse: 2.3, escapceRate: 0.0 },
];

// LLM cost breakdown
const llmCosts = [
	{ provider: "Claude", percentage: 65, amount: 82.91, color: "#8B5CF6" },
	{ provider: "Qwen", percentage: 28, amount: 35.83, color: "#10B981" },
	{ provider: "Other", percentage: 7, amount: 9.1, color: "#6B7280" },
];

// Language distribution
const languageStats = [
	{ lang: "LV", percentage: 42, color: "#3B82F6" },
	{ lang: "EN", percentage: 35, color: "#10B981" },
	{ lang: "RU", percentage: 23, color: "#F59E0B" },
];

// Peak hours heatmap data (7 days x 24 hours)
const peakHoursData = [
	// Mon
	[0, 0, 0, 0, 0, 1, 2, 4, 6, 7, 8, 8, 7, 6, 5, 4, 5, 6, 7, 5, 3, 2, 1, 0],
	// Tue
	[0, 0, 0, 0, 0, 1, 3, 5, 7, 8, 9, 9, 8, 7, 6, 5, 6, 7, 8, 6, 4, 2, 1, 0],
	// Wed
	[0, 0, 0, 0, 0, 1, 2, 5, 7, 8, 8, 9, 8, 7, 6, 5, 5, 6, 7, 5, 3, 2, 1, 0],
	// Thu
	[0, 0, 0, 0, 0, 1, 3, 4, 6, 7, 8, 8, 7, 6, 5, 4, 5, 6, 6, 4, 3, 2, 1, 0],
	// Fri
	[0, 0, 0, 0, 0, 1, 2, 4, 5, 6, 7, 7, 6, 5, 4, 3, 3, 4, 4, 3, 2, 1, 0, 0],
	// Sat
	[0, 0, 0, 0, 0, 0, 1, 2, 3, 3, 4, 4, 4, 3, 3, 2, 2, 2, 2, 2, 1, 1, 0, 0],
	// Sun
	[0, 0, 0, 0, 0, 0, 0, 1, 2, 2, 3, 3, 3, 2, 2, 2, 2, 3, 3, 2, 1, 1, 0, 0],
];
const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function getHeatmapColor(value: number): string {
	if (value === 0) return "#12121A";
	if (value <= 2) return "#1E3A8A";
	if (value <= 4) return "#2563EB";
	if (value <= 6) return "#3B82F6";
	if (value <= 8) return "#60A5FA";
	return "#93C5FD";
}
</script>

<div class="p-6 space-y-6">
	<!-- Header -->
	<div class="flex items-center justify-between">
		<div>
			<h1 class="text-2xl font-bold text-gc-text-primary">Analytics</h1>
			<p class="text-gc-text-secondary mt-1">Usage, performance, and cost insights</p>
		</div>
		<div class="flex items-center gap-3">
			<select
				bind:value={dateRange}
				class="px-4 py-2 bg-gc-bg-surface border border-gc-border-subtle rounded-lg text-gc-text-primary focus:outline-none focus:border-gc-border-focus"
			>
				{#each dateRangeOptions as option}
					<option value={option.value}>{option.label}</option>
				{/each}
			</select>
			<button class="px-4 py-2 bg-gc-bg-elevated text-gc-text-primary rounded-lg hover:bg-gc-border-subtle transition-colors">
				Export
			</button>
		</div>
	</div>

	<!-- KPI Cards -->
	<div class="grid grid-cols-4 gap-4">
		<div class="bg-gc-bg-surface border border-gc-border-subtle rounded-xl p-5">
			<div class="text-sm text-gc-text-secondary mb-1">Avg Response Time</div>
			<div class="flex items-end gap-2">
				<span class="text-3xl font-bold text-gc-text-primary">{kpis.avgResponseTime.value}</span>
				<span class="text-gc-text-secondary mb-1">{kpis.avgResponseTime.unit}</span>
			</div>
			<div class="mt-2 text-sm {kpis.avgResponseTime.change < 0 ? 'text-gc-accent-emerald' : 'text-gc-accent-rose'}">
				{kpis.avgResponseTime.change < 0 ? '↓' : '↑'} {Math.abs(kpis.avgResponseTime.change)}% vs last period
			</div>
		</div>
		<div class="bg-gc-bg-surface border border-gc-border-subtle rounded-xl p-5">
			<div class="text-sm text-gc-text-secondary mb-1">Issue Resolution Rate</div>
			<div class="flex items-end gap-2">
				<span class="text-3xl font-bold text-gc-text-primary">{kpis.resolutionRate.value}</span>
				<span class="text-gc-text-secondary mb-1">{kpis.resolutionRate.unit}</span>
			</div>
			<div class="mt-2 text-sm {kpis.resolutionRate.change > 0 ? 'text-gc-accent-emerald' : 'text-gc-accent-rose'}">
				{kpis.resolutionRate.change > 0 ? '↑' : '↓'} {Math.abs(kpis.resolutionRate.change)}% vs last period
			</div>
		</div>
		<div class="bg-gc-bg-surface border border-gc-border-subtle rounded-xl p-5">
			<div class="text-sm text-gc-text-secondary mb-1">Customer Satisfaction</div>
			<div class="flex items-end gap-2">
				<span class="text-3xl font-bold text-gc-text-primary">{kpis.customerSatisfaction.value}</span>
				<span class="text-gc-text-secondary mb-1">/ {kpis.customerSatisfaction.max}</span>
			</div>
			<div class="mt-2 text-sm {kpis.customerSatisfaction.change > 0 ? 'text-gc-accent-emerald' : 'text-gc-accent-rose'}">
				{kpis.customerSatisfaction.change > 0 ? '↑' : '↓'} {Math.abs(kpis.customerSatisfaction.change)} vs last period
			</div>
		</div>
		<div class="bg-gc-bg-surface border border-gc-border-subtle rounded-xl p-5">
			<div class="text-sm text-gc-text-secondary mb-1">7-Day LLM Cost</div>
			<div class="flex items-end gap-2">
				<span class="text-3xl font-bold text-gc-text-primary">{kpis.cost7d.unit}{kpis.cost7d.value}</span>
			</div>
			<div class="mt-2 text-sm {kpis.cost7d.change < 0 ? 'text-gc-accent-emerald' : 'text-gc-accent-rose'}">
				{kpis.cost7d.change < 0 ? '↓' : '↑'} {Math.abs(kpis.cost7d.change)}% vs last period
			</div>
		</div>
	</div>

	<!-- Messages Over Time Chart -->
	<div class="bg-gc-bg-surface border border-gc-border-subtle rounded-xl p-5">
		<h3 class="text-lg font-semibold text-gc-text-primary mb-4">Messages Over Time</h3>
		<div class="h-64">
			<svg width="100%" height="100%" viewBox="0 0 600 200" preserveAspectRatio="none">
				<!-- Grid lines -->
				{#each [0, 1, 2, 3, 4] as i}
					<line
						x1="60"
						y1={40 + i * 35}
						x2="580"
						y2={40 + i * 35}
						stroke="#1F1F2E"
						stroke-width="1"
					/>
					<text
						x="50"
						y={45 + i * 35}
						fill="#8B8BA3"
						font-size="10"
						text-anchor="end"
					>
						{Math.round(maxMessages - (i * maxMessages / 4))}
					</text>
				{/each}

				<!-- Area chart -->
				<defs>
					<linearGradient id="areaGradient" x1="0%" y1="0%" x2="0%" y2="100%">
						<stop offset="0%" stop-color="#3B82F6" stop-opacity="0.3" />
						<stop offset="100%" stop-color="#3B82F6" stop-opacity="0" />
					</linearGradient>
				</defs>

				<!-- Area -->
				<path
					d="M 80 {180 - (messagesData[0].value / maxMessages) * 140}
					   L 200 {180 - (messagesData[1].value / maxMessages) * 140}
					   L 320 {180 - (messagesData[2].value / maxMessages) * 140}
					   L 440 {180 - (messagesData[3].value / maxMessages) * 140}
					   L 560 {180 - (messagesData[4].value / maxMessages) * 140}
					   L 560 180
					   L 80 180
					   Z"
					fill="url(#areaGradient)"
				/>

				<!-- Line -->
				<path
					d="M 80 {180 - (messagesData[0].value / maxMessages) * 140}
					   L 200 {180 - (messagesData[1].value / maxMessages) * 140}
					   L 320 {180 - (messagesData[2].value / maxMessages) * 140}
					   L 440 {180 - (messagesData[3].value / maxMessages) * 140}
					   L 560 {180 - (messagesData[4].value / maxMessages) * 140}"
					fill="none"
					stroke="#3B82F6"
					stroke-width="2"
				/>

				<!-- Data points -->
				{#each messagesData as point, i}
					{@const x = 80 + i * 120}
					{@const y = 180 - (point.value / maxMessages) * 140}
					<circle cx={x} cy={y} r="4" fill="#3B82F6" />
					<text x={x} y="195" fill="#8B8BA3" font-size="10" text-anchor="middle">{point.day}</text>
				{/each}
			</svg>
		</div>
	</div>

	<div class="grid grid-cols-2 gap-6">
		<!-- Agent Performance Table -->
		<div class="bg-gc-bg-surface border border-gc-border-subtle rounded-xl overflow-hidden">
			<div class="p-5 border-b border-gc-border-subtle">
				<h3 class="text-lg font-semibold text-gc-text-primary">Agent Performance</h3>
			</div>
			<table class="w-full">
				<thead>
					<tr class="border-b border-gc-border-subtle bg-gc-bg-elevated">
						<th class="px-4 py-3 text-left text-xs font-medium text-gc-text-secondary uppercase tracking-wider">Agent</th>
						<th class="px-4 py-3 text-left text-xs font-medium text-gc-text-secondary uppercase tracking-wider">Messages</th>
						<th class="px-4 py-3 text-left text-xs font-medium text-gc-text-secondary uppercase tracking-wider">Avg Resp</th>
						<th class="px-4 py-3 text-left text-xs font-medium text-gc-text-secondary uppercase tracking-wider">Escape %</th>
					</tr>
				</thead>
				<tbody>
					{#each agentPerformance as agent}
						<tr class="border-b border-gc-border-subtle last:border-0 hover:bg-gc-bg-elevated transition-colors">
							<td class="px-4 py-3 text-sm text-gc-text-primary font-medium">{agent.name}</td>
							<td class="px-4 py-3 text-sm text-gc-text-secondary">{agent.messages}</td>
							<td class="px-4 py-3 text-sm text-gc-text-secondary">{agent.avgResponse}s</td>
							<td class="px-4 py-3 text-sm {agent.escapceRate > 3 ? 'text-gc-accent-amber' : 'text-gc-accent-emerald'}">{agent.escapceRate}%</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>

		<!-- LLM Cost Breakdown & Language Distribution -->
		<div class="space-y-6">
			<!-- LLM Cost Breakdown -->
			<div class="bg-gc-bg-surface border border-gc-border-subtle rounded-xl p-5">
				<h3 class="text-lg font-semibold text-gc-text-primary mb-4">LLM Cost Breakdown</h3>
				<div class="space-y-3">
					{#each llmCosts as cost}
						<div>
							<div class="flex items-center justify-between mb-1">
								<span class="text-sm text-gc-text-primary">{cost.provider}: {cost.percentage}%</span>
								<span class="text-sm text-gc-text-secondary">${cost.amount.toFixed(2)}</span>
							</div>
							<div class="w-full h-2 bg-gc-bg-elevated rounded-full overflow-hidden">
								<div
									class="h-full rounded-full transition-all duration-500"
									style="width: {cost.percentage}%; background-color: {cost.color}"
								></div>
							</div>
						</div>
					{/each}
				</div>
			</div>

			<!-- Language Distribution -->
			<div class="bg-gc-bg-surface border border-gc-border-subtle rounded-xl p-5">
				<h3 class="text-lg font-semibold text-gc-text-primary mb-4">Language Distribution</h3>
				<div class="space-y-3">
					{#each languageStats as lang}
						<div class="flex items-center gap-3">
							<span class="w-8 text-sm text-gc-text-primary font-medium">{lang.lang}</span>
							<div class="flex-1 h-3 bg-gc-bg-elevated rounded-full overflow-hidden">
								<div
									class="h-full rounded-full transition-all duration-500"
									style="width: {lang.percentage}%; background-color: {lang.color}"
								></div>
							</div>
							<span class="w-12 text-sm text-gc-text-secondary text-right">{lang.percentage}%</span>
						</div>
					{/each}
				</div>
			</div>
		</div>
	</div>

	<!-- Peak Hours Heatmap -->
	<div class="bg-gc-bg-surface border border-gc-border-subtle rounded-xl p-5">
		<h3 class="text-lg font-semibold text-gc-text-primary mb-4">Peak Hours Heatmap</h3>
		<div class="overflow-x-auto">
			<div class="flex items-center mb-2 pl-12">
				{#each Array(24) as _, hour}
					{#if hour % 4 === 0}
						<span class="text-xs text-gc-text-muted" style="width: 32px; text-align: center">{hour}:00</span>
					{:else}
						<span style="width: 8px"></span>
					{/if}
				{/each}
			</div>
			<div class="space-y-1">
				{#each peakHoursData as dayData, dayIndex}
					<div class="flex items-center gap-2">
						<span class="text-xs text-gc-text-secondary w-10">{days[dayIndex]}</span>
						<div class="flex gap-0.5">
							{#each dayData as value}
								<div
									class="w-2 h-4 rounded-sm transition-colors"
									style="background-color: {getHeatmapColor(value)}"
									title="{days[dayIndex]} - Intensity: {value}"
								></div>
							{/each}
						</div>
					</div>
				{/each}
			</div>
			<div class="flex items-center gap-2 mt-4 text-xs text-gc-text-muted">
				<span>Less</span>
				<div class="flex gap-0.5">
					<div class="w-3 h-3 rounded-sm" style="background-color: #12121A"></div>
					<div class="w-3 h-3 rounded-sm" style="background-color: #1E3A8A"></div>
					<div class="w-3 h-3 rounded-sm" style="background-color: #2563EB"></div>
					<div class="w-3 h-3 rounded-sm" style="background-color: #3B82F6"></div>
					<div class="w-3 h-3 rounded-sm" style="background-color: #60A5FA"></div>
					<div class="w-3 h-3 rounded-sm" style="background-color: #93C5FD"></div>
				</div>
				<span>More</span>
			</div>
		</div>
	</div>
</div>
