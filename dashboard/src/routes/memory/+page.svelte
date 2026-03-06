<script lang="ts">
import { onMount } from "svelte";

// View modes
type ViewMode = "timeline" | "graph" | "table";
let viewMode: ViewMode = "timeline";

// Search and filters
let searchQuery = "";
let selectedAgent = "all";
let selectedType = "all";

// Memory stats
const stats = {
	conversations: { count: 12847, sessions: 1247 },
	facts: { count: 342, agents: 12 },
	vectors: { count: 8901 },
};

// Sample memory entries
const memoryEntries = [
	{
		id: "1",
		type: "conversation",
		content: 'Customer "TechCo" asked about pricing for enterprise plan',
		agent: "Sales-LV",
		confidence: 0.94,
		timestamp: "2026-03-04T14:23:00Z",
		usageCount: 3,
	},
	{
		id: "2",
		type: "fact",
		content: "TechCo budget is €50K/year for AI tools",
		agent: "Sales-LV",
		confidence: 0.89,
		timestamp: "2026-03-03T10:15:00Z",
		source: "conversation #892",
		usageCount: 12,
	},
	{
		id: "3",
		type: "faq",
		content: "How to reset password → Navigate to Settings > Security > Reset Password",
		agent: "Support-EN",
		confidence: 0.97,
		timestamp: "2026-03-03T09:00:00Z",
		usageCount: 47,
	},
	{
		id: "4",
		type: "entity",
		content: "Contact: John Smith (john@techco.com) - CTO at TechCo",
		agent: "Sales-LV",
		confidence: 0.92,
		timestamp: "2026-03-02T16:45:00Z",
		usageCount: 8,
	},
	{
		id: "5",
		type: "conversation",
		content: "User requested demo of workflow automation features",
		agent: "Sales-EN",
		confidence: 0.88,
		timestamp: "2026-03-02T11:30:00Z",
		usageCount: 1,
	},
];

// Graph nodes for visualization
const graphNodes = [
	{ id: "techco", label: "TechCo", type: "entity", x: 200, y: 150, size: 40 },
	{ id: "john", label: "John Smith", type: "person", x: 350, y: 100, size: 30 },
	{ id: "budget", label: "€50K Budget", type: "fact", x: 150, y: 280, size: 25 },
	{ id: "pricing", label: "Enterprise Pricing", type: "topic", x: 320, y: 250, size: 35 },
	{ id: "demo", label: "Demo Request", type: "event", x: 450, y: 180, size: 28 },
	{ id: "workflow", label: "Workflow Automation", type: "topic", x: 500, y: 300, size: 32 },
];

const graphEdges = [
	{ from: "techco", to: "john", label: "CTO" },
	{ from: "techco", to: "budget", label: "has" },
	{ from: "techco", to: "pricing", label: "interested in" },
	{ from: "john", to: "demo", label: "requested" },
	{ from: "demo", to: "workflow", label: "about" },
	{ from: "pricing", to: "workflow", label: "includes" },
];

// Agents for filter
const agents = ["Sales-LV", "Sales-EN", "Support-EN", "Support-RU", "Data-Collector"];
const memoryTypes = ["conversation", "fact", "faq", "entity"];

// Selected memory for detail view
let selectedMemory: (typeof memoryEntries)[0] | null = null;

