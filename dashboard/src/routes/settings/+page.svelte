<script lang="ts">
// Active tab
let activeTab: "team" | "api-keys" | "branding" | "notifications" | "danger" = "team";

// Team members
const teamMembers = [
	{ id: "1", name: "Ernie Ismail", email: "ernie@acmecorp.com", role: "owner", avatar: "EI" },
	{ id: "2", name: "Jane Smith", email: "jane@acmecorp.com", role: "admin", avatar: "JS" },
	{ id: "3", name: "Bob Johnson", email: "bob@acmecorp.com", role: "member", avatar: "BJ" },
];

const pendingInvites = [{ email: "invited@acmecorp.com", sentAt: "2026-03-03" }];

// Invite form
let inviteEmail = "";
let inviteRole = "member";

// API keys
const apiKeys = [
	{
		id: "1",
		name: "Production Key",
		keyPreview: "gc_live_••••••••••••••••••••••••••••••",
		createdAt: "2026-01-15",
		lastUsed: "2026-03-05",
		scopes: ["agents.read", "agents.write", "conversations.read"],
	},
	{
		id: "2",
		name: "Staging Key",
		keyPreview: "gc_test_••••••••••••••••••••••••••••••",
		createdAt: "2026-02-10",
		lastUsed: "2026-03-04",
		scopes: ["agents.read", "workflows.read"],
	},
];

// New key form
let newKeyName = "";
let newKeyScopes = {
	agentsRead: true,
	agentsWrite: true,
	conversationsRead: true,
	workflowsRead: true,
	workflowsWrite: true,
	adminRead: false,
	adminWrite: false,
};

// Branding settings
let brandingLogo: string | null = null;
let primaryColor = "#3B82F6";
let accentColor = "#8B5CF6";
let widgetName = "My Company Chatbot";
let useCustomDomain = false;
let customSubdomain = "";

// Notification settings
let notifications = {
	dailySummary: true,
	agentErrors: true,
	usageLimit: true,
	newTeamMember: false,
	telegramCritical: true,
	telegramDaily: false,
};

// Delete confirmation
let deleteConfirmation = "";

