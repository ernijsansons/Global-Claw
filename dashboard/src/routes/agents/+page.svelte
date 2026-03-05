<script lang="ts">
	import { onMount } from "svelte";
	import { api } from "$lib/api";
	import { tenantId } from "$lib/stores";

	// Demo data for when not authenticated
	const demoAgents = [
		{
			id: "1",
			name: "Sales Assistant LV",
			status: "online" as const,
			llm_provider_slug: "anthropic",
			llm_model: "claude-sonnet-4",
			total_messages: 2847,
			messages_today: 247,
			languages: ["LV", "RU"],
			created_at: "2026-01-15T10:00:00Z",
		},
		{
			id: "2",
			name: "Support Bot EN",
			status: "online" as const,
			llm_provider_slug: "qwen",
			llm_model: "qwen-2.5-72b",
			total_messages: 1523,
			messages_today: 89,
			languages: ["EN"],
			created_at: "2026-02-01T14:30:00Z",
		},
		{
			id: "3",
			name: "Data Analyst",
			status: "idle" as const,
			llm_provider_slug: "openai",
			llm_model: "gpt-4o",
			total_messages: 456,
			messages_today: 0,
			languages: ["EN", "DE"],
			created_at: "2026-02-20T09:15:00Z",
		},
		{
			id: "4",
			name: "Lead Qualifier",
			status: "error" as const,
			llm_provider_slug: "anthropic",
			llm_model: "claude-haiku-4",
			total_messages: 892,
			messages_today: 0,
			languages: ["LV", "RU", "EN"],
			created_at: "2026-03-01T16:45:00Z",
		},
	];

	type Agent = (typeof demoAgents)[0];
	let agents: Agent[] = demoAgents;
	let loading = true;
	let error: string | null = null;
	let selectedAgent: Agent | null = null;
	let searchQuery = "";
	let statusFilter = "all";

	onMount(async () => {
		if ($tenantId) {
			try {
				const response = await api.getAgents($tenantId);
				if (response.success && response.data) {
					agents = response.data as Agent[];
				}
			} catch {
				error = "Failed to load agents";
			}
		}
		loading = false;
	});

	function getStatusClass(status: string) {
		switch (status) {
			case "online":
				return "gc-status-online";
			case "idle":
				return "gc-status-idle";
			default:
				return "gc-status-error";
		}
	}

	function getStatusLabel(status: string) {
		switch (status) {
			case "online":
				return "Online";
			case "idle":
				return "Sleeping";
			default:
				return "Error";
		}
	}

	function formatDate(dateStr: string) {
		return new Date(dateStr).toLocaleDateString("en-US", {
			month: "short",
			day: "numeric",
			year: "numeric",
		});
	}

	$: filteredAgents = agents.filter((agent) => {
		const matchesSearch = agent.name.toLowerCase().includes(searchQuery.toLowerCase());
		const matchesStatus = statusFilter === "all" || agent.status === statusFilter;
		return matchesSearch && matchesStatus;
	});
</script>

<svelte:head>
	<title>Agents | Global Claw</title>
</svelte:head>

