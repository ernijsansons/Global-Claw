<script lang="ts">
import { api } from "$lib/api";
import { tenantId } from "$lib/stores";
import { onMount } from "svelte";

// Demo workflows
const demoWorkflows = [
	{
		id: "1",
		name: "Onboarding Flow",
		status: "running" as const,
		nodes: 8,
		last_run: "2 min ago",
		runs_today: 23,
		success_rate: 98.5,
		created_at: "2026-01-20T10:00:00Z",
	},
	{
		id: "2",
		name: "Support Triage",
		status: "running" as const,
		nodes: 5,
		last_run: "5 min ago",
		runs_today: 47,
		success_rate: 99.2,
		created_at: "2026-02-05T14:30:00Z",
	},
	{
		id: "3",
		name: "Data Sync",
		status: "paused" as const,
		nodes: 12,
		last_run: "1 hour ago",
		runs_today: 6,
		success_rate: 95.0,
		created_at: "2026-02-15T09:15:00Z",
	},
	{
		id: "4",
		name: "Lead Qualification",
		status: "running" as const,
		nodes: 6,
		last_run: "12 min ago",
		runs_today: 15,
		success_rate: 97.8,
		created_at: "2026-03-01T16:45:00Z",
	},
];

// Demo workflow nodes for visual editor
const demoNodes = [
	{ id: "start", type: "trigger", label: "Start", x: 100, y: 200 },
	{ id: "route", type: "condition", label: "Route by Language", x: 300, y: 200 },
	{ id: "lv", type: "action", label: "LV Handler", x: 500, y: 100 },
	{ id: "en", type: "action", label: "EN Handler", x: 500, y: 200 },
	{ id: "ru", type: "action", label: "RU Handler", x: 500, y: 300 },
	{ id: "respond", type: "action", label: "Send Response", x: 700, y: 200 },
];

const demoEdges = [
	{ from: "start", to: "route" },
	{ from: "route", to: "lv" },
	{ from: "route", to: "en" },
	{ from: "route", to: "ru" },
	{ from: "lv", to: "respond" },
	{ from: "en", to: "respond" },
	{ from: "ru", to: "respond" },
];

type Workflow = (typeof demoWorkflows)[0];
let workflows: Workflow[] = demoWorkflows;
let loading = true;
let selectedWorkflow: Workflow | null = demoWorkflows[0];
let inspectorNode: (typeof demoNodes)[0] | null = null;

onMount(async () => {
	if ($tenantId) {
		try {
			const response = await api.getWorkflows($tenantId);
			if (response.success && response.data) {
				workflows = response.data as Workflow[];
			}
		} catch {
			// Use demo data
		}
	}
	loading = false;
});

function getStatusClass(status: string) {
	switch (status) {
		case "running":
			return "gc-status-online";
		case "paused":
			return "gc-status-idle";
		default:
			return "gc-status-error";
	}
}

function getNodeTypeColor(type: string) {
	switch (type) {
		case "trigger":
			return "bg-gc-accent-emerald";
		case "condition":
			return "bg-gc-accent-amber";
		case "action":
			return "bg-gc-accent-blue";
		default:
			return "bg-gc-accent-violet";
	}
}
</script>

<svelte:head>
	<title>Workflows | Global Claw</title>
</svelte:head>