function formatDate(dateStr: string): string {
	const date = new Date(dateStr);
	return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function getRoleColor(role: string): string {
	const colors: Record<string, string> = {
		owner: "gc-accent-amber",
		admin: "gc-accent-blue",
		member: "gc-text-secondary",
	};
	return colors[role] || "gc-text-secondary";
}
</script>

<div class="p-6 space-y-6">
	<!-- Header -->
	<div>
		<h1 class="text-2xl font-bold text-gc-text-primary">Settings</h1>
		<p class="text-gc-text-secondary mt-1">Manage your team, API keys, and preferences</p>
	</div>

	<!-- Tabs -->
	<div class="flex items-center gap-1 bg-gc-bg-surface border border-gc-border-subtle rounded-lg p-1 w-fit">
		<button
			on:click={() => activeTab = 'team'}
			class="px-4 py-2 rounded-md text-sm font-medium transition-colors {activeTab === 'team' ? 'bg-gc-accent-blue text-white' : 'text-gc-text-secondary hover:text-gc-text-primary'}"
		>
			Team
		</button>
		<button
			on:click={() => activeTab = 'api-keys'}
			class="px-4 py-2 rounded-md text-sm font-medium transition-colors {activeTab === 'api-keys' ? 'bg-gc-accent-blue text-white' : 'text-gc-text-secondary hover:text-gc-text-primary'}"
		>
			API Keys
		</button>
		<button
			on:click={() => activeTab = 'branding'}
			class="px-4 py-2 rounded-md text-sm font-medium transition-colors {activeTab === 'branding' ? 'bg-gc-accent-blue text-white' : 'text-gc-text-secondary hover:text-gc-text-primary'}"
		>
			Branding
		</button>
		<button
			on:click={() => activeTab = 'notifications'}
			class="px-4 py-2 rounded-md text-sm font-medium transition-colors {activeTab === 'notifications' ? 'bg-gc-accent-blue text-white' : 'text-gc-text-secondary hover:text-gc-text-primary'}"
		>
			Notifications
		</button>
		<button
			on:click={() => activeTab = 'danger'}
			class="px-4 py-2 rounded-md text-sm font-medium transition-colors {activeTab === 'danger' ? 'bg-gc-accent-rose text-white' : 'text-gc-accent-rose hover:text-gc-accent-rose/80'}"
		>
			Danger
		</button>
	</div>

	{#if activeTab === 'team'}
		<!-- Team Members -->
		<div class="max-w-3xl space-y-6">
			<div class="bg-gc-bg-surface border border-gc-border-subtle rounded-xl overflow-hidden">
				<div class="p-5 border-b border-gc-border-subtle">
					<h3 class="text-lg font-semibold text-gc-text-primary">Team Members</h3>
				</div>
				<div class="divide-y divide-gc-border-subtle">
					{#each teamMembers as member}
						<div class="p-4 flex items-center justify-between">
							<div class="flex items-center gap-4">
								<div class="w-10 h-10 rounded-full bg-gc-accent-blue/20 flex items-center justify-center text-sm font-medium text-gc-accent-blue">
									{member.avatar}
								</div>
								<div>
									<div class="font-medium text-gc-text-primary">{member.name}</div>
									<div class="text-sm text-gc-text-secondary">{member.email}</div>
								</div>
							</div>
							<div class="flex items-center gap-4">
								<span class="text-sm text-{getRoleColor(member.role)} capitalize">{member.role}</span>
								{#if member.role !== 'owner'}
									<div class="flex items-center gap-2">
										<button class="text-sm text-gc-text-secondary hover:text-gc-text-primary">Edit</button>
										<button class="text-sm text-gc-accent-rose hover:text-gc-accent-rose/80">Remove</button>
									</div>
								{/if}
							</div>
						</div>
					{/each}
				</div>
			</div>

			<!-- Invite Form -->
			<div class="bg-gc-bg-surface border border-gc-border-subtle rounded-xl p-5">
				<h3 class="text-lg font-semibold text-gc-text-primary mb-4">Invite Team Member</h3>
				<div class="flex gap-3">
					<input
						type="email"
						placeholder="Email address"
						bind:value={inviteEmail}
						class="flex-1 px-4 py-2 bg-gc-bg-elevated border border-gc-border-subtle rounded-lg text-gc-text-primary placeholder-gc-text-muted focus:outline-none focus:border-gc-border-focus"
					/>
					<select
						bind:value={inviteRole}
						class="px-4 py-2 bg-gc-bg-elevated border border-gc-border-subtle rounded-lg text-gc-text-primary focus:outline-none focus:border-gc-border-focus"
					>
						<option value="admin">Admin</option>
						<option value="member">Member</option>
					</select>
					<button class="px-4 py-2 bg-gc-accent-blue text-white rounded-lg hover:bg-gc-accent-blue/80 transition-colors">
						Send Invitation
					</button>
				</div>
			</div>

			<!-- Pending Invites -->
			{#if pendingInvites.length > 0}
				<div class="bg-gc-bg-surface border border-gc-border-subtle rounded-xl p-5">
					<h3 class="text-sm font-medium text-gc-text-secondary uppercase tracking-wider mb-3">Pending Invitations</h3>
					{#each pendingInvites as invite}
						<div class="flex items-center justify-between py-2">
							<span class="text-gc-text-primary">{invite.email}</span>
							<div class="flex items-center gap-4">
								<span class="text-sm text-gc-text-muted">Sent {formatDate(invite.sentAt)}</span>
								<button class="text-sm text-gc-accent-blue hover:underline">Resend</button>
								<button class="text-sm text-gc-accent-rose hover:underline">Cancel</button>
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</div>

	{:else if activeTab === 'api-keys'}
		<!-- API Keys -->
		<div class="max-w-3xl space-y-6">
			<!-- Existing Keys -->
			{#each apiKeys as key}
				<div class="bg-gc-bg-surface border border-gc-border-subtle rounded-xl p-5">
					<div class="flex items-start justify-between mb-4">
						<div>
							<h3 class="font-semibold text-gc-text-primary">{key.name}</h3>
							<code class="text-sm text-gc-text-secondary font-mono mt-1 block">{key.keyPreview}</code>
						</div>
						<div class="flex gap-2">
							<button class="px-3 py-1.5 bg-gc-bg-elevated text-gc-text-primary rounded-lg hover:bg-gc-border-subtle transition-colors text-sm">
								Copy
							</button>
							<button class="px-3 py-1.5 bg-gc-accent-rose/20 text-gc-accent-rose rounded-lg hover:bg-gc-accent-rose/30 transition-colors text-sm">
								Revoke
							</button>
						</div>
					</div>
					<div class="flex items-center gap-6 text-sm text-gc-text-secondary">
						<span>Created: {formatDate(key.createdAt)}</span>
						<span>Last used: {formatDate(key.lastUsed)}</span>
					</div>
					<div class="mt-3">
						<span class="text-xs text-gc-text-muted uppercase tracking-wider">Scopes:</span>
						<div class="flex flex-wrap gap-2 mt-1">
							{#each key.scopes as scope}
								<span class="px-2 py-1 bg-gc-bg-elevated rounded text-xs text-gc-text-secondary font-mono">{scope}</span>
							{/each}
						</div>
					</div>
				</div>
			{/each}

			<!-- Create New Key -->
			<div class="bg-gc-bg-surface border border-gc-border-subtle rounded-xl p-5">
				<h3 class="text-lg font-semibold text-gc-text-primary mb-4">Create New Key</h3>
				<div class="space-y-4">
					<div>
						<label class="block text-sm text-gc-text-secondary mb-2">Key Name</label>
						<input
							type="text"
							placeholder="e.g., Production API Key"
							bind:value={newKeyName}
							class="w-full px-4 py-2 bg-gc-bg-elevated border border-gc-border-subtle rounded-lg text-gc-text-primary placeholder-gc-text-muted focus:outline-none focus:border-gc-border-focus"
						/>
					</div>
					<div>
						<label class="block text-sm text-gc-text-secondary mb-2">Scopes</label>
						<div class="grid grid-cols-2 gap-2">
							<label class="flex items-center gap-2 text-sm text-gc-text-primary cursor-pointer">
								<input type="checkbox" bind:checked={newKeyScopes.agentsRead} class="w-4 h-4 rounded border-gc-border-subtle" />
								agents.read
							</label>
							<label class="flex items-center gap-2 text-sm text-gc-text-primary cursor-pointer">
								<input type="checkbox" bind:checked={newKeyScopes.agentsWrite} class="w-4 h-4 rounded border-gc-border-subtle" />
								agents.write
							</label>
							<label class="flex items-center gap-2 text-sm text-gc-text-primary cursor-pointer">
								<input type="checkbox" bind:checked={newKeyScopes.conversationsRead} class="w-4 h-4 rounded border-gc-border-subtle" />
								conversations.read
							</label>
							<label class="flex items-center gap-2 text-sm text-gc-text-primary cursor-pointer">
								<input type="checkbox" bind:checked={newKeyScopes.workflowsRead} class="w-4 h-4 rounded border-gc-border-subtle" />
								workflows.read
							</label>
							<label class="flex items-center gap-2 text-sm text-gc-text-primary cursor-pointer">
								<input type="checkbox" bind:checked={newKeyScopes.workflowsWrite} class="w-4 h-4 rounded border-gc-border-subtle" />
								workflows.write
							</label>
							<label class="flex items-center gap-2 text-sm text-gc-text-muted cursor-pointer">
								<input type="checkbox" bind:checked={newKeyScopes.adminRead} class="w-4 h-4 rounded border-gc-border-subtle" />
								admin.read
							</label>
							<label class="flex items-center gap-2 text-sm text-gc-text-muted cursor-pointer">
								<input type="checkbox" bind:checked={newKeyScopes.adminWrite} class="w-4 h-4 rounded border-gc-border-subtle" />
								admin.write
							</label>
						</div>
					</div>
					<button class="px-4 py-2 bg-gc-accent-blue text-white rounded-lg hover:bg-gc-accent-blue/80 transition-colors">
						Create Key
					</button>
				</div>
			</div>
		</div>

	{:else if activeTab === 'branding'}
		<!-- Branding Settings -->
		<div class="max-w-3xl space-y-6">
			<div class="bg-gc-bg-surface border border-gc-border-subtle rounded-xl p-5">
				<h3 class="text-lg font-semibold text-gc-text-primary mb-4">Logo Upload</h3>
				<div class="border-2 border-dashed border-gc-border-subtle rounded-xl p-8 text-center">
					{#if brandingLogo}
						<img src={brandingLogo} alt="Logo" class="max-h-16 mx-auto mb-4" />
					{:else}
						<div class="text-4xl mb-4">📷</div>
					{/if}
					<p class="text-gc-text-secondary mb-2">Click to upload or drag & drop</p>
					<p class="text-sm text-gc-text-muted">PNG, JPG, or SVG (max 2MB)</p>
				</div>
			</div>

			<div class="bg-gc-bg-surface border border-gc-border-subtle rounded-xl p-5">
				<h3 class="text-lg font-semibold text-gc-text-primary mb-4">Widget Color Theme</h3>
				<div class="grid grid-cols-2 gap-4">
					<div>
						<label class="block text-sm text-gc-text-secondary mb-2">Primary Color</label>
						<div class="flex items-center gap-3">
							<input
								type="color"
								bind:value={primaryColor}
								class="w-10 h-10 rounded-lg border border-gc-border-subtle cursor-pointer"
							/>
							<input
								type="text"
								bind:value={primaryColor}
								class="flex-1 px-3 py-2 bg-gc-bg-elevated border border-gc-border-subtle rounded-lg text-gc-text-primary font-mono text-sm focus:outline-none focus:border-gc-border-focus"
							/>
						</div>
					</div>
					<div>
						<label class="block text-sm text-gc-text-secondary mb-2">Accent Color</label>
						<div class="flex items-center gap-3">
							<input
								type="color"
								bind:value={accentColor}
								class="w-10 h-10 rounded-lg border border-gc-border-subtle cursor-pointer"
							/>
							<input
								type="text"
								bind:value={accentColor}
								class="flex-1 px-3 py-2 bg-gc-bg-elevated border border-gc-border-subtle rounded-lg text-gc-text-primary font-mono text-sm focus:outline-none focus:border-gc-border-focus"
							/>
						</div>
					</div>
				</div>
			</div>

			<div class="bg-gc-bg-surface border border-gc-border-subtle rounded-xl p-5">
				<h3 class="text-lg font-semibold text-gc-text-primary mb-4">Widget Display Name</h3>
				<input
					type="text"
					bind:value={widgetName}
					class="w-full px-4 py-2 bg-gc-bg-elevated border border-gc-border-subtle rounded-lg text-gc-text-primary focus:outline-none focus:border-gc-border-focus"
				/>
			</div>

			<div class="bg-gc-bg-surface border border-gc-border-subtle rounded-xl p-5">
				<h3 class="text-lg font-semibold text-gc-text-primary mb-4">Custom Domain</h3>
				<p class="text-sm text-gc-text-muted mb-4">Available on Enterprise plan only</p>
				<label class="flex items-center gap-3 cursor-pointer mb-4">
					<input
						type="checkbox"
						bind:checked={useCustomDomain}
						disabled
						class="w-4 h-4 rounded border-gc-border-subtle"
					/>
					<span class="text-gc-text-secondary">Use custom domain</span>
				</label>
				<div class="flex items-center gap-2">
					<input
						type="text"
						placeholder="your-company"
						bind:value={customSubdomain}
						disabled
						class="flex-1 px-4 py-2 bg-gc-bg-elevated border border-gc-border-subtle rounded-lg text-gc-text-muted focus:outline-none"
					/>
					<span class="text-gc-text-muted">.global-claw.com</span>
				</div>
			</div>

			<button class="px-4 py-2 bg-gc-accent-blue text-white rounded-lg hover:bg-gc-accent-blue/80 transition-colors">
				Save Changes
			</button>
		</div>

	{:else if activeTab === 'notifications'}
		<!-- Notification Settings -->
		<div class="max-w-3xl space-y-6">
			<div class="bg-gc-bg-surface border border-gc-border-subtle rounded-xl p-5">
				<h3 class="text-lg font-semibold text-gc-text-primary mb-4">Email Notifications</h3>
				<div class="space-y-3">
					<label class="flex items-center justify-between cursor-pointer">
						<span class="text-gc-text-primary">Daily summary report</span>
						<input type="checkbox" bind:checked={notifications.dailySummary} class="w-5 h-5 rounded border-gc-border-subtle" />
					</label>
					<label class="flex items-center justify-between cursor-pointer">
						<span class="text-gc-text-primary">Agent errors & downtime</span>
						<input type="checkbox" bind:checked={notifications.agentErrors} class="w-5 h-5 rounded border-gc-border-subtle" />
					</label>
					<label class="flex items-center justify-between cursor-pointer">
						<span class="text-gc-text-primary">Usage approaching limit</span>
						<input type="checkbox" bind:checked={notifications.usageLimit} class="w-5 h-5 rounded border-gc-border-subtle" />
					</label>
					<label class="flex items-center justify-between cursor-pointer">
						<span class="text-gc-text-primary">New team member joined</span>
						<input type="checkbox" bind:checked={notifications.newTeamMember} class="w-5 h-5 rounded border-gc-border-subtle" />
					</label>
				</div>
			</div>

			<div class="bg-gc-bg-surface border border-gc-border-subtle rounded-xl p-5">
				<h3 class="text-lg font-semibold text-gc-text-primary mb-4">Telegram Notifications</h3>
				<div class="space-y-3">
					<label class="flex items-center justify-between cursor-pointer">
						<span class="text-gc-text-primary">Critical alerts only</span>
						<input type="checkbox" bind:checked={notifications.telegramCritical} class="w-5 h-5 rounded border-gc-border-subtle" />
					</label>
					<label class="flex items-center justify-between cursor-pointer">
						<span class="text-gc-text-primary">Daily metrics</span>
						<input type="checkbox" bind:checked={notifications.telegramDaily} class="w-5 h-5 rounded border-gc-border-subtle" />
					</label>
				</div>
			</div>

			<button class="px-4 py-2 bg-gc-accent-blue text-white rounded-lg hover:bg-gc-accent-blue/80 transition-colors">
				Save Changes
			</button>
		</div>

	{:else if activeTab === 'danger'}
		<!-- Danger Zone -->
		<div class="max-w-3xl space-y-6">
			<div class="bg-gc-bg-surface border border-gc-accent-rose/30 rounded-xl p-6">
				<h3 class="text-lg font-semibold text-gc-accent-rose mb-2">Delete This Tenant</h3>
				<p class="text-gc-text-secondary mb-4">
					This action cannot be undone. All agents, conversations, and data will be permanently deleted.
				</p>
				<div class="mb-4">
					<label class="block text-sm text-gc-text-secondary mb-2">
						Type <span class="font-mono text-gc-text-primary">DELETE</span> to confirm
					</label>
					<input
						type="text"
						bind:value={deleteConfirmation}
						placeholder="DELETE"
						class="w-full px-4 py-2 bg-gc-bg-elevated border border-gc-border-subtle rounded-lg text-gc-text-primary placeholder-gc-text-muted focus:outline-none focus:border-gc-accent-rose"
					/>
				</div>
				<button
					disabled={deleteConfirmation !== 'DELETE'}
					class="px-4 py-2 bg-gc-accent-rose text-white rounded-lg hover:bg-gc-accent-rose/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
				>
					Delete Tenant
				</button>
			</div>

			<div class="bg-gc-bg-surface border border-gc-border-subtle rounded-xl p-6">
				<h3 class="text-lg font-semibold text-gc-text-primary mb-2">Export All Data</h3>
				<p class="text-gc-text-secondary mb-4">
					Download a JSON export of all tenant data, conversations, and memory.
				</p>
				<button class="px-4 py-2 bg-gc-bg-elevated text-gc-text-primary rounded-lg hover:bg-gc-border-subtle transition-colors">
					Export as JSON
				</button>
			</div>
		</div>
	{/if}
</div>
