<script lang="ts">
	import { onMount } from "svelte";
	import { api } from "$lib/api";

	// Demo providers
	const demoProviders = [
		{
			id: "1",
			slug: "anthropic",
			name: "Anthropic Claude",
			is_enabled: true,
			models: ["claude-sonnet-4", "claude-haiku-4", "claude-opus-4"],
			pricing: { input: 3, output: 15 },
			usage_pct: 67,
			cost_usd: 82.91,
			latency_ms: 1200,
			health_pct: 99.9,
		},
		{
			id: "2",
			slug: "qwen",
			name: "Alibaba Qwen",
			is_enabled: true,
			models: ["qwen-2.5-72b", "qwen-2.5-7b"],
			pricing: { input: 0.27, output: 1.1 },
			usage_pct: 28,
			cost_usd: 35.83,
			latency_ms: 800,
			health_pct: 99.2,
		},
		{
			id: "3",
			slug: "openai",
			name: "OpenAI",
			is_enabled: false,
			models: ["gpt-4o", "gpt-4o-mini"],
			pricing: { input: 5, output: 15 },
			usage_pct: 5,
			cost_usd: 9.1,
			latency_ms: 1500,
			health_pct: 98.5,
		},
	];

	const demoRoutingRules = [
		{
			id: "1",
			condition: 'task = "complex reasoning"',
			routes: [
				{ model: "claude-sonnet-4", weight: 80 },
				{ model: "qwen-2.5-72b", weight: 20 },
			],
		},
		{
			id: "2",
			condition: 'task = "simple chat"',
			routes: [
				{ model: "qwen-2.5-7b", weight: 90 },
				{ model: "claude-haiku-4", weight: 10 },
			],
		},
	];

	const demoCostData = {
		today: 23.4,
		month: 487.2,
		budget: 600,
		trend: [12, 18, 22, 28, 35, 42, 38, 32, 28, 24, 20, 18, 15, 12, 14, 16, 20, 25, 30, 28, 24, 22, 20, 18, 16, 20, 24, 28, 26, 23],
	};

	type Provider = (typeof demoProviders)[0];
	type RawProvider = {
		id: string;
		slug: string;
		name: string;
		is_enabled: boolean;
		models_json?: string;
		pricing_json?: string;
	};

	let providers: Provider[] = demoProviders;
	let loading = true;
	let editingProvider: Provider | null = null;

	function parseModels(value: string | undefined, fallback: string[]): string[] {
		if (!value) return fallback;
		try {
			const parsed = JSON.parse(value) as unknown;
			if (Array.isArray(parsed)) {
				return parsed.filter((item): item is string => typeof item === "string");
			}
		} catch {
			// Keep fallback when JSON parsing fails.
		}
		return fallback;
	}

	function parsePricing(value: string | undefined, fallback: Provider["pricing"]): Provider["pricing"] {
		if (!value) return fallback;
		try {
			const parsed = JSON.parse(value) as { input?: unknown; output?: unknown };
			const input = typeof parsed.input === "number" ? parsed.input : fallback.input;
			const output = typeof parsed.output === "number" ? parsed.output : fallback.output;
			return { input, output };
		} catch {
			// Keep fallback when JSON parsing fails.
		}
		return fallback;
	}

	onMount(async () => {
		try {
			const response = await api.getProviders();
			if (response.success && response.data) {
				// Merge API data with demo defaults and safe fallbacks for new/unknown slugs.
				providers = (response.data as RawProvider[]).map((p) => {
					const demo = demoProviders.find((d) => d.slug === p.slug);
					const defaultPricing = demo?.pricing ?? { input: 0, output: 0 };

					return {
						id: p.id,
						slug: p.slug,
						name: p.name || demo?.name || p.slug,
						is_enabled: p.is_enabled,
						models: parseModels(p.models_json, demo?.models ?? []),
						pricing: parsePricing(p.pricing_json, defaultPricing),
						usage_pct: demo?.usage_pct ?? 0,
						cost_usd: demo?.cost_usd ?? 0,
						latency_ms: demo?.latency_ms ?? 0,
						health_pct: demo?.health_pct ?? 100,
					};
				});
			}
		} catch {
			// Use demo data
		}
		loading = false;
	});

	async function toggleProvider(provider: Provider) {
		try {
			await api.updateProvider(provider.id, { is_enabled: !provider.is_enabled });
			providers = providers.map((p) =>
				p.id === provider.id ? { ...p, is_enabled: !p.is_enabled } : p
			);
		} catch {
			// Handle error
		}
	}
</script>

<svelte:head>
	<title>LLM Providers | Global Claw</title>
</svelte:head>

