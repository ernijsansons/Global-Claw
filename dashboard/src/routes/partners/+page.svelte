<script lang="ts">
// Partner profile
const partner = {
	id: "PARTNER-001",
	name: "Ernie Ismail",
	email: "ernie@acmecorp.com",
	tier: "Premium",
	referralCode: "ERNIE-2026",
	commissionRate: 50,
	joinedAt: "2025-12-01",
	status: "active",
};

// Earnings overview
const _earnings = {
	thisMonth: 1247.5,
	lastMonth: 980.0,
	allTime: 8542.3,
	pending: 320.0,
	nextPayout: "2026-03-15",
};

// Active tenants
const _tenants = [
	{
		id: "1",
		name: "TechStartup Inc",
		plan: "pro",
		mrr: 79,
		commission: 39.5,
		status: "active",
		createdAt: "2026-01-15",
	},
	{
		id: "2",
		name: "Local Services",
		plan: "business",
		mrr: 149,
		commission: 74.5,
		status: "active",
		createdAt: "2026-02-01",
	},
	{
		id: "3",
		name: "Marketing Agency",
		plan: "pro",
		mrr: 79,
		commission: 39.5,
		status: "active",
		createdAt: "2026-02-15",
	},
	{
		id: "4",
		name: "E-commerce Store",
		plan: "starter",
		mrr: 29,
		commission: 14.5,
		status: "active",
		createdAt: "2026-02-28",
	},
	{
		id: "5",
		name: "Digital Agency",
		plan: "pro",
		mrr: 79,
		commission: 39.5,
		status: "trial",
		createdAt: "2026-03-01",
	},
];

// Referral tracking
const _referralStats = {
	clicks: 847,
	signups: 42,
	converted: 12,
	conversionRate: 28.6,
};

// Commission history
const _commissionHistory = [
	{ month: "Feb 2026", amount: 980.0, tenants: 4, status: "paid" },
	{ month: "Jan 2026", amount: 1120.0, tenants: 5, status: "paid" },
	{ month: "Dec 2025", amount: 890.5, tenants: 4, status: "paid" },
];

// Active tab
const _activeTab: "overview" | "tenants" | "commissions" | "resources" = "overview";

// Spawn tenant modal
const _showSpawnModal = false;
const _spawnForm = {
	name: "",
	email: "",
	plan: "pro",
	notes: "",
};

function formatCurrency(amount: number): string {
	return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);
}

