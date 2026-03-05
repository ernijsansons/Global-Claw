<script lang="ts">
import "../app.css";
import { auth } from "$lib/stores";
import { onMount } from "svelte";

// Main navigation items
const mainNavItems = [
	{ path: "/", label: "Overview", icon: "📊" },
	{ path: "/agents", label: "Agents", icon: "🤖" },
	{ path: "/workflows", label: "Workflows", icon: "⚡" },
	{ path: "/memory", label: "Memory", icon: "🧠" },
	{ path: "/integrations", label: "Integrations", icon: "🔌" },
	{ path: "/llm-providers", label: "LLM Providers", icon: "🎛️" },
	{ path: "/conversations", label: "Conversations", icon: "💬" },
	{ path: "/analytics", label: "Analytics", icon: "📈" },
];

// Admin navigation items
const adminNavItems = [
	{ path: "/tenants", label: "Tenants", icon: "🏢" },
	{ path: "/partners", label: "Partners", icon: "🤝" },
	{ path: "/billing", label: "Billing", icon: "💳" },
	{ path: "/settings", label: "Settings", icon: "⚙️" },
];

// Combined for header title lookup
const _allNavItems = [...mainNavItems, ...adminNavItems];

const _sidebarExpanded = true;

onMount(() => {
	auth.init();
});
</script>

<div class="flex min-h-screen bg-gc-bg-root">
	<!-- Sidebar -->
	<aside
		class="fixed left-0 top-0 h-full z-40 transition-all duration-300"
		class:w-64={sidebarExpanded}
		class:w-16={!sidebarExpanded}
	>
		<div class="h-full bg-gc-bg-surface border-r border-gc-border-subtle flex flex-col">
			<!-- Logo -->
			<div class="h-16 flex items-center px-4 border-b border-gc-border-subtle">
				<div class="flex items-center gap-3">
					<div class="w-8 h-8 rounded-lg bg-gc-accent-blue flex items-center justify-center">
						<span class="text-white font-bold">GC</span>
					</div>
					{#if sidebarExpanded}
						<span class="font-bold text-gc-text-primary">Global Claw</span>
					{/if}
				</div>
			</div>

			<!-- Navigation -->
			<nav class="flex-1 p-4 space-y-1 overflow-y-auto">
				{#each mainNavItems as item}
					<a
						href={item.path}
						class="gc-nav-item"
						class:active={$page.url.pathname === item.path}
					>
						<span class="text-xl">{item.icon}</span>
						{#if sidebarExpanded}
							<span>{item.label}</span>
						{/if}
					</a>
				{/each}

				<!-- Divider -->
				<div class="my-3 border-t border-gc-border-subtle"></div>

				{#each adminNavItems as item}
					<a
						href={item.path}
						class="gc-nav-item"
						class:active={$page.url.pathname === item.path}
					>
						<span class="text-xl">{item.icon}</span>
						{#if sidebarExpanded}
							<span>{item.label}</span>
						{/if}
					</a>
				{/each}
			</nav>

			<!-- Toggle & User -->
			<div class="p-4 border-t border-gc-border-subtle">
				<button
					on:click={() => (sidebarExpanded = !sidebarExpanded)}
					class="gc-btn-secondary w-full justify-center"
				>
					{sidebarExpanded ? "←" : "→"}
				</button>

				{#if $isAuthenticated && $currentUser}
					<div class="mt-4 flex items-center gap-3">
						<div
							class="w-8 h-8 rounded-full bg-gc-accent-violet flex items-center justify-center"
						>
							<span class="text-white text-sm">
								{$currentUser.email?.charAt(0).toUpperCase() ?? "U"}
							</span>
						</div>
						{#if sidebarExpanded}
							<div class="flex-1 min-w-0">
								<p class="text-sm text-gc-text-primary truncate">
									{$currentUser.email}
								</p>
								<p class="text-xs text-gc-text-secondary">{$currentUser.role}</p>
							</div>
						{/if}
					</div>
				{/if}
			</div>
		</div>
	</aside>

	<!-- Main Content -->
	<main
		class="flex-1 transition-all duration-300"
		class:ml-64={sidebarExpanded}
		class:ml-16={!sidebarExpanded}
	>
		<!-- Header -->
		<header class="h-16 bg-gc-bg-surface border-b border-gc-border-subtle px-6 flex items-center">
			<div class="flex-1">
				<h1 class="text-xl font-bold text-gc-text-primary">
					{allNavItems.find((item) => item.path === $page.url.pathname)?.label ?? "Dashboard"}
				</h1>
			</div>

			<div class="flex items-center gap-4">
				<!-- Language Selector -->
				<select class="gc-input w-20 py-1.5 text-sm">
					<option value="en">EN</option>
					<option value="lv">LV</option>
					<option value="ru">RU</option>
				</select>

				<!-- Notifications -->
				<button class="relative p-2 rounded-lg hover:bg-gc-bg-elevated">
					<span class="text-xl">🔔</span>
					<span
						class="absolute top-1 right-1 w-2 h-2 rounded-full bg-gc-accent-rose"
					/>
				</button>
			</div>
		</header>

		<!-- Page Content -->
		<div class="p-6">
			<slot />
		</div>
	</main>
</div>