<div class="space-y-6">
	<!-- Header -->
	<div class="flex items-center justify-between">
		<div>
			<h2 class="text-xl font-bold">LLM Provider Router</h2>
			<p class="text-sm text-gc-text-secondary">
				Provider-agnostic routing with automatic failover
			</p>
		</div>
		<button class="gc-btn-primary">+ Add Provider</button>
	</div>

	<!-- Provider Cards -->
	<div class="space-y-4">
		<h3 class="text-sm font-medium text-gc-text-secondary">Active Providers</h3>

		{#each providers as provider}
			<div
				class="gc-card p-4"
				class:opacity-50={!provider.is_enabled}
			>
				<div class="flex items-start justify-between">
					<div class="flex items-center gap-3">
						<span
							class="w-3 h-3 rounded-full"
							class:bg-gc-accent-emerald={provider.is_enabled}
							class:bg-gc-text-muted={!provider.is_enabled}
						/>
						<div>
							<h4 class="font-semibold">{provider.name}</h4>
							<p class="text-sm text-gc-text-secondary">
								Models: {provider.models.join(", ")}
							</p>
						</div>
					</div>
					<div class="flex items-center gap-2">
						<button
							class="gc-btn-secondary text-sm"
							on:click={() => (editingProvider = provider)}
						>
							Configure
						</button>
						<button
							class="text-sm px-3 py-1.5 rounded-lg transition-colors"
							class:bg-gc-accent-emerald={provider.is_enabled}
							class:text-white={provider.is_enabled}
							class:bg-gc-bg-elevated={!provider.is_enabled}
							class:text-gc-text-secondary={!provider.is_enabled}
							on:click={() => toggleProvider(provider)}
						>
							{provider.is_enabled ? "Enabled" : "Disabled"}
						</button>
					</div>
				</div>

				{#if provider.is_enabled}
					<div class="mt-4 grid grid-cols-4 gap-4">
						<div>
							<p class="text-sm text-gc-text-secondary">Cost (Input/Output)</p>
							<p class="font-medium">
								${provider.pricing.input}/${provider.pricing.output} per 1M tokens
							</p>
						</div>
						<div>
							<p class="text-sm text-gc-text-secondary">Traffic Share</p>
							<div class="flex items-center gap-2">
								<div class="flex-1 h-2 bg-gc-bg-elevated rounded-full overflow-hidden">
									<div
										class="h-full bg-gc-accent-blue rounded-full"
										style="width: {provider.usage_pct}%"
									/>
								</div>
								<span class="text-sm font-medium">{provider.usage_pct}%</span>
							</div>
						</div>
						<div>
							<p class="text-sm text-gc-text-secondary">Avg Latency</p>
							<p class="font-medium">{(provider.latency_ms / 1000).toFixed(1)}s</p>
						</div>
						<div>
							<p class="text-sm text-gc-text-secondary">Health</p>
							<div class="flex items-center gap-2">
								<span class="gc-status-online" />
								<span class="font-medium">{provider.health_pct}%</span>
							</div>
						</div>
					</div>
				{/if}
			</div>
		{/each}
	</div>

	<!-- Routing Rules -->
	<div class="gc-card p-4">
		<div class="flex items-center justify-between mb-4">
			<h3 class="font-semibold">Routing Rules</h3>
			<div class="flex items-center gap-2">
				<span class="text-sm text-gc-text-secondary">Default strategy:</span>
				<select class="gc-input text-sm py-1">
					<option>Cost-optimized</option>
					<option>Latency-optimized</option>
					<option>Quality-optimized</option>
					<option>Round-robin</option>
				</select>
			</div>
		</div>

		<div class="space-y-3">
			{#each demoRoutingRules as rule}
				<div class="p-3 bg-gc-bg-elevated rounded-lg">
					<div class="flex items-center gap-2 mb-2">
						<span class="text-sm font-medium text-gc-accent-amber">IF</span>
						<code class="text-sm bg-gc-bg-surface px-2 py-1 rounded">
							{rule.condition}
						</code>
					</div>
					<div class="pl-6 space-y-1">
						{#each rule.routes as route}
							<div class="flex items-center gap-2 text-sm">
								<span class="text-gc-accent-blue">→</span>
								<span>{route.model}</span>
								<span class="text-gc-text-secondary">(weight: {route.weight}%)</span>
							</div>
						{/each}
					</div>
				</div>
			{/each}
		</div>

		<div class="mt-4 flex gap-2">
			<button class="gc-btn-secondary text-sm">+ Add Rule</button>
			<button class="gc-btn-secondary text-sm">Edit Rules</button>
		</div>
	</div>

	<!-- Cost Dashboard -->
	<div class="gc-card p-4">
		<h3 class="font-semibold mb-4">Cost Dashboard</h3>

		<div class="grid grid-cols-3 gap-4 mb-6">
			<div class="p-4 bg-gc-bg-elevated rounded-lg">
				<p class="text-3xl font-bold">${demoCostData.today.toFixed(2)}</p>
				<p class="text-sm text-gc-text-secondary">Today</p>
			</div>
			<div class="p-4 bg-gc-bg-elevated rounded-lg">
				<p class="text-3xl font-bold">${demoCostData.month.toFixed(2)}</p>
				<p class="text-sm text-gc-text-secondary">This Month</p>
			</div>
			<div class="p-4 bg-gc-bg-elevated rounded-lg">
				<div class="flex items-center justify-between mb-2">
					<p class="text-sm text-gc-text-secondary">Budget</p>
					<p class="text-sm font-medium">${demoCostData.budget}</p>
				</div>
				<div class="h-2 bg-gc-bg-surface rounded-full overflow-hidden">
					<div
						class="h-full bg-gc-accent-blue rounded-full"
						style="width: {(demoCostData.month / demoCostData.budget) * 100}%"
					/>
				</div>
				<p class="text-xs text-gc-text-secondary mt-1">
					${(demoCostData.budget - demoCostData.month).toFixed(2)} remaining
				</p>
			</div>
		</div>

		<!-- Cost Trend Chart -->
		<div>
			<p class="text-sm text-gc-text-secondary mb-2">30-Day Cost Trend</p>
			<div class="flex items-end gap-1 h-24">
				{#each demoCostData.trend as value}
					<div
						class="flex-1 bg-gc-accent-blue rounded-t"
						style="height: {(value / Math.max(...demoCostData.trend)) * 100}%"
					/>
				{/each}
			</div>
		</div>

		<!-- Provider Cost Breakdown -->
		<div class="mt-6 pt-6 border-t border-gc-border-subtle">
			<p class="text-sm text-gc-text-secondary mb-3">Cost by Provider (This Month)</p>
			<div class="space-y-2">
				{#each providers.filter((p) => p.is_enabled) as provider}
					<div class="flex items-center gap-3">
						<span class="w-24 text-sm truncate">{provider.name.split(" ")[0]}</span>
						<div class="flex-1 h-4 bg-gc-bg-elevated rounded-full overflow-hidden">
							<div
								class="h-full bg-gc-accent-blue rounded-full"
								style="width: {provider.usage_pct}%"
							/>
						</div>
						<span class="w-20 text-sm text-right font-medium">
							${provider.cost_usd.toFixed(2)}
						</span>
						<span class="w-12 text-xs text-gc-text-secondary text-right">
							{provider.usage_pct}%
						</span>
					</div>
				{/each}
			</div>
		</div>
	</div>
</div>

<!-- Provider Config Modal -->
{#if editingProvider}
	<div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
		<div class="bg-gc-bg-surface rounded-xl w-full max-w-lg p-6">
			<div class="flex items-center justify-between mb-6">
				<h3 class="text-lg font-semibold">Configure {editingProvider.name}</h3>
				<button
					class="p-1 rounded hover:bg-gc-bg-elevated"
					on:click={() => (editingProvider = null)}
				>
					✕
				</button>
			</div>

			<div class="space-y-4">
				<div>
					<label class="block text-sm text-gc-text-secondary mb-1">API Key</label>
					<input
						type="password"
						class="gc-input w-full"
						placeholder="sk-••••••••••••••••••••"
					/>
				</div>

				<div>
					<label class="block text-sm text-gc-text-secondary mb-1">Base URL (Optional)</label>
					<input
						type="text"
						class="gc-input w-full"
						placeholder="https://api.anthropic.com"
					/>
				</div>

				<div>
					<label class="block text-sm text-gc-text-secondary mb-1">Enabled Models</label>
					<div class="grid grid-cols-2 gap-2">
						{#each editingProvider.models as model}
							<label class="flex items-center gap-2 p-2 bg-gc-bg-elevated rounded-lg cursor-pointer">
								<input type="checkbox" checked class="rounded" />
								<span class="text-sm">{model}</span>
							</label>
						{/each}
					</div>
				</div>

				<div>
					<label class="block text-sm text-gc-text-secondary mb-1">Rate Limit (req/min)</label>
					<input type="number" class="gc-input w-full" value="60" />
				</div>

				<div>
					<label class="block text-sm text-gc-text-secondary mb-1">Timeout (ms)</label>
					<input type="number" class="gc-input w-full" value="30000" />
				</div>
			</div>

			<div class="mt-6 flex justify-end gap-3">
				<button class="gc-btn-secondary" on:click={() => (editingProvider = null)}>
					Cancel
				</button>
				<button class="gc-btn-primary" on:click={() => (editingProvider = null)}>
					Save Changes
				</button>
			</div>
		</div>
	</div>
{/if}
