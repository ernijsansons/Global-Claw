<script lang="ts">
// Search and filter
// biome-ignore lint/style/useConst: Svelte reactive state bound in template
let searchQuery = "";
// biome-ignore lint/style/useConst: Svelte reactive state for filtering
let filterStatus = "all";

// Connected integrations
const connectedIntegrations = [
	{
		id: "1",
		name: "Google Calendar",
		icon: "📅",
		status: "connected",
		connectedAt: "2026-02-15",
		lastSync: "2026-03-05T10:30:00Z",
		scopes: ["calendar.read", "calendar.write", "events.create"],
	},
	{
		id: "2",
		name: "Notion",
		icon: "📝",
		status: "connected",
		connectedAt: "2026-02-20",
		lastSync: "2026-03-05T09:15:00Z",
		scopes: ["read_content", "update_content", "create_pages"],
	},
	{
		id: "3",
		name: "Stripe",
		icon: "💳",
		status: "connected",
		connectedAt: "2026-01-10",
		lastSync: "2026-03-05T11:00:00Z",
		scopes: ["payments.read", "customers.read", "subscriptions.read"],
	},
	{
		id: "4",
		name: "Telegram",
		icon: "✈️",
		status: "connected",
		connectedAt: "2026-01-05",
		lastSync: "2026-03-05T11:05:00Z",
		scopes: ["bot.messages", "bot.commands"],
	},
];

// Available integrations
const availableIntegrations = [
	{
		id: "github",
		name: "GitHub",
		icon: "🐙",
		description: "Connect repositories, issues, and PRs",
		category: "Development",
		popular: true,
	},
	{
		id: "slack",
		name: "Slack",
		icon: "💬",
		description: "Send messages and notifications to channels",
		category: "Communication",
		popular: true,
	},
	{
		id: "hubspot",
		name: "HubSpot",
		icon: "🧡",
		description: "Sync contacts, deals, and marketing data",
		category: "CRM",
		popular: true,
	},
	{
		id: "jira",
		name: "Jira",
		icon: "🎯",
		description: "Manage issues and project tracking",
		category: "Development",
		popular: false,
	},
	{
		id: "shopify",
		name: "Shopify",
		icon: "🛒",
		description: "Manage products, orders, and customers",
		category: "E-commerce",
		popular: true,
	},
	{
		id: "zapier",
		name: "Zapier",
		icon: "⚡",
		description: "Connect to 5000+ apps via Zaps",
		category: "Automation",
		popular: true,
	},
	{
		id: "discord",
		name: "Discord",
		icon: "🎮",
		description: "Bot integration for Discord servers",
		category: "Communication",
		popular: false,
	},
	{
		id: "linear",
		name: "Linear",
		icon: "📐",
		description: "Modern issue tracking and project management",
		category: "Development",
		popular: false,
	},
	{
		id: "airtable",
		name: "Airtable",
		icon: "📊",
		description: "Spreadsheet-database hybrid for data management",
		category: "Database",
		popular: false,
	},
	{
		id: "mailchimp",
		name: "Mailchimp",
		icon: "📧",
		description: "Email marketing and automation",
		category: "Marketing",
		popular: false,
	},
	{
		id: "intercom",
		name: "Intercom",
		icon: "💭",
		description: "Customer messaging and support platform",
		category: "Support",
		popular: false,
	},
	{
		id: "zendesk",
		name: "Zendesk",
		icon: "🎫",
		description: "Customer service and ticketing system",
		category: "Support",
		popular: false,
	},
];

// Categories
const categories = [
	"All",
	"Development",
	"Communication",
	"CRM",
	"E-commerce",
	"Automation",
	"Database",
	"Marketing",
	"Support",
];
// biome-ignore lint/style/useConst: Svelte reactive state reassigned in template
let selectedCategory = "All";

// Modal state
let showManageModal = false;
let managingIntegration: (typeof connectedIntegrations)[0] | null = null;

