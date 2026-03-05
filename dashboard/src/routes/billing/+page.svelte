<script lang="ts">
// Current plan
const _currentPlan = {
	name: "Pro",
	price: 79,
	renewalDate: "2026-03-25",
	usage: {
		tokens: { used: 10000000, limit: 50000000, costUsed: 45.2, costRemaining: 74.8 },
		messages: { used: 8924, limit: 10000, remaining: 76 },
		agents: { used: 3, limit: 5 },
	},
};

// Plan comparison
const _plans = [
	{
		name: "Starter",
		price: 29,
		tokens: "5M",
		messages: "2,500",
		agents: "1",
		prioritySupport: false,
		customRoutes: false,
		current: false,
	},
	{
		name: "Pro",
		price: 79,
		tokens: "50M",
		messages: "10,000",
		agents: "5",
		prioritySupport: true,
		customRoutes: true,
		current: true,
	},
	{
		name: "Business",
		price: 149,
		tokens: "500M",
		messages: "100,000",
		agents: "25",
		prioritySupport: true,
		customRoutes: true,
		current: false,
	},
	{
		name: "Enterprise",
		price: null,
		tokens: "Unlimited",
		messages: "Unlimited",
		agents: "Unlimited",
		prioritySupport: true,
		customRoutes: true,
		current: false,
	},
];

// Invoice history
const _invoices = [
	{ date: "2026-02-25", amount: 79.0, status: "paid", id: "INV-2026-0225" },
	{ date: "2026-01-25", amount: 79.0, status: "paid", id: "INV-2026-0125" },
	{ date: "2025-12-25", amount: 79.0, status: "paid", id: "INV-2025-1225" },
	{ date: "2025-11-25", amount: 49.0, status: "paid", id: "INV-2025-1125" },
	{ date: "2025-10-25", amount: 49.0, status: "paid", id: "INV-2025-1025" },
];

// Referral program
const _referral = {
	code: "ERNIE-2026",
	commissionRate: 20,
	referrals: 3,
	pending: 1,
	earningsThisMonth: 47.4,
};

// Tab state
const _activeTab: "overview" | "plans" | "invoices" | "referral" = "overview";

function formatCurrency(amount: number): string {
	return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);
}