function formatDate(dateStr: string): string {
	const date = new Date(dateStr);
	return date.toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function getTypeColor(type: string): string {
	const colors: Record<string, string> = {
		conversation: "gc-accent-blue",
		fact: "gc-accent-emerald",
		faq: "gc-accent-violet",
		entity: "gc-accent-amber",
		event: "gc-accent-cyan",
		topic: "gc-text-secondary",
		person: "gc-accent-rose",
	};
	return colors[type] || "gc-text-secondary";
}

function getTypeIcon(type: string): string {
	const icons: Record<string, string> = {
		conversation: "💬",
		fact: "📌",
		faq: "❓",
		entity: "🏢",
		event: "📅",
		topic: "🏷️",
		person: "👤",
	};
	return icons[type] || "📝";
}

function filteredEntries() {
	return memoryEntries.filter((entry) => {
		const matchesSearch = searchQuery === "" || entry.content.toLowerCase().includes(searchQuery.toLowerCase());
		const matchesAgent = selectedAgent === "all" || entry.agent === selectedAgent;
		const matchesType = selectedType === "all" || entry.type === selectedType;
		return matchesSearch && matchesAgent && matchesType;
	});
}

// Graph interaction
let hoveredNode: string | null = null;
</script>

<div class="p-6 space-y-6">
	<!-- Header -->
	<div class="flex items-center justify-between">
		<div>
			<h1 class="text-2xl font-bold text-gc-text-primary">Memory</h1>
			<p class="text-gc-text-secondary mt-1">Knowledge base and context across all agents</p>
		</div>
		<div class="flex items-center gap-3">
			<button class="px-4 py-2 bg-gc-bg-elevated text-gc-text-primary rounded-lg hover:bg-gc-border-subtle transition-colors">
				Export
			</button>
			<button class="px-4 py-2 bg-gc-accent-blue text-white rounded-lg hover:bg-gc-accent-blue/80 transition-colors">
				+ Add Memory
			</button>
		</div>
	</div>

	<!-- Stats Cards -->
	<div class="grid grid-cols-3 gap-4">
		<div class="bg-gc-bg-surface border border-gc-border-subtle rounded-xl p-5">
			<div class="flex items-center gap-3">
				<div class="w-10 h-10 bg-gc-accent-blue/20 rounded-lg flex items-center justify-center">
					<span class="text-xl">💬</span>
				</div>
				<div>
					<div class="text-2xl font-bold text-gc-text-primary">{stats.conversations.count.toLocaleString()}</div>
					<div class="text-sm text-gc-text-secondary">messages across {stats.conversations.sessions.toLocaleString()} sessions</div>
				</div>
			</div>
		</div>
		<div class="bg-gc-bg-surface border border-gc-border-subtle rounded-xl p-5">
			<div class="flex items-center gap-3">
				<div class="w-10 h-10 bg-gc-accent-emerald/20 rounded-lg flex items-center justify-center">
					<span class="text-xl">📌</span>
				</div>
				<div>
					<div class="text-2xl font-bold text-gc-text-primary">{stats.facts.count}</div>
					<div class="text-sm text-gc-text-secondary">facts across {stats.facts.agents} agents</div>
				</div>
			</div>
		</div>
		<div class="bg-gc-bg-surface border border-gc-border-subtle rounded-xl p-5">
			<div class="flex items-center gap-3">
				<div class="w-10 h-10 bg-gc-accent-violet/20 rounded-lg flex items-center justify-center">
					<span class="text-xl">🔮</span>
				</div>
				<div>
					<div class="text-2xl font-bold text-gc-text-primary">{stats.vectors.count.toLocaleString()}</div>
					<div class="text-sm text-gc-text-secondary">vector chunks indexed</div>
				</div>
			</div>
		</div>
	</div>

	<!-- Search and Filters -->
	<div class="flex items-center gap-4">
		<div class="flex-1 relative">
			<input
				type="text"
				placeholder="Search across all memory..."
				bind:value={searchQuery}
				class="w-full px-4 py-3 pl-10 bg-gc-bg-surface border border-gc-border-subtle rounded-lg text-gc-text-primary placeholder-gc-text-muted focus:outline-none focus:border-gc-border-focus"
			/>
			<span class="absolute left-3 top-1/2 -translate-y-1/2 text-gc-text-muted">🔍</span>
		</div>
		<select
			bind:value={selectedAgent}
			class="px-4 py-3 bg-gc-bg-surface border border-gc-border-subtle rounded-lg text-gc-text-primary focus:outline-none focus:border-gc-border-focus"
		>
			<option value="all">All Agents</option>
			{#each agents as agent}
				<option value={agent}>{agent}</option>
			{/each}
		</select>
		<select
			bind:value={selectedType}
			class="px-4 py-3 bg-gc-bg-surface border border-gc-border-subtle rounded-lg text-gc-text-primary focus:outline-none focus:border-gc-border-focus"
		>
			<option value="all">All Types</option>
			{#each memoryTypes as type}
				<option value={type}>{type.charAt(0).toUpperCase() + type.slice(1)}</option>
			{/each}
		</select>
	</div>

	<!-- View Mode Tabs -->
	<div class="flex items-center gap-1 bg-gc-bg-surface border border-gc-border-subtle rounded-lg p-1 w-fit">
		<button
			on:click={() => viewMode = 'timeline'}
			class="px-4 py-2 rounded-md text-sm font-medium transition-colors {viewMode === 'timeline' ? 'bg-gc-accent-blue text-white' : 'text-gc-text-secondary hover:text-gc-text-primary'}"
		>
			Timeline View
		</button>
		<button
			on:click={() => viewMode = 'graph'}
			class="px-4 py-2 rounded-md text-sm font-medium transition-colors {viewMode === 'graph' ? 'bg-gc-accent-blue text-white' : 'text-gc-text-secondary hover:text-gc-text-primary'}"
		>
			Graph View
		</button>
		<button
			on:click={() => viewMode = 'table'}
			class="px-4 py-2 rounded-md text-sm font-medium transition-colors {viewMode === 'table' ? 'bg-gc-accent-blue text-white' : 'text-gc-text-secondary hover:text-gc-text-primary'}"
		>
			Table View
		</button>
	</div>

	<!-- Content Area -->
	<div class="flex gap-6">
		<!-- Main Content -->
		<div class="flex-1">
			{#if viewMode === 'timeline'}
				<!-- Timeline View -->
				<div class="space-y-4">
					{#each filteredEntries() as entry}
						<button
							on:click={() => selectedMemory = entry}
							class="w-full text-left bg-gc-bg-surface border border-gc-border-subtle rounded-xl p-4 hover:border-gc-border-focus transition-colors {selectedMemory?.id === entry.id ? 'border-gc-accent-blue' : ''}"
						>
							<div class="flex items-start gap-3">
								<div class="w-8 h-8 bg-gc-bg-elevated rounded-lg flex items-center justify-center text-lg">
									{getTypeIcon(entry.type)}
								</div>
								<div class="flex-1 min-w-0">
									<div class="flex items-center gap-2 mb-1">
										<span class="text-xs px-2 py-0.5 rounded-full bg-gc-bg-elevated text-{getTypeColor(entry.type)}">{entry.type}</span>
										<span class="text-xs text-gc-text-muted">{formatDate(entry.timestamp)}</span>
									</div>
									<p class="text-gc-text-primary">{entry.content}</p>
									<div class="flex items-center gap-4 mt-2 text-xs text-gc-text-secondary">
										<span>Agent: {entry.agent}</span>
										<span>Confidence: {(entry.confidence * 100).toFixed(0)}%</span>
										<span>Used {entry.usageCount}x</span>
									</div>
								</div>
							</div>
						</button>
					{/each}
				</div>

			{:else if viewMode === 'graph'}
				<!-- Graph View -->
				<div class="bg-gc-bg-surface border border-gc-border-subtle rounded-xl p-4" style="height: 500px;">
					<svg width="100%" height="100%" viewBox="0 0 600 400">
						<!-- Edges -->
						{#each graphEdges as edge}
							{@const fromNode = graphNodes.find(n => n.id === edge.from)}
							{@const toNode = graphNodes.find(n => n.id === edge.to)}
							{#if fromNode && toNode}
								<line
									x1={fromNode.x}
									y1={fromNode.y}
									x2={toNode.x}
									y2={toNode.y}
									stroke="#1F1F2E"
									stroke-width="2"
									class="transition-all duration-300"
									style="opacity: {hoveredNode === null || hoveredNode === edge.from || hoveredNode === edge.to ? 1 : 0.2}"
								/>
								<text
									x={(fromNode.x + toNode.x) / 2}
									y={(fromNode.y + toNode.y) / 2 - 5}
									fill="#8B8BA3"
									font-size="10"
									text-anchor="middle"
									style="opacity: {hoveredNode === edge.from || hoveredNode === edge.to ? 1 : 0.5}"
								>
									{edge.label}
								</text>
							{/if}
						{/each}

						<!-- Nodes -->
						{#each graphNodes as node}
							<g
								on:mouseenter={() => hoveredNode = node.id}
								on:mouseleave={() => hoveredNode = null}
								class="cursor-pointer transition-all duration-300"
								style="opacity: {hoveredNode === null || hoveredNode === node.id || graphEdges.some(e => (e.from === hoveredNode && e.to === node.id) || (e.to === hoveredNode && e.from === node.id)) ? 1 : 0.3}"
							>
								<circle
									cx={node.x}
									cy={node.y}
									r={node.size / 2}
									fill="#12121A"
									stroke={hoveredNode === node.id ? '#3B82F6' : '#1F1F2E'}
									stroke-width="2"
								/>
								<text
									x={node.x}
									y={node.y + 4}
									fill="#F0F0F5"
									font-size="11"
									text-anchor="middle"
									font-weight="500"
								>
									{node.label.length > 10 ? node.label.slice(0, 10) + '...' : node.label}
								</text>
								<text
									x={node.x}
									y={node.y + node.size / 2 + 15}
									fill="#8B8BA3"
									font-size="9"
									text-anchor="middle"
								>
									{node.type}
								</text>
							</g>
						{/each}
					</svg>
					<div class="mt-4 flex items-center gap-4 text-xs text-gc-text-secondary">
						<span class="flex items-center gap-1"><span class="w-3 h-3 rounded-full bg-gc-accent-blue"></span> Entity</span>
						<span class="flex items-center gap-1"><span class="w-3 h-3 rounded-full bg-gc-accent-emerald"></span> Fact</span>
						<span class="flex items-center gap-1"><span class="w-3 h-3 rounded-full bg-gc-accent-violet"></span> Topic</span>
						<span class="flex items-center gap-1"><span class="w-3 h-3 rounded-full bg-gc-accent-amber"></span> Event</span>
						<span class="flex items-center gap-1"><span class="w-3 h-3 rounded-full bg-gc-accent-rose"></span> Person</span>
					</div>
				</div>

			{:else if viewMode === 'table'}
				<!-- Table View -->
				<div class="bg-gc-bg-surface border border-gc-border-subtle rounded-xl overflow-hidden">
					<table class="w-full">
						<thead>
							<tr class="border-b border-gc-border-subtle">
								<th class="px-4 py-3 text-left text-xs font-medium text-gc-text-secondary uppercase tracking-wider">Type</th>
								<th class="px-4 py-3 text-left text-xs font-medium text-gc-text-secondary uppercase tracking-wider">Content</th>
								<th class="px-4 py-3 text-left text-xs font-medium text-gc-text-secondary uppercase tracking-wider">Agent</th>
								<th class="px-4 py-3 text-left text-xs font-medium text-gc-text-secondary uppercase tracking-wider">Confidence</th>
								<th class="px-4 py-3 text-left text-xs font-medium text-gc-text-secondary uppercase tracking-wider">Usage</th>
								<th class="px-4 py-3 text-left text-xs font-medium text-gc-text-secondary uppercase tracking-wider">Date</th>
								<th class="px-4 py-3 text-left text-xs font-medium text-gc-text-secondary uppercase tracking-wider">Actions</th>
							</tr>
						</thead>
						<tbody>
							{#each filteredEntries() as entry}
								<tr
									class="border-b border-gc-border-subtle hover:bg-gc-bg-elevated transition-colors cursor-pointer"
									on:click={() => selectedMemory = entry}
								>
									<td class="px-4 py-3">
										<span class="flex items-center gap-2">
											<span>{getTypeIcon(entry.type)}</span>
											<span class="text-sm text-gc-text-primary capitalize">{entry.type}</span>
										</span>
									</td>
									<td class="px-4 py-3">
										<span class="text-sm text-gc-text-primary line-clamp-1">{entry.content}</span>
									</td>
									<td class="px-4 py-3">
										<span class="text-sm text-gc-text-secondary">{entry.agent}</span>
									</td>
									<td class="px-4 py-3">
										<div class="flex items-center gap-2">
											<div class="w-16 h-1.5 bg-gc-bg-elevated rounded-full overflow-hidden">
												<div
													class="h-full bg-gc-accent-emerald rounded-full"
													style="width: {entry.confidence * 100}%"
												></div>
											</div>
											<span class="text-xs text-gc-text-secondary">{(entry.confidence * 100).toFixed(0)}%</span>
										</div>
									</td>
									<td class="px-4 py-3">
										<span class="text-sm text-gc-text-secondary">{entry.usageCount}x</span>
									</td>
									<td class="px-4 py-3">
										<span class="text-sm text-gc-text-muted">{formatDate(entry.timestamp)}</span>
									</td>
									<td class="px-4 py-3">
										<div class="flex items-center gap-2">
											<button class="text-gc-text-secondary hover:text-gc-text-primary">Edit</button>
											<button class="text-gc-accent-rose hover:text-gc-accent-rose/80">Delete</button>
										</div>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{/if}
		</div>

		<!-- Detail Panel -->
		{#if selectedMemory}
			<div class="w-80 bg-gc-bg-surface border border-gc-border-subtle rounded-xl p-5 h-fit">
				<div class="flex items-center justify-between mb-4">
					<h3 class="text-lg font-semibold text-gc-text-primary">Memory Detail</h3>
					<button
						on:click={() => selectedMemory = null}
						class="text-gc-text-muted hover:text-gc-text-primary"
					>
						✕
					</button>
				</div>

				<div class="space-y-4">
					<div>
						<label class="text-xs text-gc-text-muted uppercase tracking-wider">Type</label>
						<div class="flex items-center gap-2 mt-1">
							<span class="text-lg">{getTypeIcon(selectedMemory.type)}</span>
							<span class="text-gc-text-primary capitalize">{selectedMemory.type}</span>
						</div>
					</div>

					<div>
						<label class="text-xs text-gc-text-muted uppercase tracking-wider">Content</label>
						<p class="text-gc-text-primary mt-1">{selectedMemory.content}</p>
					</div>

					<div class="grid grid-cols-2 gap-4">
						<div>
							<label class="text-xs text-gc-text-muted uppercase tracking-wider">Agent</label>
							<p class="text-gc-text-primary mt-1">{selectedMemory.agent}</p>
						</div>
						<div>
							<label class="text-xs text-gc-text-muted uppercase tracking-wider">Confidence</label>
							<p class="text-gc-text-primary mt-1">{(selectedMemory.confidence * 100).toFixed(0)}%</p>
						</div>
					</div>

					<div class="grid grid-cols-2 gap-4">
						<div>
							<label class="text-xs text-gc-text-muted uppercase tracking-wider">Usage Count</label>
							<p class="text-gc-text-primary mt-1">{selectedMemory.usageCount} times</p>
						</div>
						<div>
							<label class="text-xs text-gc-text-muted uppercase tracking-wider">Created</label>
							<p class="text-gc-text-primary mt-1">{formatDate(selectedMemory.timestamp)}</p>
						</div>
					</div>

					<div class="pt-4 border-t border-gc-border-subtle flex gap-2">
						<button class="flex-1 px-3 py-2 bg-gc-bg-elevated text-gc-text-primary rounded-lg hover:bg-gc-border-subtle transition-colors text-sm">
							View Context
						</button>
						<button class="flex-1 px-3 py-2 bg-gc-bg-elevated text-gc-text-primary rounded-lg hover:bg-gc-border-subtle transition-colors text-sm">
							Edit
						</button>
						<button class="px-3 py-2 bg-gc-accent-rose/20 text-gc-accent-rose rounded-lg hover:bg-gc-accent-rose/30 transition-colors text-sm">
							Delete
						</button>
					</div>
				</div>
			</div>
		{/if}
	</div>
</div>

<style>
	.line-clamp-1 {
		display: -webkit-box;
		-webkit-line-clamp: 1;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}
</style>
