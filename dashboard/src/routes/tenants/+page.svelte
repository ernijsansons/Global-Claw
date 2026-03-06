<script lang="ts">
// Filters
// biome-ignore lint/style/useConst: Svelte reactive state bound in template
let searchQuery = "";
// biome-ignore lint/style/useConst: Svelte reactive state bound in template
let filterPlan = "all";
// biome-ignore lint/style/useConst: Svelte reactive state bound in template
let filterStatus = "all";

// Sample tenants data
const tenants = [
	{
		id: "1",
		name: "Acme Corporation",
		plan: "pro",
		status: "active",
		agents: 5,
		mrr: 237,
		stripeId: "cus_L9x2K...",
		churnRisk: "low",
		renewal: "2026-04-15",
		usage: {
			messages: 12847,
			messagesLimit: 50000,
			tokens: 489000000,
			tokensLimit: 500000000,
			cost: 189.23,
			costBudget: 200,
		},
		owner: {
			name: "Sarah Chen",
			email: "sarah@acmecorp.com",
		},
		partner: {
			tier: "Partner",
			id: "ACME-2024",
			referredBy: "John Martinez (jm-001)",
			commission: 40,
		},
		teamSize: 4,
	},
	{
		id: "2",
		name: "Tech Startup Inc",
		plan: "starter",
		status: "active",
		agents: 1,
		mrr: 29,
		stripeId: "cus_M4x8Y...",
		churnRisk: "medium",
		renewal: "2026-03-25",
		usage: {
			messages: 1850,
			messagesLimit: 2500,
			tokens: 4200000,
			tokensLimit: 5000000,
			cost: 24.5,
			costBudget: 30,
		},
		owner: {
			name: "Alex Turner",
			email: "alex@techstartup.io",
		},
		partner: null,
		teamSize: 2,
	},
	{
		id: "3",
		name: "Global Solutions",
		plan: "business",
		status: "suspended",
		agents: 8,
		mrr: 447,
		stripeId: "cus_K2p9Z...",
		churnRisk: "high",
		renewal: "2026-03-10",
		usage: {
			messages: 45000,
			messagesLimit: 100000,
			tokens: 350000000,
			tokensLimit: 500000000,
			cost: 312.0,
			costBudget: 400,
		},
		owner: {
			name: "Maria Garcia",
			email: "maria@globalsolutions.com",
		},
		partner: null,
		teamSize: 6,
	},
	{
		id: "4",
		name: "Local Services",
		plan: "pro",
		status: "active",
		agents: 3,
		mrr: 158,
		stripeId: "cus_N7m3Q...",
		churnRisk: "low",
		renewal: "2026-04-20",
		usage: {
			messages: 8200,
			messagesLimit: 50000,
			tokens: 120000000,
			tokensLimit: 500000000,
			cost: 89.5,
			costBudget: 150,
		},
		owner: {
			name: "James Wilson",
			email: "james@localservices.lv",
		},
		partner: {
			tier: "Affiliate",
			id: "AFF-2025",
			referredBy: null,
			commission: 30,
		},
		teamSize: 3,
	},
	{
		id: "5",
		name: "Premium Partners",
		plan: "enterprise",
		status: "active",
		agents: 12,
		mrr: 2400,
		stripeId: "cus_P1k5R...",
		churnRisk: "low",
		renewal: "2026-06-01",
		usage: {
			messages: 78000,
			messagesLimit: -1, // unlimited
			tokens: 2100000000,
			tokensLimit: -1,
			cost: 1850.0,
			costBudget: 2500,
		},
		owner: {
			name: "Elena Petrova",
			email: "elena@premiumpartners.eu",
		},
		partner: {
			tier: "Master",
			id: "MASTER-001",
			referredBy: null,
			commission: 55,
		},
		teamSize: 12,
	},
];

// Plan options
const plans = ["starter", "pro", "business", "enterprise"];
const statuses = ["active", "suspended"];

// Selected tenant for detail panel
// biome-ignore lint/style/useConst: Svelte reactive state reassigned in template
let selectedTenant: (typeof tenants)[0] | null = null;