function formatDate(dateStr: string): string {
	const date = new Date(dateStr);
	return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatNumber(num: number): string {
	if (num >= 1000000) return `${(num / 1000000).toFixed(0)}M`;
	if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
	return num.toString();
}
</script>

<div class="p-6 space-y-6">
	<!-- Header -->
	<div class="flex items-center justify-between">
		<div>
			<h1 class="text-2xl font-bold text-gc-text-primary">Billing</h1>
			<p class="text-gc-text-secondary mt-1">Manage your subscription and payment methods</p>
		</div>
	</div>

	<!-- Tabs -->
	<div class="flex items-center gap-1 bg-gc-bg-surface border border-gc-border-subtle rounded-lg p-1 w-fit">
		<button
			on:click={() => activeTab = 'overview'}
			class="px-4 py-2 rounded-md text-sm font-medium transition-colors {activeTab === 'overview' ? 'bg-gc-accent-blue text-white' : 'text-gc-text-secondary hover:text-gc-text-primary'}"
		>
			Overview
		</button>
		<button
			on:click={() => activeTab = 'plans'}
			class="px-4 py-2 rounded-md text-sm font-medium transition-colors {activeTab === 'plans' ? 'bg-gc-accent-blue text-white' : 'text-gc-text-secondary hover:text-gc-text-primary'}"
		>
			Plans
		</button>
		<button
			on:click={() => activeTab = 'invoices'}
			class="px-4 py-2 rounded-md text-sm font-medium transition-colors {activeTab === 'invoices' ? 'bg-gc-accent-blue text-white' : 'text-gc-text-secondary hover:text-gc-text-primary'}"
		>
			Invoices
		</button>
		<button
			on:click={() => activeTab = 'referral'}
			class="px-4 py-2 rounded-md text-sm font-medium transition-colors {activeTab === 'referral' ? 'bg-gc-accent-blue text-white' : 'text-gc-text-secondary hover:text-gc-text-primary'}"
		>
			Referral
		</button>
	</div>

	{#if activeTab === 'overview'}
		<!-- Current Plan Card -->
		<div class="bg-gc-bg-surface border border-gc-border-subtle rounded-xl p-6">
			<div class="flex items-start justify-between mb-6">
				<div>
					<div class="flex items-center gap-3">
						<h2 class="text-xl font-semibold text-gc-text-primary">{currentPlan.name} Plan</h2>
						<span class="px-2 py-0.5 bg-gc-accent-blue/20 text-gc-accent-blue rounded-full text-xs font-medium">Current</span>
					</div>
					<p class="text-gc-text-secondary mt-1">
						{formatCurrency(currentPlan.price)} / month • Renews {formatDate(currentPlan.renewalDate)}
					</p>
				</div>
				<div class="flex gap-2">
					<button class="px-4 py-2 bg-gc-accent-blue text-white rounded-lg hover:bg-gc-accent-blue/80 transition-colors text-sm">
						Upgrade Plan
					</button>
					<button class="px-4 py-2 bg-gc-bg-elevated text-gc-text-primary rounded-lg hover:bg-gc-border-subtle transition-colors text-sm">
						Manage Payment
					</button>
				</div>
			</div>

			<!-- Usage Meters -->
			<div class="space-y-4">
				<!-- Tokens -->
				<div class="bg-gc-bg-elevated rounded-xl p-4">
					<div class="flex items-center justify-between mb-2">
						<span class="text-sm font-medium text-gc-text-primary">Token Budget</span>
						<span class="text-sm text-gc-text-secondary">
							{formatNumber(currentPlan.usage.tokens.used)} used / {formatNumber(currentPlan.usage.tokens.limit)} limit
						</span>
					</div>
					<div class="w-full h-3 bg-gc-bg-surface rounded-full overflow-hidden mb-2">
						<div
							class="h-full bg-gc-accent-blue rounded-full"
							style="width: {(currentPlan.usage.tokens.used / currentPlan.usage.tokens.limit) * 100}%"
						></div>
					</div>
					<div class="text-sm text-gc-text-secondary">
						{formatCurrency(currentPlan.usage.tokens.costUsed)} of {formatCurrency(currentPlan.usage.tokens.costUsed + currentPlan.usage.tokens.costRemaining)} remaining
					</div>
				</div>

				<!-- Messages -->
				<div class="bg-gc-bg-elevated rounded-xl p-4">
					<div class="flex items-center justify-between mb-2">
						<span class="text-sm font-medium text-gc-text-primary">Messages Budget</span>
						<span class="text-sm text-gc-text-secondary">
							{currentPlan.usage.messages.used.toLocaleString()} used / {currentPlan.usage.messages.limit.toLocaleString()} limit
						</span>
					</div>
					<div class="w-full h-3 bg-gc-bg-surface rounded-full overflow-hidden mb-2">
						<div
							class="h-full bg-gc-accent-violet rounded-full"
							style="width: {(currentPlan.usage.messages.used / currentPlan.usage.messages.limit) * 100}%"
						></div>
					</div>
					<div class="text-sm text-gc-text-secondary">
						~{currentPlan.usage.messages.remaining} messages remaining today
					</div>
				</div>

				<!-- Agents -->
				<div class="bg-gc-bg-elevated rounded-xl p-4">
					<div class="flex items-center justify-between mb-2">
						<span class="text-sm font-medium text-gc-text-primary">Active Agents</span>
						<span class="text-sm text-gc-text-secondary">
							{currentPlan.usage.agents.used} of {currentPlan.usage.agents.limit} agents
						</span>
					</div>
					<div class="w-full h-3 bg-gc-bg-surface rounded-full overflow-hidden">
						<div
							class="h-full bg-gc-accent-emerald rounded-full"
							style="width: {(currentPlan.usage.agents.used / currentPlan.usage.agents.limit) * 100}%"
						></div>
					</div>
				</div>
			</div>
		</div>

	{:else if activeTab === 'plans'}
		<!-- Plan Comparison -->
		<div class="grid grid-cols-4 gap-4">
			{#each plans as plan}
				<div class="bg-gc-bg-surface border {plan.current ? 'border-gc-accent-blue' : 'border-gc-border-subtle'} rounded-xl p-6 relative">
					{#if plan.current}
						<div class="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-gc-accent-blue text-white text-xs font-medium rounded-full">
							Current Plan
						</div>
					{/if}
					<h3 class="text-lg font-semibold text-gc-text-primary mb-2">{plan.name}</h3>
					<div class="mb-4">
						{#if plan.price}
							<span class="text-3xl font-bold text-gc-text-primary">${plan.price}</span>
							<span class="text-gc-text-secondary">/mo</span>
						{:else}
							<span class="text-xl font-bold text-gc-text-primary">Custom</span>
						{/if}
					</div>

					<div class="space-y-3 mb-6">
						<div class="flex items-center justify-between text-sm">
							<span class="text-gc-text-secondary">Tokens</span>
							<span class="text-gc-text-primary">{plan.tokens}</span>
						</div>
						<div class="flex items-center justify-between text-sm">
							<span class="text-gc-text-secondary">Messages</span>
							<span class="text-gc-text-primary">{plan.messages}</span>
						</div>
						<div class="flex items-center justify-between text-sm">
							<span class="text-gc-text-secondary">Agents</span>
							<span class="text-gc-text-primary">{plan.agents}</span>
						</div>
						<div class="flex items-center justify-between text-sm">
							<span class="text-gc-text-secondary">Priority Support</span>
							<span class="{plan.prioritySupport ? 'text-gc-accent-emerald' : 'text-gc-text-muted'}">
								{plan.prioritySupport ? '●' : '○'}
							</span>
						</div>
						<div class="flex items-center justify-between text-sm">
							<span class="text-gc-text-secondary">Custom LLM Routes</span>
							<span class="{plan.customRoutes ? 'text-gc-accent-emerald' : 'text-gc-text-muted'}">
								{plan.customRoutes ? '●' : '○'}
							</span>
						</div>
					</div>

					{#if plan.current}
						<button class="w-full px-4 py-2 bg-gc-bg-elevated text-gc-text-secondary rounded-lg cursor-not-allowed text-sm">
							Current Plan
						</button>
					{:else if plan.price}
						<button class="w-full px-4 py-2 bg-gc-accent-blue text-white rounded-lg hover:bg-gc-accent-blue/80 transition-colors text-sm">
							{plan.price > currentPlan.price ? 'Upgrade' : 'Downgrade'}
						</button>
					{:else}
						<button class="w-full px-4 py-2 bg-gc-bg-elevated text-gc-text-primary rounded-lg hover:bg-gc-border-subtle transition-colors text-sm">
							Contact Sales
						</button>
					{/if}
				</div>
			{/each}
		</div>

	{:else if activeTab === 'invoices'}
		<!-- Invoice History -->
		<div class="bg-gc-bg-surface border border-gc-border-subtle rounded-xl overflow-hidden">
			<table class="w-full">
				<thead>
					<tr class="border-b border-gc-border-subtle bg-gc-bg-elevated">
						<th class="px-6 py-4 text-left text-xs font-medium text-gc-text-secondary uppercase tracking-wider">Date</th>
						<th class="px-6 py-4 text-left text-xs font-medium text-gc-text-secondary uppercase tracking-wider">Invoice ID</th>
						<th class="px-6 py-4 text-left text-xs font-medium text-gc-text-secondary uppercase tracking-wider">Amount</th>
						<th class="px-6 py-4 text-left text-xs font-medium text-gc-text-secondary uppercase tracking-wider">Status</th>
						<th class="px-6 py-4 text-left text-xs font-medium text-gc-text-secondary uppercase tracking-wider">Actions</th>
					</tr>
				</thead>
				<tbody>
					{#each invoices as invoice}
						<tr class="border-b border-gc-border-subtle last:border-0 hover:bg-gc-bg-elevated transition-colors">
							<td class="px-6 py-4 text-sm text-gc-text-primary">{formatDate(invoice.date)}</td>
							<td class="px-6 py-4 text-sm text-gc-text-secondary font-mono">{invoice.id}</td>
							<td class="px-6 py-4 text-sm text-gc-text-primary">{formatCurrency(invoice.amount)}</td>
							<td class="px-6 py-4">
								<span class="inline-flex items-center gap-1.5 px-2 py-1 bg-gc-accent-emerald/20 text-gc-accent-emerald rounded-full text-xs font-medium">
									<span class="w-1.5 h-1.5 rounded-full bg-gc-accent-emerald"></span>
									Paid
								</span>
							</td>
							<td class="px-6 py-4">
								<div class="flex items-center gap-2">
									<button class="text-sm text-gc-accent-blue hover:underline">View</button>
									<button class="text-sm text-gc-text-secondary hover:text-gc-text-primary">Download PDF</button>
								</div>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>

	{:else if activeTab === 'referral'}
		<!-- Referral Program -->
		<div class="max-w-2xl space-y-6">
			<!-- Referral Code Card -->
			<div class="bg-gc-bg-surface border border-gc-border-subtle rounded-xl p-6">
				<h3 class="text-lg font-semibold text-gc-text-primary mb-2">Your Referral Code</h3>
				<p class="text-gc-text-secondary mb-4">
					Share your code and earn {referral.commissionRate}% recurring commission on every referral.
				</p>

				<div class="flex items-center gap-3">
					<div class="flex-1 px-4 py-3 bg-gc-bg-elevated rounded-lg font-mono text-lg text-gc-text-primary">
						{referral.code}
					</div>
					<button class="px-4 py-3 bg-gc-accent-blue text-white rounded-lg hover:bg-gc-accent-blue/80 transition-colors">
						Copy Code
					</button>
				</div>
			</div>

			<!-- Stats -->
			<div class="grid grid-cols-3 gap-4">
				<div class="bg-gc-bg-surface border border-gc-border-subtle rounded-xl p-5">
					<div class="text-3xl font-bold text-gc-text-primary">{referral.referrals}</div>
					<div class="text-sm text-gc-text-secondary mt-1">Active Referrals</div>
				</div>
				<div class="bg-gc-bg-surface border border-gc-border-subtle rounded-xl p-5">
					<div class="text-3xl font-bold text-gc-accent-amber">{referral.pending}</div>
					<div class="text-sm text-gc-text-secondary mt-1">Pending</div>
				</div>
				<div class="bg-gc-bg-surface border border-gc-border-subtle rounded-xl p-5">
					<div class="text-3xl font-bold text-gc-accent-emerald">{formatCurrency(referral.earningsThisMonth)}</div>
					<div class="text-sm text-gc-text-secondary mt-1">This Month</div>
				</div>
			</div>

			<!-- CTA -->
			<div class="bg-gc-bg-surface border border-gc-border-subtle rounded-xl p-6 text-center">
				<div class="text-4xl mb-3">💰</div>
				<h3 class="text-lg font-semibold text-gc-text-primary">Become a Partner</h3>
				<p class="text-gc-text-secondary mt-2 mb-4">
					Unlock higher commission rates, white-label options, and dedicated support by joining our partner program.
				</p>
				<button class="px-6 py-2 bg-gc-accent-violet text-white rounded-lg hover:bg-gc-accent-violet/80 transition-colors">
					View Referral Dashboard
				</button>
			</div>
		</div>
	{/if}
</div>
