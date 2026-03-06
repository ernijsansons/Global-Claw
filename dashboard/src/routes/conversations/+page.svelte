<script lang="ts">
	// Filters
	let searchQuery = '';
	let selectedAgent = 'all';
	let selectedStatus = 'all';
	let selectedPeriod = '7d';

	// Sample conversations
	const conversations = [
		{
			id: '1',
			user: {
				name: 'Sarah Mitchell',
				avatar: 'SM',
				telegramId: '@sarah_m'
			},
			agent: 'Sales-LV',
			status: 'open',
			lastMessage: 'Quick demo of the workflow automation features',
			timestamp: '2026-03-05T10:23:00Z',
			messageCount: 12,
			language: 'EN'
		},
		{
			id: '2',
			user: {
				name: 'John Decker',
				avatar: 'JD',
				telegramId: '@johnd'
			},
			agent: 'Support-EN',
			status: 'closed',
			lastMessage: 'Thanks for the help!',
			timestamp: '2026-03-05T09:45:00Z',
			messageCount: 8,
			language: 'EN'
		},
		{
			id: '3',
			user: {
				name: 'Emma Laurent',
				avatar: 'EL',
				telegramId: '@emma_l'
			},
			agent: 'Support-RU',
			status: 'escalated',
			lastMessage: 'Does it work with my current setup?',
			timestamp: '2026-03-05T09:10:00Z',
			messageCount: 15,
			language: 'RU'
		},
		{
			id: '4',
			user: {
				name: 'Aleksejs Berzins',
				avatar: 'AB',
				telegramId: '@aleksejs'
			},
			agent: 'Sales-LV',
			status: 'open',
			lastMessage: 'Cik tas maksā uzņēmuma plānam?',
			timestamp: '2026-03-05T08:30:00Z',
			messageCount: 6,
			language: 'LV'
		},
		{
			id: '5',
			user: {
				name: 'Maria Petrova',
				avatar: 'MP',
				telegramId: '@maria_p'
			},
			agent: 'Support-RU',
			status: 'closed',
			lastMessage: 'Спасибо за помощь!',
			timestamp: '2026-03-04T16:20:00Z',
			messageCount: 23,
			language: 'RU'
		}
	];

	// Selected conversation
	let selectedConversation: typeof conversations[0] | null = conversations[0];

	type ConversationMessage =
		| {
				id: string;
				sender: 'user';
				content: string;
				timestamp: string;
		  }
		| {
				id: string;
				sender: 'agent';
				content: string;
				timestamp: string;
				model: string;
				quality: number;
				latency: number;
				tokens: number;
		  };

	// Messages for the selected conversation
	const messages: ConversationMessage[] = [
		{
			id: '1',
			sender: 'user',
			content: 'Hi, can you explain the pricing model?',
			timestamp: '2026-03-05T10:23:00Z'
		},
		{
			id: '2',
			sender: 'agent',
			content: 'Of course! We offer three main plans: Starter at $29/month, Pro at $79/month, and Business at $149/month. Each plan includes different levels of agent capacity and token budgets. Would you like me to explain the features of each plan?',
			timestamp: '2026-03-05T10:24:00Z',
			model: 'claude-sonnet-4',
			quality: 0.92,
			latency: 1.2,
			tokens: 342
		},
		{
			id: '3',
			sender: 'user',
			content: 'Got it. Can I get a trial account?',
			timestamp: '2026-03-05T10:25:00Z'
		},
		{
			id: '4',
			sender: 'agent',
			content: 'Absolutely! I can set up a 14-day free trial for you right now. You\'ll get access to all Pro features so you can fully explore the platform. Would you like me to proceed with that?',
			timestamp: '2026-03-05T10:26:00Z',
			model: 'claude-sonnet-4',
			quality: 0.88,
			latency: 0.9,
			tokens: 287
		},
		{
			id: '5',
			sender: 'user',
			content: 'Yes please! Also, can you show me how the workflow automation works?',
			timestamp: '2026-03-05T10:28:00Z'
		},
		{
			id: '6',
			sender: 'agent',
			content: 'Great! I\'ve started setting up your trial account. As for workflow automation, our visual editor lets you create complex automation flows using drag-and-drop. You can define triggers (like incoming messages or scheduled times), add conditions to route messages based on content or user data, and execute actions like sending responses, updating CRM records, or calling external APIs. Would you like me to walk you through a specific use case?',
			timestamp: '2026-03-05T10:29:00Z',
			model: 'claude-sonnet-4',
			quality: 0.94,
			latency: 1.4,
			tokens: 412
		}
	];

	// Agents for filter
	const agents = ['Sales-LV', 'Sales-EN', 'Support-EN', 'Support-RU'];
	const statusOptions = ['all', 'open', 'closed', 'escalated'];
	const periodOptions = [
		{ value: '24h', label: 'Last 24 hours' },
		{ value: '7d', label: 'Last 7 days' },
		{ value: '30d', label: 'Last 30 days' },
		{ value: 'all', label: 'All time' }
	];

	function formatTime(dateStr: string): string {
		const date = new Date(dateStr);
		return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
	}

	function formatRelativeTime(dateStr: string): string {
		const date = new Date(dateStr);
		const now = new Date();
		const diffMs = now.getTime() - date.getTime();
		const diffMins = Math.floor(diffMs / 60000);
		if (diffMins < 60) return `${diffMins}m ago`;
		const diffHours = Math.floor(diffMins / 60);
		if (diffHours < 24) return `${diffHours}h ago`;
		const diffDays = Math.floor(diffHours / 24);
		return `${diffDays}d ago`;
	}

	function getStatusColor(status: string): string {
		const colors: Record<string, string> = {
			open: 'gc-accent-emerald',
			closed: 'gc-text-muted',
			escalated: 'gc-accent-amber'
		};
		return colors[status] || 'gc-text-secondary';
	}

	function getStatusLabel(status: string): string {
		return status.charAt(0).toUpperCase() + status.slice(1);
	}

	function filteredConversations() {
		return conversations.filter(conv => {
			const matchesSearch = searchQuery === '' ||
				conv.user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
				conv.lastMessage.toLowerCase().includes(searchQuery.toLowerCase());
			const matchesAgent = selectedAgent === 'all' || conv.agent === selectedAgent;
			const matchesStatus = selectedStatus === 'all' || conv.status === selectedStatus;
			return matchesSearch && matchesAgent && matchesStatus;
		});
	}