// Bulk selection
let selectedTenantIds: string[] = [];

function formatCurrency(amount: number): string {
	return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);
}

function formatNumber(num: number): string {
	if (num === -1) return "Unlimited";
	if (num >= 1000000000) return `${(num / 1000000000).toFixed(1)}B`;
	if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
	if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
	return num.toString();
}

function getPlanColor(plan: string): string {
	const colors: Record<string, string> = {
		starter: "gc-text-secondary",
		pro: "gc-accent-blue",
		business: "gc-accent-violet",
		enterprise: "gc-accent-amber",
	};
	return colors[plan] || "gc-text-secondary";
}

function getChurnRiskColor(risk: string): string {
	const colors: Record<string, string> = {
		low: "gc-accent-emerald",
		medium: "gc-accent-amber",
		high: "gc-accent-rose",
	};
	return colors[risk] || "gc-text-secondary";
}

function filteredTenants() {
	return tenants.filter((tenant) => {
		const matchesSearch =
			searchQuery === "" ||
			tenant.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
			tenant.owner.email.toLowerCase().includes(searchQuery.toLowerCase());
		const matchesPlan = filterPlan === "all" || tenant.plan === filterPlan;
		const matchesStatus = filterStatus === "all" || tenant.status === filterStatus;
		return matchesSearch && matchesPlan && matchesStatus;
	});
}

function toggleTenantSelection(tenantId: string) {
	if (selectedTenantIds.includes(tenantId)) {
		selectedTenantIds = selectedTenantIds.filter((id) => id !== tenantId);
	} else {
		selectedTenantIds = [...selectedTenantIds, tenantId];
	}
}

function selectAllTenants() {
	if (selectedTenantIds.length === filteredTenants().length) {
		selectedTenantIds = [];
	} else {
		selectedTenantIds = filteredTenants().map((t) => t.id);
	}
}
</script>