<div class="flex h-[calc(100vh-theme(spacing.16)-theme(spacing.12))]">
	<!-- Workflow List Sidebar -->
	<div class="w-56 flex-shrink-0 border-r border-gc-border-subtle pr-4 space-y-3 overflow-auto">
		<div class="flex items-center justify-between mb-4">
			<h3 class="text-sm font-medium text-gc-text-secondary">Workflows</h3>
			<button class="text-gc-accent-blue text-sm">+ New</button>
		</div>

		{#each workflows as workflow}
			<button
				class="w-full text-left p-3 rounded-lg transition-colors"
				class:bg-gc-bg-elevated={selectedWorkflow?.id === workflow.id}
				class:hover:bg-gc-bg-elevated={selectedWorkflow?.id !== workflow.id}
				on:click={() => (selectedWorkflow = workflow)}
			>
				<div class="flex items-center gap-2 mb-1">
					<span class={getStatusClass(workflow.status)} />
					<span class="text-sm font-medium truncate">{workflow.name}</span>
				</div>
				<p class="text-xs text-gc-text-secondary">{workflow.nodes} nodes · {workflow.last_run}</p>
			</button>
		{/each}
	</div>

	<!-- Visual Canvas -->
	<div class="flex-1 flex flex-col">
		<!-- Canvas Header -->
		{#if selectedWorkflow}
			<div class="flex items-center justify-between px-4 py-3 border-b border-gc-border-subtle">
				<div class="flex items-center gap-3">
					<span class={getStatusClass(selectedWorkflow.status)} />
					<h2 class="font-semibold">{selectedWorkflow.name}</h2>
					<span class="text-xs px-2 py-1 rounded bg-gc-bg-surface text-gc-text-secondary">
						{selectedWorkflow.status}
					</span>
				</div>
				<div class="flex items-center gap-2">
					<button class="gc-btn-secondary text-sm">
						{selectedWorkflow.status === "running" ? "Pause" : "Resume"}
					</button>
					<button class="gc-btn-primary text-sm">Run Now</button>
				</div>
			</div>
		{/if}

		<!-- Canvas Area -->
		<div class="flex-1 relative bg-gc-bg-root overflow-hidden">
			<!-- Grid Background -->
			<div
				class="absolute inset-0 opacity-10"
				style="background-image: radial-gradient(circle, #4A4A6A 1px, transparent 1px); background-size: 24px 24px;"
			/>

			<!-- Edges (SVG) -->
			<svg class="absolute inset-0 w-full h-full pointer-events-none">
				{#each demoEdges as edge}
					{@const fromNode = demoNodes.find((n) => n.id === edge.from)}
					{@const toNode = demoNodes.find((n) => n.id === edge.to)}
					{#if fromNode && toNode}
						<path
							d="M {fromNode.x + 80} {fromNode.y + 20}
                 C {fromNode.x + 140} {fromNode.y + 20},
                   {toNode.x - 60} {toNode.y + 20},
                   {toNode.x} {toNode.y + 20}"
							fill="none"
							stroke="#3B82F6"
							stroke-width="2"
							stroke-opacity="0.5"
						/>
						<!-- Arrowhead -->
						<polygon
							points="{toNode.x - 8},{toNode.y + 16} {toNode.x},{toNode.y + 20} {toNode.x - 8},{toNode.y + 24}"
							fill="#3B82F6"
							fill-opacity="0.5"
						/>
					{/if}
				{/each}
			</svg>

			<!-- Nodes -->
			{#each demoNodes as node}
				<button
					class="absolute w-40 p-3 bg-gc-bg-surface border border-gc-border-subtle rounded-lg shadow-lg cursor-pointer transition-all hover:border-gc-accent-blue"
					class:ring-2={inspectorNode?.id === node.id}
					class:ring-gc-accent-blue={inspectorNode?.id === node.id}
					style="left: {node.x}px; top: {node.y}px;"
					on:click={() => (inspectorNode = node)}
				>
					<div class="flex items-center gap-2 mb-1">
						<span class="w-3 h-3 rounded-full {getNodeTypeColor(node.type)}" />
						<span class="text-sm font-medium truncate">{node.label}</span>
					</div>
					<p class="text-xs text-gc-text-secondary capitalize">{node.type}</p>
				</button>
			{/each}

			<!-- Minimap -->
			<div class="absolute bottom-4 right-4 w-32 h-24 bg-gc-bg-surface border border-gc-border-subtle rounded-lg p-2">
				<div class="relative w-full h-full">
					{#each demoNodes as node}
						<div
							class="absolute w-2 h-2 rounded-sm {getNodeTypeColor(node.type)}"
							style="left: {(node.x / 800) * 100}%; top: {(node.y / 400) * 100}%;"
						/>
					{/each}
				</div>
			</div>
		</div>

		<!-- Node Inspector -->
		{#if inspectorNode}
			<div class="h-48 border-t border-gc-border-subtle bg-gc-bg-surface p-4">
				<div class="flex items-center justify-between mb-4">
					<div class="flex items-center gap-2">
						<span class="w-3 h-3 rounded-full {getNodeTypeColor(inspectorNode.type)}" />
						<h3 class="font-semibold">{inspectorNode.label}</h3>
						<span class="text-xs px-2 py-1 rounded bg-gc-bg-elevated text-gc-text-secondary capitalize">
							{inspectorNode.type}
						</span>
					</div>
					<button
						class="p-1 rounded hover:bg-gc-bg-elevated"
						on:click={() => (inspectorNode = null)}
					>
						✕
					</button>
				</div>

				<div class="grid grid-cols-3 gap-4">
					<div>
						<label class="block text-sm text-gc-text-secondary mb-1">Node Name</label>
						<input type="text" class="gc-input w-full" value={inspectorNode.label} />
					</div>
					<div>
						<label class="block text-sm text-gc-text-secondary mb-1">Type</label>
						<select class="gc-input w-full">
							<option selected={inspectorNode.type === "trigger"}>Trigger</option>
							<option selected={inspectorNode.type === "condition"}>Condition</option>
							<option selected={inspectorNode.type === "action"}>Action</option>
							<option selected={inspectorNode.type === "llm"}>LLM Call</option>
						</select>
					</div>
					<div>
						<label class="block text-sm text-gc-text-secondary mb-1">Timeout (ms)</label>
						<input type="number" class="gc-input w-full" value="30000" />
					</div>
				</div>
			</div>
		{/if}
	</div>

	<!-- Workflow Stats Sidebar -->
	{#if selectedWorkflow}
		<div class="w-56 flex-shrink-0 border-l border-gc-border-subtle pl-4 space-y-4 overflow-auto">
			<h3 class="text-sm font-medium text-gc-text-secondary">Statistics</h3>

			<div class="space-y-3">
				<div class="p-3 bg-gc-bg-elevated rounded-lg">
					<p class="text-2xl font-bold">{selectedWorkflow.runs_today}</p>
					<p class="text-xs text-gc-text-secondary">Runs Today</p>
				</div>
				<div class="p-3 bg-gc-bg-elevated rounded-lg">
					<p class="text-2xl font-bold">{selectedWorkflow.success_rate}%</p>
					<p class="text-xs text-gc-text-secondary">Success Rate</p>
				</div>
				<div class="p-3 bg-gc-bg-elevated rounded-lg">
					<p class="text-2xl font-bold">1.8s</p>
					<p class="text-xs text-gc-text-secondary">Avg Duration</p>
				</div>
			</div>

			<div class="pt-4 border-t border-gc-border-subtle">
				<h3 class="text-sm font-medium text-gc-text-secondary mb-3">Recent Runs</h3>
				<div class="space-y-2">
					{#each [1, 2, 3, 4, 5] as run}
						<div class="flex items-center justify-between text-sm">
							<div class="flex items-center gap-2">
								<span class="gc-status-online" />
								<span class="text-gc-text-secondary">Run #{847 - run + 1}</span>
							</div>
							<span class="text-xs text-gc-text-muted">{run * 2}m ago</span>
						</div>
					{/each}
				</div>
			</div>

			<button class="w-full gc-btn-secondary text-sm">View All Runs</button>
		</div>
	{/if}
</div>