function formatDate(dateStr: string): string {
	const date = new Date(dateStr);
	return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
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

function getTierColor(tier: string): string {
	const colors: Record<string, string> = {
		Affiliate: "gc-text-secondary",
		Partner: "gc-accent-blue",
		Premium: "gc-accent-violet",
		Master: "gc-accent-amber",
	};
	return colors[tier] || "gc-text-secondary";
}

function copyReferralLink() {
	navigator.clipboard.writeText(`https://global-claw.com/?ref=${partner.referralCode}`);
}
</script>

<div class="p-6 space-y-6">
	<!-- Header -->
	<div class="flex items-center justify-between">
		<div>
			<div class="flex items-center gap-3">
				<h1 class="text-2xl font-bold text-gc-text-primary">Partner Portal</h1>
				<span class="px-2 py-1 rounded-full text-xs font-medium bg-{getTierColor(partner.tier)}/20 text-{getTierColor(partner.tier)}">
					{partner.tier} Partner
				</span>
			</div>
			<p class="text-gc-text-secondary mt-1">Manage your referrals and track earnings</p>
		</div>
		<button
			on:click={() => showSpawnModal = true}
			class="px-4 py-2 bg-gc-accent-blue text-white rounded-lg hover:bg-gc-accent-blue/80 transition-colors"
		>
			+ Spawn Tenant
		</button>
	</div>

	<!-- Quick Stats -->
	<div class="grid grid-cols-4 gap-4">
		<div class="bg-gc-bg-surface border border-gc-border-subtle rounded-xl p-5">
			<div class="text-sm text-gc-text-secondary mb-1">This Month</div>
			<div class="text-3xl font-bold text-gc-accent-emerald">{formatCurrency(earnings.thisMonth)}</div>
			<div class="text-sm text-gc-accent-emerald mt-1">
				↑ {((earnings.thisMonth - earnings.lastMonth) / earnings.lastMonth * 100).toFixed(0)}% vs last month
			</div>
		</div>
		<div class="bg-gc-bg-surface border border-gc-border-subtle rounded-xl p-5">
			<div class="text-sm text-gc-text-secondary mb-1">All Time Earnings</div>
			<div class="text-3xl font-bold text-gc-text-primary">{formatCurrency(earnings.allTime)}</div>
			<div class="text-sm text-gc-text-muted mt-1">Since {formatDate(partner.joinedAt)}</div>
		</div>
		<div class="bg-gc-bg-surface border border-gc-border-subtle rounded-xl p-5">
			<div class="text-sm text-gc-text-secondary mb-1">Active Tenants</div>
			<div class="text-3xl font-bold text-gc-text-primary">{tenants.filter(t => t.status === 'active').length}</div>
			<div class="text-sm text-gc-text-muted mt-1">{tenants.filter(t => t.status === 'trial').length} in trial</div>
		</div>
		<div class="bg-gc-bg-surface border border-gc-border-subtle rounded-xl p-5">
			<div class="text-sm text-gc-text-secondary mb-1">Conversion Rate</div>
			<div class="text-3xl font-bold text-gc-text-primary">{referralStats.conversionRate}%</div>
			<div class="text-sm text-gc-text-muted mt-1">{referralStats.converted} of {referralStats.signups} signups</div>
		</div>
	</div>

	<!-- Referral Code Card -->
	<div class="bg-gradient-to-r from-gc-accent-violet/20 to-gc-accent-blue/20 border border-gc-border-subtle rounded-xl p-6">
		<div class="flex items-center justify-between">
			<div>
				<h3 class="text-lg font-semibold text-gc-text-primary mb-2">Your Referral Link</h3>
				<div class="flex items-center gap-3">
					<code class="px-4 py-2 bg-gc-bg-root rounded-lg font-mono text-gc-text-primary">
						https://global-claw.com/?ref={partner.referralCode}
					</code>
					<button
						on:click={copyReferralLink}
						class="px-4 py-2 bg-gc-accent-blue text-white rounded-lg hover:bg-gc-accent-blue/80 transition-colors"
					>
						Copy Link
					</button>
				</div>
				<p class="text-sm text-gc-text-secondary mt-2">
					Earn {partner.commissionRate}% recurring commission on every referral
				</p>
			</div>
			<div class="text-right">
				<div class="text-sm text-gc-text-secondary mb-1">Link Clicks</div>
				<div class="text-2xl font-bold text-gc-text-primary">{referralStats.clicks}</div>
			</div>
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
			on:click={() => activeTab = 'tenants'}
			class="px-4 py-2 rounded-md text-sm font-medium transition-colors {activeTab === 'tenants' ? 'bg-gc-accent-blue text-white' : 'text-gc-text-secondary hover:text-gc-text-primary'}"
		>
			Tenants
		</button>
		<button
			on:click={() => activeTab = 'commissions'}
			class="px-4 py-2 rounded-md text-sm font-medium transition-colors {activeTab === 'commissions' ? 'bg-gc-accent-blue text-white' : 'text-gc-text-secondary hover:text-gc-text-primary'}"
		>
			Commissions
		</button>
		<button
			on:click={() => activeTab = 'resources'}
			class="px-4 py-2 rounded-md text-sm font-medium transition-colors {activeTab === 'resources' ? 'bg-gc-accent-blue text-white' : 'text-gc-text-secondary hover:text-gc-text-primary'}"
		>
			Resources
		</button>
	</div>

	{#if activeTab === 'overview'}
		<div class="grid grid-cols-2 gap-6">
			<!-- Recent Tenants -->
			<div class="bg-gc-bg-surface border border-gc-border-subtle rounded-xl">
				<div class="p-4 border-b border-gc-border-subtle flex items-center justify-between">
					<h3 class="font-semibold text-gc-text-primary">Recent Tenants</h3>
					<button on:click={() => activeTab = 'tenants'} class="text-sm text-gc-accent-blue hover:underline">
						View All
					</button>
				</div>
				<div class="p-4 space-y-3">
					{#each tenants.slice(0, 4) as tenant}
						<div class="flex items-center justify-between">
							<div>
								<div class="font-medium text-gc-text-primary">{tenant.name}</div>
								<div class="text-sm text-gc-text-secondary capitalize">{tenant.plan} • {tenant.status}</div>
							</div>
							<div class="text-right">
								<div class="font-medium text-gc-accent-emerald">{formatCurrency(tenant.commission)}/mo</div>
								<div class="text-xs text-gc-text-muted">{formatDate(tenant.createdAt)}</div>
							</div>
						</div>
					{/each}
				</div>
			</div>

			<!-- Commission History -->
			<div class="bg-gc-bg-surface border border-gc-border-subtle rounded-xl">
				<div class="p-4 border-b border-gc-border-subtle flex items-center justify-between">
					<h3 class="font-semibold text-gc-text-primary">Commission History</h3>
					<button on:click={() => activeTab = 'commissions'} class="text-sm text-gc-accent-blue hover:underline">
						View All
					</button>
				</div>
				<div class="p-4 space-y-3">
					{#each commissionHistory as record}
						<div class="flex items-center justify-between">
							<div>
								<div class="font-medium text-gc-text-primary">{record.month}</div>
								<div class="text-sm text-gc-text-secondary">{record.tenants} tenants</div>
							</div>
							<div class="text-right">
								<div class="font-medium text-gc-text-primary">{formatCurrency(record.amount)}</div>
								<span class="text-xs px-2 py-0.5 bg-gc-accent-emerald/20 text-gc-accent-emerald rounded-full">{record.status}</span>
							</div>
						</div>
					{/each}
				</div>
			</div>
		</div>

		<!-- Tier Progress -->
		<div class="bg-gc-bg-surface border border-gc-border-subtle rounded-xl p-6">
			<h3 class="font-semibold text-gc-text-primary mb-4">Partner Tier Progress</h3>
			<div class="flex items-center gap-4 mb-4">
				<div class="flex-1">
					<div class="flex items-center justify-between mb-2">
						<span class="text-sm text-gc-text-secondary">Premium (Current)</span>
						<span class="text-sm text-gc-text-secondary">Master (25 active tenants)</span>
					</div>
					<div class="w-full h-3 bg-gc-bg-elevated rounded-full overflow-hidden">
						<div class="h-full bg-gc-accent-violet rounded-full" style="width: 48%"></div>
					</div>
				</div>
			</div>
			<div class="flex items-center justify-between text-sm">
				<span class="text-gc-text-primary">{tenants.filter(t => t.status === 'active').length} / 25 tenants</span>
				<span class="text-gc-text-secondary">Upgrade to Master for 55% commission + 10% override</span>
			</div>
		</div>

	{:else if activeTab === 'tenants'}
		<!-- Tenants Table -->
		<div class="bg-gc-bg-surface border border-gc-border-subtle rounded-xl overflow-hidden">
			<table class="w-full">
				<thead>
					<tr class="border-b border-gc-border-subtle bg-gc-bg-elevated">
						<th class="px-4 py-3 text-left text-xs font-medium text-gc-text-secondary uppercase tracking-wider">Tenant</th>
						<th class="px-4 py-3 text-left text-xs font-medium text-gc-text-secondary uppercase tracking-wider">Plan</th>
						<th class="px-4 py-3 text-left text-xs font-medium text-gc-text-secondary uppercase tracking-wider">MRR</th>
						<th class="px-4 py-3 text-left text-xs font-medium text-gc-text-secondary uppercase tracking-wider">Your Commission</th>
						<th class="px-4 py-3 text-left text-xs font-medium text-gc-text-secondary uppercase tracking-wider">Status</th>
						<th class="px-4 py-3 text-left text-xs font-medium text-gc-text-secondary uppercase tracking-wider">Created</th>
					</tr>
				</thead>
				<tbody>
					{#each tenants as tenant}
						<tr class="border-b border-gc-border-subtle last:border-0 hover:bg-gc-bg-elevated transition-colors">
							<td class="px-4 py-3 text-gc-text-primary font-medium">{tenant.name}</td>
							<td class="px-4 py-3">
								<span class="text-{getPlanColor(tenant.plan)} capitalize">{tenant.plan}</span>
							</td>
							<td class="px-4 py-3 text-gc-text-primary">{formatCurrency(tenant.mrr)}</td>
							<td class="px-4 py-3 text-gc-accent-emerald font-medium">{formatCurrency(tenant.commission)}</td>
							<td class="px-4 py-3">
								{#if tenant.status === 'active'}
									<span class="px-2 py-1 bg-gc-accent-emerald/20 text-gc-accent-emerald rounded-full text-xs">Active</span>
								{:else}
									<span class="px-2 py-1 bg-gc-accent-amber/20 text-gc-accent-amber rounded-full text-xs">Trial</span>
								{/if}
							</td>
							<td class="px-4 py-3 text-gc-text-muted">{formatDate(tenant.createdAt)}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>

	{:else if activeTab === 'commissions'}
		<!-- Commissions -->
		<div class="grid grid-cols-3 gap-6">
			<div class="col-span-2 bg-gc-bg-surface border border-gc-border-subtle rounded-xl overflow-hidden">
				<div class="p-4 border-b border-gc-border-subtle">
					<h3 class="font-semibold text-gc-text-primary">Payout History</h3>
				</div>
				<table class="w-full">
					<thead>
						<tr class="border-b border-gc-border-subtle bg-gc-bg-elevated">
							<th class="px-4 py-3 text-left text-xs font-medium text-gc-text-secondary uppercase tracking-wider">Period</th>
							<th class="px-4 py-3 text-left text-xs font-medium text-gc-text-secondary uppercase tracking-wider">Amount</th>
							<th class="px-4 py-3 text-left text-xs font-medium text-gc-text-secondary uppercase tracking-wider">Tenants</th>
							<th class="px-4 py-3 text-left text-xs font-medium text-gc-text-secondary uppercase tracking-wider">Status</th>
						</tr>
					</thead>
					<tbody>
						{#each commissionHistory as record}
							<tr class="border-b border-gc-border-subtle last:border-0 hover:bg-gc-bg-elevated transition-colors">
								<td class="px-4 py-3 text-gc-text-primary font-medium">{record.month}</td>
								<td class="px-4 py-3 text-gc-text-primary">{formatCurrency(record.amount)}</td>
								<td class="px-4 py-3 text-gc-text-secondary">{record.tenants}</td>
								<td class="px-4 py-3">
									<span class="px-2 py-1 bg-gc-accent-emerald/20 text-gc-accent-emerald rounded-full text-xs capitalize">{record.status}</span>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>

			<div class="space-y-4">
				<!-- Pending Payout -->
				<div class="bg-gc-bg-surface border border-gc-border-subtle rounded-xl p-5">
					<h3 class="font-semibold text-gc-text-primary mb-3">Pending Payout</h3>
					<div class="text-3xl font-bold text-gc-accent-amber mb-2">{formatCurrency(earnings.pending)}</div>
					<div class="text-sm text-gc-text-secondary">Next payout: {formatDate(earnings.nextPayout)}</div>
				</div>

				<!-- Payout Settings -->
				<div class="bg-gc-bg-surface border border-gc-border-subtle rounded-xl p-5">
					<h3 class="font-semibold text-gc-text-primary mb-3">Payout Settings</h3>
					<div class="space-y-3">
						<div>
							<label class="text-xs text-gc-text-muted uppercase tracking-wider">Method</label>
							<p class="text-gc-text-primary">Bank Transfer (SEPA)</p>
						</div>
						<div>
							<label class="text-xs text-gc-text-muted uppercase tracking-wider">Account</label>
							<p class="text-gc-text-primary">••••4567</p>
						</div>
						<button class="w-full px-3 py-2 bg-gc-bg-elevated text-gc-text-primary rounded-lg hover:bg-gc-border-subtle transition-colors text-sm">
							Update Payout Settings
						</button>
					</div>
				</div>
			</div>
		</div>

	{:else if activeTab === 'resources'}
		<!-- Partner Resources -->
		<div class="grid grid-cols-3 gap-6">
			<div class="bg-gc-bg-surface border border-gc-border-subtle rounded-xl p-5">
				<div class="text-3xl mb-3">📚</div>
				<h3 class="font-semibold text-gc-text-primary mb-2">Partner Handbook</h3>
				<p class="text-sm text-gc-text-secondary mb-4">Complete guide to maximizing your partnership</p>
				<button class="w-full px-3 py-2 bg-gc-bg-elevated text-gc-text-primary rounded-lg hover:bg-gc-border-subtle transition-colors text-sm">
					Download PDF
				</button>
			</div>

			<div class="bg-gc-bg-surface border border-gc-border-subtle rounded-xl p-5">
				<div class="text-3xl mb-3">🎨</div>
				<h3 class="font-semibold text-gc-text-primary mb-2">Brand Assets</h3>
				<p class="text-sm text-gc-text-secondary mb-4">Logos, banners, and marketing materials</p>
				<button class="w-full px-3 py-2 bg-gc-bg-elevated text-gc-text-primary rounded-lg hover:bg-gc-border-subtle transition-colors text-sm">
					Download Assets
				</button>
			</div>

			<div class="bg-gc-bg-surface border border-gc-border-subtle rounded-xl p-5">
				<div class="text-3xl mb-3">📧</div>
				<h3 class="font-semibold text-gc-text-primary mb-2">Email Templates</h3>
				<p class="text-sm text-gc-text-secondary mb-4">Pre-written outreach templates</p>
				<button class="w-full px-3 py-2 bg-gc-bg-elevated text-gc-text-primary rounded-lg hover:bg-gc-border-subtle transition-colors text-sm">
					View Templates
				</button>
			</div>

			<div class="bg-gc-bg-surface border border-gc-border-subtle rounded-xl p-5">
				<div class="text-3xl mb-3">🎥</div>
				<h3 class="font-semibold text-gc-text-primary mb-2">Demo Videos</h3>
				<p class="text-sm text-gc-text-secondary mb-4">Product walkthrough videos for prospects</p>
				<button class="w-full px-3 py-2 bg-gc-bg-elevated text-gc-text-primary rounded-lg hover:bg-gc-border-subtle transition-colors text-sm">
					Watch Videos
				</button>
			</div>

			<div class="bg-gc-bg-surface border border-gc-border-subtle rounded-xl p-5">
				<div class="text-3xl mb-3">💬</div>
				<h3 class="font-semibold text-gc-text-primary mb-2">Partner Slack</h3>
				<p class="text-sm text-gc-text-secondary mb-4">Connect with other partners and our team</p>
				<button class="w-full px-3 py-2 bg-gc-bg-elevated text-gc-text-primary rounded-lg hover:bg-gc-border-subtle transition-colors text-sm">
					Join Slack
				</button>
			</div>

			<div class="bg-gc-bg-surface border border-gc-border-subtle rounded-xl p-5">
				<div class="text-3xl mb-3">📞</div>
				<h3 class="font-semibold text-gc-text-primary mb-2">Partner Support</h3>
				<p class="text-sm text-gc-text-secondary mb-4">Priority support for partner questions</p>
				<button class="w-full px-3 py-2 bg-gc-bg-elevated text-gc-text-primary rounded-lg hover:bg-gc-border-subtle transition-colors text-sm">
					Contact Support
				</button>
			</div>
		</div>
	{/if}
</div>

<!-- Spawn Tenant Modal -->
{#if showSpawnModal}
	<div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50" on:click|self={() => showSpawnModal = false}>
		<div class="bg-gc-bg-surface border border-gc-border-subtle rounded-2xl w-full max-w-lg p-6">
			<div class="flex items-center justify-between mb-6">
				<h2 class="text-xl font-semibold text-gc-text-primary">Spawn New Tenant</h2>
				<button on:click={() => showSpawnModal = false} class="text-gc-text-muted hover:text-gc-text-primary text-xl">
					✕
				</button>
			</div>

			<div class="space-y-4">
				<div>
					<label class="block text-sm text-gc-text-secondary mb-2">Company Name</label>
					<input
						type="text"
						bind:value={spawnForm.name}
						placeholder="e.g., Acme Corp"
						class="w-full px-4 py-2 bg-gc-bg-elevated border border-gc-border-subtle rounded-lg text-gc-text-primary placeholder-gc-text-muted focus:outline-none focus:border-gc-border-focus"
					/>
				</div>

				<div>
					<label class="block text-sm text-gc-text-secondary mb-2">Admin Email</label>
					<input
						type="email"
						bind:value={spawnForm.email}
						placeholder="admin@company.com"
						class="w-full px-4 py-2 bg-gc-bg-elevated border border-gc-border-subtle rounded-lg text-gc-text-primary placeholder-gc-text-muted focus:outline-none focus:border-gc-border-focus"
					/>
				</div>

				<div>
					<label class="block text-sm text-gc-text-secondary mb-2">Initial Plan</label>
					<select
						bind:value={spawnForm.plan}
						class="w-full px-4 py-2 bg-gc-bg-elevated border border-gc-border-subtle rounded-lg text-gc-text-primary focus:outline-none focus:border-gc-border-focus"
					>
						<option value="starter">Starter - $29/mo</option>
						<option value="pro">Pro - $79/mo (Recommended)</option>
						<option value="business">Business - $149/mo</option>
					</select>
				</div>

				<div>
					<label class="block text-sm text-gc-text-secondary mb-2">Notes (Optional)</label>
					<textarea
						bind:value={spawnForm.notes}
						placeholder="Any additional context..."
						rows="3"
						class="w-full px-4 py-2 bg-gc-bg-elevated border border-gc-border-subtle rounded-lg text-gc-text-primary placeholder-gc-text-muted focus:outline-none focus:border-gc-border-focus resize-none"
					></textarea>
				</div>
			</div>

			<div class="mt-6 flex gap-3">
				<button
					on:click={() => showSpawnModal = false}
					class="flex-1 px-4 py-2 bg-gc-bg-elevated text-gc-text-primary rounded-lg hover:bg-gc-border-subtle transition-colors"
				>
					Cancel
				</button>
				<button class="flex-1 px-4 py-2 bg-gc-accent-blue text-white rounded-lg hover:bg-gc-accent-blue/80 transition-colors">
					Create Tenant
				</button>
			</div>

			<p class="mt-4 text-xs text-gc-text-muted text-center">
				The tenant will be created with your referral code automatically applied.
			</p>
		</div>
	</div>
{/if}