<div class="flex h-[calc(100vh-theme(spacing.16)-theme(spacing.12))]">
	<!-- Agent List -->
	<div class="space-y-4 overflow-auto pr-4 {selectedAgent ? 'w-1/2' : 'flex-1'}">
		<!-- Search and Filters -->
		<div class="flex items-center gap-4">
			<div class="flex-1">
				<input
					type="text"
					placeholder="Search agents..."
					class="gc-input w-full"
					bind:value={searchQuery}
				/>
			</div>
			<select class="gc-input w-32" bind:value={statusFilter}>
				<option value="all">All</option>
				<option value="online">Online</option>
				<option value="idle">Idle</option>
				<option value="error">Error</option>
			</select>
			<button class="gc-btn-primary">+ New Agent</button>
		</div>

		<!-- Agent Cards -->
		<div class="space-y-3">
			{#each filteredAgents as agent}
				<button
					class="w-full text-left gc-card p-4 hover:bg-gc-bg-elevated transition-colors cursor-pointer"
					class:ring-2={selectedAgent?.id === agent.id}
					class:ring-gc-accent-blue={selectedAgent?.id === agent.id}
					on:click={() => (selectedAgent = agent)}
				>
					<div class="flex items-center justify-between">
						<div class="flex items-center gap-3">
							<span class={getStatusClass(agent.status)} />
							<div>
								<h3 class="font-medium text-gc-text-primary">{agent.name}</h3>
								<p class="text-sm text-gc-text-secondary">
									{agent.llm_model} · {agent.messages_today} msgs today · {agent.languages.join("/")}
								</p>
							</div>
						</div>
						<div class="flex items-center gap-2">
							<span
								class="text-xs px-2 py-1 rounded bg-gc-bg-surface text-gc-text-secondary"
							>
								{getStatusLabel(agent.status)}
							</span>
							<span class="text-gc-text-muted">▸</span>
						</div>
					</div>
				</button>
			{/each}

			{#if filteredAgents.length === 0}
				<div class="gc-card p-8 text-center">
					<p class="text-gc-text-secondary">No agents found</p>
				</div>
			{/if}
		</div>
	</div>

	<!-- Agent Detail Panel -->
	{#if selectedAgent}
		<div
			class="w-1/2 gc-card ml-4 overflow-auto animate-in slide-in-from-right duration-300"
		>
			<div class="p-6 border-b border-gc-border-subtle">
				<div class="flex items-center justify-between">
					<div class="flex items-center gap-3">
						<span class={getStatusClass(selectedAgent.status)} />
						<h2 class="text-xl font-bold">{selectedAgent.name}</h2>
					</div>
					<div class="flex items-center gap-2">
						<button class="gc-btn-secondary text-sm">Edit</button>
						<button
							class="p-2 rounded-lg hover:bg-gc-bg-elevated"
							on:click={() => (selectedAgent = null)}
						>
							✕
						</button>
					</div>
				</div>
			</div>

			<div class="p-6 space-y-6">
				<!-- Identity Section -->
				<div>
					<h3 class="text-sm font-medium text-gc-text-secondary mb-3">Identity</h3>
					<div class="space-y-3">
						<div class="p-3 bg-gc-bg-elevated rounded-lg">
							<div class="flex items-center justify-between mb-2">
								<span class="text-sm font-medium">SOUL.md</span>
								<button class="text-xs text-gc-accent-blue">Edit</button>
							</div>
							<p class="text-sm text-gc-text-secondary">
								Agent personality and behavior configuration
							</p>
						</div>
						<div class="p-3 bg-gc-bg-elevated rounded-lg">
							<div class="flex items-center justify-between mb-2">
								<span class="text-sm font-medium">AGENTS.md</span>
								<button class="text-xs text-gc-accent-blue">Edit</button>
							</div>
							<p class="text-sm text-gc-text-secondary">
								Multi-agent coordination rules
							</p>
						</div>
					</div>
				</div>

				<!-- Model Config Section -->
				<div>
					<h3 class="text-sm font-medium text-gc-text-secondary mb-3">Model Config</h3>
					<div class="space-y-3">
						<div>
							<label class="block text-sm text-gc-text-secondary mb-1">Primary Model</label>
							<select class="gc-input w-full">
								<option selected={selectedAgent.llm_model === "claude-sonnet-4"}>
									claude-sonnet-4
								</option>
								<option selected={selectedAgent.llm_model === "claude-haiku-4"}>
									claude-haiku-4
								</option>
								<option selected={selectedAgent.llm_model === "qwen-2.5-72b"}>
									qwen-2.5-72b
								</option>
								<option selected={selectedAgent.llm_model === "gpt-4o"}>gpt-4o</option>
							</select>
						</div>
						<div>
							<label class="block text-sm text-gc-text-secondary mb-1">Fallback Model</label>
							<select class="gc-input w-full">
								<option>qwen-2.5-72b</option>
								<option>claude-haiku-4</option>
								<option>gpt-4o-mini</option>
							</select>
						</div>
						<div>
							<label class="block text-sm text-gc-text-secondary mb-1">
								Temperature: 0.7
							</label>
							<input type="range" min="0" max="1" step="0.1" value="0.7" class="w-full" />
						</div>
						<div>
							<label class="block text-sm text-gc-text-secondary mb-1">
								Max Tokens: 4096
							</label>
							<input
								type="range"
								min="256"
								max="8192"
								step="256"
								value="4096"
								class="w-full"
							/>
						</div>
					</div>
				</div>

				<!-- Tools & Integrations Section -->
				<div>
					<h3 class="text-sm font-medium text-gc-text-secondary mb-3">
						Tools & Integrations
					</h3>
					<div class="grid grid-cols-2 gap-2">
						<label class="flex items-center gap-2 p-2 bg-gc-bg-elevated rounded-lg cursor-pointer">
							<input type="checkbox" checked class="rounded" />
							<span class="text-sm">Google Calendar</span>
						</label>
						<label class="flex items-center gap-2 p-2 bg-gc-bg-elevated rounded-lg cursor-pointer">
							<input type="checkbox" checked class="rounded" />
							<span class="text-sm">Notion</span>
						</label>
						<label class="flex items-center gap-2 p-2 bg-gc-bg-elevated rounded-lg cursor-pointer">
							<input type="checkbox" class="rounded" />
							<span class="text-sm">Stripe</span>
						</label>
						<label class="flex items-center gap-2 p-2 bg-gc-bg-elevated rounded-lg cursor-pointer">
							<input type="checkbox" class="rounded" />
							<span class="text-sm">GitHub</span>
						</label>
					</div>
					<button class="mt-3 text-sm text-gc-accent-blue">+ Add Integration</button>
				</div>

				<!-- Memory Section -->
				<div>
					<h3 class="text-sm font-medium text-gc-text-secondary mb-3">Memory</h3>
					<div class="p-4 bg-gc-bg-elevated rounded-lg space-y-2">
						<div class="flex justify-between text-sm">
							<span class="text-gc-text-secondary">Conversations</span>
							<span class="text-gc-text-primary">{selectedAgent.total_messages.toLocaleString()} stored</span>
						</div>
						<div class="flex justify-between text-sm">
							<span class="text-gc-text-secondary">Long-term facts</span>
							<span class="text-gc-text-primary">89 entries</span>
						</div>
						<div class="flex justify-between text-sm">
							<span class="text-gc-text-secondary">Vector embeddings</span>
							<span class="text-gc-text-primary">3,402</span>
						</div>
						<button class="mt-2 text-sm text-gc-accent-blue">View Memory →</button>
					</div>
				</div>

				<!-- Stats Section -->
				<div>
					<h3 class="text-sm font-medium text-gc-text-secondary mb-3">Statistics</h3>
					<div class="grid grid-cols-2 gap-3">
						<div class="p-3 bg-gc-bg-elevated rounded-lg">
							<p class="text-2xl font-bold">{selectedAgent.total_messages.toLocaleString()}</p>
							<p class="text-xs text-gc-text-secondary">Total Messages</p>
						</div>
						<div class="p-3 bg-gc-bg-elevated rounded-lg">
							<p class="text-2xl font-bold">{selectedAgent.messages_today}</p>
							<p class="text-xs text-gc-text-secondary">Messages Today</p>
						</div>
						<div class="p-3 bg-gc-bg-elevated rounded-lg">
							<p class="text-2xl font-bold">1.2s</p>
							<p class="text-xs text-gc-text-secondary">Avg Response</p>
						</div>
						<div class="p-3 bg-gc-bg-elevated rounded-lg">
							<p class="text-2xl font-bold">2.3%</p>
							<p class="text-xs text-gc-text-secondary">Escape Rate</p>
						</div>
					</div>
				</div>

				<!-- Created At -->
				<div class="pt-4 border-t border-gc-border-subtle">
					<p class="text-sm text-gc-text-secondary">
						Created {formatDate(selectedAgent.created_at)}
					</p>
				</div>
			</div>
		</div>
	{/if}
</div>