function formatDate(dateStr: string): string {
	const date = new Date(dateStr);
	return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatLastSync(dateStr: string): string {
	const date = new Date(dateStr);
	const now = new Date();
	const diffMs = now.getTime() - date.getTime();
	const diffMins = Math.floor(diffMs / 60000);
	if (diffMins < 60) return `${diffMins}m ago`;
	const diffHours = Math.floor(diffMins / 60);
	if (diffHours < 24) return `${diffHours}h ago`;
	return formatDate(dateStr);
}

function filteredAvailable() {
	return availableIntegrations.filter((integration) => {
		const matchesSearch =
			searchQuery === "" ||
			integration.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
			integration.description.toLowerCase().includes(searchQuery.toLowerCase());
		const matchesCategory = selectedCategory === "All" || integration.category === selectedCategory;
		return matchesSearch && matchesCategory;
	});
}

function openManageModal(integration: (typeof connectedIntegrations)[0]) {
	managingIntegration = integration;
	showManageModal = true;
}

function closeManageModal() {
	showManageModal = false;
	managingIntegration = null;
}

function handleConnect(_integration: (typeof availableIntegrations)[0]) {
	// TODO: Initiate OAuth flow - window.location.href = `/oauth/${_integration.provider}/initiate`
}
</script>

<div class="p-6 space-y-6">
	<!-- Header -->
	<div class="flex items-center justify-between">
		<div>
			<h1 class="text-2xl font-bold text-gc-text-primary">Integrations</h1>
			<p class="text-gc-text-secondary mt-1">Connect your favorite tools with 1-click OAuth</p>
		</div>
	</div>

	<!-- Connected Integrations -->
	<div>
		<h2 class="text-lg font-semibold text-gc-text-primary mb-4">Connected ({connectedIntegrations.length})</h2>
		<div class="grid grid-cols-2 gap-4">
			{#each connectedIntegrations as integration}
				<div class="bg-gc-bg-surface border border-gc-border-subtle rounded-xl p-4 flex items-center justify-between">
					<div class="flex items-center gap-4">
						<div class="w-12 h-12 bg-gc-bg-elevated rounded-xl flex items-center justify-center text-2xl">
							{integration.icon}
						</div>
						<div>
							<div class="flex items-center gap-2">
								<span class="font-medium text-gc-text-primary">{integration.name}</span>
								<span class="w-2 h-2 rounded-full bg-gc-accent-emerald"></span>
								<span class="text-xs text-gc-accent-emerald">Connected</span>
							</div>
							<div class="text-sm text-gc-text-secondary mt-1">
								Last sync: {formatLastSync(integration.lastSync)}
							</div>
						</div>
					</div>
					<button
						on:click={() => openManageModal(integration)}
						class="px-4 py-2 bg-gc-bg-elevated text-gc-text-primary rounded-lg hover:bg-gc-border-subtle transition-colors text-sm"
					>
						Manage
					</button>
				</div>
			{/each}
		</div>
	</div>

	<!-- Search and Category Filter -->
	<div class="flex items-center gap-4">
		<div class="flex-1 relative">
			<input
				type="text"
				placeholder="Search integrations..."
				bind:value={searchQuery}
				class="w-full px-4 py-3 pl-10 bg-gc-bg-surface border border-gc-border-subtle rounded-lg text-gc-text-primary placeholder-gc-text-muted focus:outline-none focus:border-gc-border-focus"
			/>
			<span class="absolute left-3 top-1/2 -translate-y-1/2 text-gc-text-muted">🔍</span>
		</div>
	</div>

	<!-- Category Tabs -->
	<div class="flex items-center gap-2 overflow-x-auto pb-2">
		{#each categories as category}
			<button
				on:click={() => selectedCategory = category}
				class="px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors {selectedCategory === category ? 'bg-gc-accent-blue text-white' : 'bg-gc-bg-surface text-gc-text-secondary hover:text-gc-text-primary border border-gc-border-subtle'}"
			>
				{category}
			</button>
		{/each}
	</div>

	<!-- Available Integrations -->
	<div>
		<h2 class="text-lg font-semibold text-gc-text-primary mb-4">Available</h2>
		<div class="grid grid-cols-4 gap-4">
			{#each filteredAvailable() as integration}
				<div class="bg-gc-bg-surface border border-gc-border-subtle rounded-xl p-5 flex flex-col items-center text-center hover:border-gc-border-focus transition-colors group">
					<div class="w-16 h-16 bg-gc-bg-elevated rounded-2xl flex items-center justify-center text-3xl mb-4 group-hover:scale-110 transition-transform">
						{integration.icon}
					</div>
					<h3 class="font-medium text-gc-text-primary">{integration.name}</h3>
					{#if integration.popular}
						<span class="text-xs text-gc-accent-amber mt-1">⭐ Popular</span>
					{/if}
					<p class="text-sm text-gc-text-secondary mt-2 line-clamp-2">{integration.description}</p>
					<span class="text-xs text-gc-text-muted mt-2">{integration.category}</span>
					<button
						on:click={() => handleConnect(integration)}
						class="mt-4 w-full px-4 py-2 bg-gc-accent-blue text-white rounded-lg hover:bg-gc-accent-blue/80 transition-colors text-sm font-medium"
					>
						Connect
					</button>
				</div>
			{/each}
		</div>
	</div>

	<!-- Request Integration -->
	<div class="bg-gc-bg-surface border border-gc-border-subtle border-dashed rounded-xl p-8 text-center">
		<div class="text-4xl mb-4">🔌</div>
		<h3 class="text-lg font-semibold text-gc-text-primary">Need a different integration?</h3>
		<p class="text-gc-text-secondary mt-2 max-w-md mx-auto">
			Let us know what tools you'd like to connect and we'll prioritize building it.
		</p>
		<button class="mt-4 px-6 py-2 bg-gc-bg-elevated text-gc-text-primary rounded-lg hover:bg-gc-border-subtle transition-colors">
			Request Integration
		</button>
	</div>
</div>

<!-- Manage Integration Modal -->
{#if showManageModal && managingIntegration}
	<div
		class="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
		role="dialog"
		aria-modal="true"
		aria-labelledby="manage-modal-title"
		on:click|self={closeManageModal}
		on:keydown={(e) => e.key === 'Escape' && closeManageModal()}
	>
		<div class="bg-gc-bg-surface border border-gc-border-subtle rounded-2xl w-full max-w-lg p-6">
			<div class="flex items-center justify-between mb-6">
				<div class="flex items-center gap-4">
					<div class="w-12 h-12 bg-gc-bg-elevated rounded-xl flex items-center justify-center text-2xl">
						{managingIntegration.icon}
					</div>
					<div>
						<h2 id="manage-modal-title" class="text-xl font-semibold text-gc-text-primary">{managingIntegration.name}</h2>
						<span class="text-sm text-gc-accent-emerald">● Connected</span>
					</div>
				</div>
				<button on:click={closeManageModal} class="text-gc-text-muted hover:text-gc-text-primary text-xl">
					✕
				</button>
			</div>

			<div class="space-y-4">
				<div>
					<span class="text-sm text-gc-text-muted uppercase tracking-wider">Connected Since</span>
					<p class="text-gc-text-primary mt-1">{formatDate(managingIntegration.connectedAt)}</p>
				</div>

				<div>
					<span class="text-sm text-gc-text-muted uppercase tracking-wider">Last Sync</span>
					<p class="text-gc-text-primary mt-1">{formatLastSync(managingIntegration.lastSync)}</p>
				</div>

				<div>
					<span class="text-sm text-gc-text-muted uppercase tracking-wider">Permissions</span>
					<div class="mt-2 space-y-2">
						{#each managingIntegration.scopes as scope}
							<div class="flex items-center gap-2 text-gc-text-primary">
								<span class="text-gc-accent-emerald">✓</span>
								<span class="text-sm font-mono">{scope}</span>
							</div>
						{/each}
					</div>
				</div>
			</div>

			<div class="mt-6 pt-4 border-t border-gc-border-subtle flex justify-between">
				<button class="px-4 py-2 bg-gc-bg-elevated text-gc-text-primary rounded-lg hover:bg-gc-border-subtle transition-colors">
					🔄 Re-sync Now
				</button>
				<button class="px-4 py-2 bg-gc-accent-rose/20 text-gc-accent-rose rounded-lg hover:bg-gc-accent-rose/30 transition-colors">
					Disconnect
				</button>
			</div>
		</div>
	</div>
{/if}

<style>
	.line-clamp-2 {
		display: -webkit-box;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}
</style>