<div class="flex h-[calc(100vh-4rem)]">
	<!-- Main Content -->
	<div class="flex-1 flex flex-col {selectedTenant ? 'mr-96' : ''}">
		<!-- Header -->
		<div class="p-6 border-b border-gc-border-subtle">
			<div class="flex items-center justify-between mb-4">
				<div>
					<h1 class="text-2xl font-bold text-gc-text-primary">Tenants</h1>
					<p class="text-gc-text-secondary mt-1">Multi-tenant administration panel</p>
				</div>
			</div>

			<!-- Filters -->
			<div class="flex items-center gap-4">
				<div class="flex-1 relative">
					<input
						type="text"
						placeholder="Search tenants, emails, Stripe IDs..."
						bind:value={searchQuery}
						class="w-full px-4 py-2 pl-10 bg-gc-bg-surface border border-gc-border-subtle rounded-lg text-gc-text-primary placeholder-gc-text-muted focus:outline-none focus:border-gc-border-focus text-sm"
					/>
					<span class="absolute left-3 top-1/2 -translate-y-1/2 text-gc-text-muted">🔍</span>
				</div>
				<select
					bind:value={filterPlan}
					class="px-4 py-2 bg-gc-bg-surface border border-gc-border-subtle rounded-lg text-gc-text-primary focus:outline-none focus:border-gc-border-focus text-sm"
				>
					<option value="all">All Plans</option>
					{#each plans as plan}
						<option value={plan}>{plan.charAt(0).toUpperCase() + plan.slice(1)}</option>
					{/each}
				</select>
				<select
					bind:value={filterStatus}
					class="px-4 py-2 bg-gc-bg-surface border border-gc-border-subtle rounded-lg text-gc-text-primary focus:outline-none focus:border-gc-border-focus text-sm"
				>
					<option value="all">All Status</option>
					{#each statuses as status}
						<option value={status}>{status.charAt(0).toUpperCase() + status.slice(1)}</option>
					{/each}
				</select>
			</div>
		</div>

		<!-- Table -->
		<div class="flex-1 overflow-auto">
			<table class="w-full">
				<thead class="bg-gc-bg-surface sticky top-0">
					<tr class="border-b border-gc-border-subtle">
						<th class="px-4 py-3 text-left">
							<input
								type="checkbox"
								checked={selectedTenantIds.length === filteredTenants().length && filteredTenants().length > 0}
								on:change={selectAllTenants}
								class="w-4 h-4 rounded border-gc-border-subtle bg-gc-bg-elevated"
							/>
						</th>
						<th class="px-4 py-3 text-left text-xs font-medium text-gc-text-secondary uppercase tracking-wider">Tenant</th>
						<th class="px-4 py-3 text-left text-xs font-medium text-gc-text-secondary uppercase tracking-wider">Plan</th>
						<th class="px-4 py-3 text-left text-xs font-medium text-gc-text-secondary uppercase tracking-wider">Status</th>
						<th class="px-4 py-3 text-left text-xs font-medium text-gc-text-secondary uppercase tracking-wider">Agents</th>
						<th class="px-4 py-3 text-left text-xs font-medium text-gc-text-secondary uppercase tracking-wider">MRR</th>
						<th class="px-4 py-3 text-left text-xs font-medium text-gc-text-secondary uppercase tracking-wider">Actions</th>
					</tr>
				</thead>
				<tbody>
					{#each filteredTenants() as tenant}
						<tr
							class="border-b border-gc-border-subtle hover:bg-gc-bg-elevated transition-colors cursor-pointer {selectedTenant?.id === tenant.id ? 'bg-gc-bg-elevated' : ''}"
							on:click={() => selectedTenant = tenant}
						>
							<td class="px-4 py-3" on:click|stopPropagation>
								<input
									type="checkbox"
									checked={selectedTenantIds.includes(tenant.id)}
									on:change={() => toggleTenantSelection(tenant.id)}
									class="w-4 h-4 rounded border-gc-border-subtle bg-gc-bg-elevated"
								/>
							</td>
							<td class="px-4 py-3">
								<div class="font-medium text-gc-text-primary">{tenant.name}</div>
								<div class="text-sm text-gc-text-muted">{tenant.owner.email}</div>
							</td>
							<td class="px-4 py-3">
								<span class="text-sm font-medium text-{getPlanColor(tenant.plan)} capitalize">{tenant.plan}</span>
							</td>
							<td class="px-4 py-3">
								{#if tenant.status === 'active'}
									<span class="flex items-center gap-1.5 text-sm text-gc-accent-emerald">
										<span class="w-2 h-2 rounded-full bg-gc-accent-emerald"></span>
										Live
									</span>
								{:else}
									<span class="flex items-center gap-1.5 text-sm text-gc-accent-amber">
										<span class="w-2 h-2 rounded-full bg-gc-accent-amber"></span>
										Suspended
									</span>
								{/if}
							</td>
							<td class="px-4 py-3 text-sm text-gc-text-primary">{tenant.agents}</td>
							<td class="px-4 py-3 text-sm text-gc-text-primary">{formatCurrency(tenant.mrr)}</td>
							<td class="px-4 py-3" on:click|stopPropagation>
								<div class="flex items-center gap-2">
									<button class="text-xs px-2 py-1 bg-gc-bg-elevated text-gc-text-primary rounded hover:bg-gc-border-subtle transition-colors">
										View
									</button>
									<button class="text-xs px-2 py-1 bg-gc-bg-elevated text-gc-text-primary rounded hover:bg-gc-border-subtle transition-colors">
										⋮
									</button>
								</div>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>

		<!-- Bulk Actions Footer -->
		{#if selectedTenantIds.length > 0}
			<div class="p-4 border-t border-gc-border-subtle bg-gc-bg-surface">
				<div class="flex items-center justify-between">
					<span class="text-sm text-gc-text-secondary">{selectedTenantIds.length} tenant(s) selected</span>
					<div class="flex items-center gap-2">
						<button class="px-3 py-1.5 bg-gc-accent-amber/20 text-gc-accent-amber rounded-lg hover:bg-gc-accent-amber/30 transition-colors text-sm">
							Suspend Selected
						</button>
						<button class="px-3 py-1.5 bg-gc-accent-blue/20 text-gc-accent-blue rounded-lg hover:bg-gc-accent-blue/30 transition-colors text-sm">
							Upgrade Selected
						</button>
					</div>
				</div>
			</div>
		{/if}
	</div>

	<!-- Detail Panel -->
	{#if selectedTenant}
		<div class="fixed right-0 top-16 bottom-0 w-96 bg-gc-bg-surface border-l border-gc-border-subtle overflow-y-auto">
			<div class="p-6">
				<!-- Header -->
				<div class="flex items-center justify-between mb-6">
					<div>
						<h2 class="text-xl font-semibold text-gc-text-primary">{selectedTenant.name}</h2>
						<span class="text-sm text-{getPlanColor(selectedTenant.plan)} capitalize">{selectedTenant.plan}</span>
						<span class="text-sm text-gc-text-muted"> • </span>
						<span class="text-sm text-{selectedTenant.status === 'active' ? 'gc-accent-emerald' : 'gc-accent-amber'}">
							{selectedTenant.status === 'active' ? '● Live' : '⊘ Suspended'}
						</span>
					</div>
					<button
						on:click={() => selectedTenant = null}
						class="text-gc-text-muted hover:text-gc-text-primary"
					>
						✕
					</button>
				</div>

				<!-- Subscription Info -->
				<div class="mb-6">
					<h3 class="text-sm font-medium text-gc-text-secondary uppercase tracking-wider mb-3">Subscription</h3>
					<div class="space-y-2 text-sm">
						<div class="flex justify-between">
							<span class="text-gc-text-secondary">Stripe ID</span>
							<span class="text-gc-text-primary font-mono">{selectedTenant.stripeId}</span>
						</div>
						<div class="flex justify-between">
							<span class="text-gc-text-secondary">MRR</span>
							<span class="text-gc-text-primary">{formatCurrency(selectedTenant.mrr)}</span>
						</div>
						<div class="flex justify-between">
							<span class="text-gc-text-secondary">Churn Risk</span>
							<span class="text-{getChurnRiskColor(selectedTenant.churnRisk)} capitalize">{selectedTenant.churnRisk}</span>
						</div>
						<div class="flex justify-between">
							<span class="text-gc-text-secondary">Renewal</span>
							<span class="text-gc-text-primary">{selectedTenant.renewal}</span>
						</div>
					</div>
				</div>

				<!-- Usage -->
				<div class="mb-6">
					<h3 class="text-sm font-medium text-gc-text-secondary uppercase tracking-wider mb-3">Usage (Last 30 Days)</h3>
					<div class="space-y-3">
						<div>
							<div class="flex justify-between text-sm mb-1">
								<span class="text-gc-text-secondary">Messages</span>
								<span class="text-gc-text-primary">
									{formatNumber(selectedTenant.usage.messages)} / {formatNumber(selectedTenant.usage.messagesLimit)}
								</span>
							</div>
							<div class="w-full h-2 bg-gc-bg-elevated rounded-full overflow-hidden">
								<div
									class="h-full bg-gc-accent-blue rounded-full"
									style="width: {selectedTenant.usage.messagesLimit === -1 ? 50 : (selectedTenant.usage.messages / selectedTenant.usage.messagesLimit) * 100}%"
								></div>
							</div>
						</div>
						<div>
							<div class="flex justify-between text-sm mb-1">
								<span class="text-gc-text-secondary">Tokens</span>
								<span class="text-gc-text-primary">
									{formatNumber(selectedTenant.usage.tokens)} / {formatNumber(selectedTenant.usage.tokensLimit)}
								</span>
							</div>
							<div class="w-full h-2 bg-gc-bg-elevated rounded-full overflow-hidden">
								<div
									class="h-full bg-gc-accent-violet rounded-full"
									style="width: {selectedTenant.usage.tokensLimit === -1 ? 50 : (selectedTenant.usage.tokens / selectedTenant.usage.tokensLimit) * 100}%"
								></div>
							</div>
						</div>
						<div>
							<div class="flex justify-between text-sm mb-1">
								<span class="text-gc-text-secondary">Cost</span>
								<span class="text-gc-text-primary">
									{formatCurrency(selectedTenant.usage.cost)} / {formatCurrency(selectedTenant.usage.costBudget)}
								</span>
							</div>
							<div class="w-full h-2 bg-gc-bg-elevated rounded-full overflow-hidden">
								<div
									class="h-full bg-gc-accent-emerald rounded-full"
									style="width: {(selectedTenant.usage.cost / selectedTenant.usage.costBudget) * 100}%"
								></div>
							</div>
						</div>
					</div>
				</div>

				<!-- Quick Actions -->
				<div class="mb-6">
					<h3 class="text-sm font-medium text-gc-text-secondary uppercase tracking-wider mb-3">Quick Actions</h3>
					<div class="grid grid-cols-2 gap-2">
						<button class="px-3 py-2 bg-gc-bg-elevated text-gc-text-primary rounded-lg hover:bg-gc-border-subtle transition-colors text-sm">
							{selectedTenant.status === 'active' ? 'Suspend' : 'Reactivate'}
						</button>
						<button class="px-3 py-2 bg-gc-bg-elevated text-gc-text-primary rounded-lg hover:bg-gc-border-subtle transition-colors text-sm">
							Upgrade Plan
						</button>
						<button class="px-3 py-2 bg-gc-bg-elevated text-gc-text-primary rounded-lg hover:bg-gc-border-subtle transition-colors text-sm">
							Send Notification
						</button>
						<button class="px-3 py-2 bg-gc-bg-elevated text-gc-text-primary rounded-lg hover:bg-gc-border-subtle transition-colors text-sm">
							View Audit Log
						</button>
					</div>
				</div>

				<!-- Partner Info -->
				{#if selectedTenant.partner}
					<div class="mb-6">
						<h3 class="text-sm font-medium text-gc-text-secondary uppercase tracking-wider mb-3">Partner Info</h3>
						<div class="space-y-2 text-sm">
							<div class="flex justify-between">
								<span class="text-gc-text-secondary">Tier</span>
								<span class="text-gc-text-primary">{selectedTenant.partner.tier}</span>
							</div>
							<div class="flex justify-between">
								<span class="text-gc-text-secondary">Partner ID</span>
								<span class="text-gc-text-primary font-mono">{selectedTenant.partner.id}</span>
							</div>
							{#if selectedTenant.partner.referredBy}
								<div class="flex justify-between">
									<span class="text-gc-text-secondary">Referred By</span>
									<span class="text-gc-text-primary">{selectedTenant.partner.referredBy}</span>
								</div>
							{/if}
							<div class="flex justify-between">
								<span class="text-gc-text-secondary">Commission</span>
								<span class="text-gc-text-primary">{selectedTenant.partner.commission}%</span>
							</div>
						</div>
					</div>
				{/if}

				<!-- Team -->
				<div>
					<h3 class="text-sm font-medium text-gc-text-secondary uppercase tracking-wider mb-3">Team</h3>
					<div class="space-y-2 text-sm">
						<div class="flex justify-between">
							<span class="text-gc-text-secondary">Owner</span>
							<span class="text-gc-text-primary">{selectedTenant.owner.name}</span>
						</div>
						<div class="flex justify-between">
							<span class="text-gc-text-secondary">Email</span>
							<span class="text-gc-text-primary">{selectedTenant.owner.email}</span>
						</div>
						<div class="flex justify-between">
							<span class="text-gc-text-secondary">Team Size</span>
							<span class="text-gc-text-primary">{selectedTenant.teamSize} members</span>
						</div>
					</div>
					<button class="mt-3 w-full px-3 py-2 bg-gc-bg-elevated text-gc-text-primary rounded-lg hover:bg-gc-border-subtle transition-colors text-sm">
						View Team
					</button>
				</div>
			</div>
		</div>
	{/if}
</div>