</script>

<div class="flex h-[calc(100vh-4rem)]">
	<!-- Conversation List -->
	<div class="w-[380px] border-r border-gc-border-subtle flex flex-col">
		<!-- Search and Filters -->
		<div class="p-4 border-b border-gc-border-subtle space-y-3">
			<div class="relative">
				<input
					type="text"
					placeholder="Search conversations..."
					bind:value={searchQuery}
					class="w-full px-4 py-2 pl-9 bg-gc-bg-surface border border-gc-border-subtle rounded-lg text-gc-text-primary placeholder-gc-text-muted focus:outline-none focus:border-gc-border-focus text-sm"
				/>
				<span class="absolute left-3 top-1/2 -translate-y-1/2 text-gc-text-muted text-sm">🔍</span>
			</div>
			<div class="flex gap-2">
				<select
					bind:value={selectedAgent}
					class="flex-1 px-3 py-2 bg-gc-bg-surface border border-gc-border-subtle rounded-lg text-gc-text-primary text-sm focus:outline-none focus:border-gc-border-focus"
				>
					<option value="all">All Agents</option>
					{#each agents as agent}
						<option value={agent}>{agent}</option>
					{/each}
				</select>
				<select
					bind:value={selectedStatus}
					class="flex-1 px-3 py-2 bg-gc-bg-surface border border-gc-border-subtle rounded-lg text-gc-text-primary text-sm focus:outline-none focus:border-gc-border-focus"
				>
					<option value="all">All Status</option>
					{#each statusOptions.slice(1) as status}
						<option value={status}>{getStatusLabel(status)}</option>
					{/each}
				</select>
				<select
					bind:value={selectedPeriod}
					class="flex-1 px-3 py-2 bg-gc-bg-surface border border-gc-border-subtle rounded-lg text-gc-text-primary text-sm focus:outline-none focus:border-gc-border-focus"
				>
					{#each periodOptions as period}
						<option value={period.value}>{period.label}</option>
					{/each}
				</select>
			</div>
		</div>

		<!-- Conversation List -->
		<div class="flex-1 overflow-y-auto">
			{#each filteredConversations() as conversation}
				<button
					on:click={() => selectedConversation = conversation}
					class="w-full text-left p-4 border-b border-gc-border-subtle hover:bg-gc-bg-elevated transition-colors {selectedConversation?.id === conversation.id ? 'bg-gc-bg-elevated' : ''}"
				>
					<div class="flex items-start gap-3">
						<div class="w-10 h-10 rounded-full bg-gc-accent-blue/20 flex items-center justify-center text-sm font-medium text-gc-accent-blue">
							{conversation.user.avatar}
						</div>
						<div class="flex-1 min-w-0">
							<div class="flex items-center justify-between">
								<span class="font-medium text-gc-text-primary">{conversation.user.name}</span>
								<span class="text-xs text-gc-text-muted">{formatRelativeTime(conversation.timestamp)}</span>
							</div>
							<div class="flex items-center gap-2 mt-0.5">
								<span class="text-xs text-gc-text-secondary">{conversation.agent}</span>
								<span class="text-xs text-gc-text-muted">•</span>
								<span class="text-xs text-{getStatusColor(conversation.status)}">{getStatusLabel(conversation.status)}</span>
							</div>
							<p class="text-sm text-gc-text-secondary mt-1 truncate">{conversation.lastMessage}</p>
						</div>
					</div>
				</button>
			{/each}
		</div>
	</div>

	<!-- Message Thread -->
	{#if selectedConversation}
		<div class="flex-1 flex flex-col">
			<!-- Thread Header -->
			<div class="p-4 border-b border-gc-border-subtle flex items-center justify-between">
				<div class="flex items-center gap-4">
					<div class="w-10 h-10 rounded-full bg-gc-accent-blue/20 flex items-center justify-center text-sm font-medium text-gc-accent-blue">
						{selectedConversation.user.avatar}
					</div>
					<div>
						<div class="flex items-center gap-2">
							<span class="font-medium text-gc-text-primary">{selectedConversation.user.name}</span>
							<span class="text-sm text-gc-text-muted">{selectedConversation.user.telegramId}</span>
						</div>
						<div class="flex items-center gap-2 mt-0.5">
							<span class="text-sm text-gc-text-secondary">{selectedConversation.agent}</span>
							<span class="text-sm text-gc-text-muted">•</span>
							<span class="text-sm text-{getStatusColor(selectedConversation.status)}">{getStatusLabel(selectedConversation.status)}</span>
							<span class="text-sm text-gc-text-muted">•</span>
							<span class="text-sm text-gc-text-secondary">{selectedConversation.language}</span>
						</div>
					</div>
				</div>
				<div class="flex items-center gap-2">
					<button class="px-3 py-1.5 bg-gc-bg-elevated text-gc-text-primary rounded-lg hover:bg-gc-border-subtle transition-colors text-sm">
						Export CSV
					</button>
					<button class="px-3 py-1.5 bg-gc-accent-amber/20 text-gc-accent-amber rounded-lg hover:bg-gc-accent-amber/30 transition-colors text-sm">
						Escalate
					</button>
					<button class="px-3 py-1.5 bg-gc-bg-elevated text-gc-text-primary rounded-lg hover:bg-gc-border-subtle transition-colors text-sm">
						Flag
					</button>
				</div>
			</div>

			<!-- Messages -->
			<div class="flex-1 overflow-y-auto p-4 space-y-4">
				{#each messages as message}
					<div class="flex {message.sender === 'user' ? 'justify-start' : 'justify-end'}">
						<div class="max-w-[70%] {message.sender === 'user' ? 'bg-gc-bg-surface' : 'bg-gc-accent-blue/20'} rounded-2xl {message.sender === 'user' ? 'rounded-tl-sm' : 'rounded-tr-sm'} p-4">
							<p class="text-gc-text-primary">{message.content}</p>
							<div class="flex items-center gap-3 mt-2 text-xs text-gc-text-muted">
								<span>{formatTime(message.timestamp)}</span>
								{#if message.sender === 'agent'}
									<span class="text-gc-text-secondary">({message.model})</span>
								{/if}
							</div>
							{#if message.sender === 'agent'}
								<div class="flex items-center gap-4 mt-2 pt-2 border-t border-gc-border-subtle text-xs">
									<span class="text-gc-text-secondary">Quality: <span class="text-gc-accent-emerald">{(message.quality * 100).toFixed(0)}%</span></span>
									<span class="text-gc-text-secondary">Latency: <span class="text-gc-text-primary">{message.latency}s</span></span>
									<span class="text-gc-text-secondary">Tokens: <span class="text-gc-text-primary">{message.tokens}</span></span>
								</div>
							{/if}
						</div>
					</div>
				{/each}
			</div>

			<!-- Quick Stats Footer -->
			<div class="p-4 border-t border-gc-border-subtle bg-gc-bg-surface">
				<div class="flex items-center justify-between text-sm">
					<div class="flex items-center gap-6 text-gc-text-secondary">
						<span>{selectedConversation.messageCount} messages</span>
						<span>Started {formatRelativeTime(messages[0]?.timestamp || selectedConversation.timestamp)}</span>
					</div>
					<div class="flex items-center gap-2">
						<button class="px-4 py-2 bg-gc-accent-emerald text-white rounded-lg hover:bg-gc-accent-emerald/80 transition-colors">
							Mark Resolved
						</button>
					</div>
				</div>
			</div>
		</div>
	{:else}
		<div class="flex-1 flex items-center justify-center text-gc-text-muted">
			<div class="text-center">
				<div class="text-4xl mb-4">💬</div>
				<p>Select a conversation to view messages</p>
			</div>
		</div>
	{/if}
</div>
