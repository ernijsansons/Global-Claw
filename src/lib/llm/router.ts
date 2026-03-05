/**
 * LLM Router
 * D1-based routing rules for provider selection
 *
 * The router selects which LLM provider and model to use based on:
 * - Routing rules from D1 (llm_routing_rules table)
 * - Provider health status
 * - Weighted distribution for load balancing
 */

import type { D1Database } from "@cloudflare/workers-types";
import type { LLMProvider, LLMRoutingRule, RoutingDecision, RoutingRoute } from "../../types";

/**
 * Router context for making routing decisions
 */
export interface RouterContext {
	/** Tenant ID */
	tenant_id: string;
	/** Agent ID (optional) */
	agent_id?: string;
	/** Task type hint (e.g., 'reasoning', 'chat', 'code') */
	task_type?: string;
	/** Language hint (e.g., 'lv', 'ru', 'en') */
	language?: string;
	/** Message token estimate */
	input_tokens?: number;
	/** Priority level (1-3) */
	priority?: number;
}

/**
 * Provider option with weight and health info
 */
interface ProviderOption {
	provider: LLMProvider;
	model: string;
	weight: number;
	is_healthy: boolean;
}

/**
 * LLM Router
 * Selects provider and model based on routing rules
 */
export class LLMRouter {
	private db: D1Database;
	private providerHealth: Map<string, boolean>;
	private providerCache: Map<string, LLMProvider>;

	constructor(db: D1Database, providerHealth?: Map<string, boolean>) {
		this.db = db;
		this.providerHealth = providerHealth ?? new Map();
		this.providerCache = new Map();
	}

	/**
	 * Update provider health status
	 */
	updateHealth(providerId: string, isHealthy: boolean): void {
		this.providerHealth.set(providerId, isHealthy);
	}

	/**
	 * Route a request to the best available provider
	 */
	async route(context: RouterContext): Promise<RoutingDecision> {
		// Get applicable routing rules
		const rules = await this.getApplicableRules(context);

		if (rules.length === 0) {
			// Fall back to default routing (first enabled provider)
			return this.getDefaultRoute("no matching rules");
		}

		// Get provider options from rules
		const options = await this.getProviderOptions(rules);

		if (options.length === 0) {
			throw new Error("No healthy providers available");
		}

		// Select provider based on weights
		const selected = this.selectByWeight(options);

		// Build fallback list (excluding selected)
		const fallbacks = options
			.filter((o) => o.provider.id !== selected.provider.id)
			.map((o) => ({
				provider: o.provider,
				model: o.model,
			}));

		return {
			provider: selected.provider,
			model: selected.model,
			fallbacks,
			reason: `matched rule: ${rules[0]?.name ?? "unknown"}`,
			rule_id: rules[0]?.id,
		};
	}

	/**
	 * Get routing rules that apply to the current context
	 */
	private async getApplicableRules(context: RouterContext): Promise<LLMRoutingRule[]> {
		const rules = await this.db
			.prepare(
				`
				SELECT *
				FROM llm_routing_rules
				WHERE is_enabled = 1
				ORDER BY priority DESC
			`,
			)
			.all<LLMRoutingRule>();

		if (!rules.results) {
			return [];
		}

		// Filter rules that match the context
		return rules.results.filter((rule) => this.ruleMatchesContext(rule, context));
	}

	/**
	 * Check if a rule matches the current context
	 */
	private ruleMatchesContext(rule: LLMRoutingRule, context: RouterContext): boolean {
		const condition = JSON.parse(rule.condition_json) as Record<string, unknown>;

		// Check field-based conditions
		if (condition.field && condition.operator && condition.value !== undefined) {
			const fieldValue = this.getContextFieldValue(context, condition.field as string);
			if (!this.evaluateCondition(fieldValue, condition.operator as string, condition.value)) {
				return false;
			}
		}

		// Legacy: Check direct property conditions
		if (condition.tenant_id && condition.tenant_id !== context.tenant_id) {
			return false;
		}
		if (condition.agent_id && condition.agent_id !== context.agent_id) {
			return false;
		}
		if (condition.task_type && condition.task_type !== context.task_type) {
			return false;
		}
		if (condition.language && condition.language !== context.language) {
			return false;
		}

		return true;
	}

	/**
	 * Get context field value for condition evaluation
	 */
	private getContextFieldValue(context: RouterContext, field: string): unknown {
		switch (field) {
			case "tenant_id":
				return context.tenant_id;
			case "agent_id":
				return context.agent_id;
			case "task_type":
				return context.task_type;
			case "language":
				return context.language;
			case "input_tokens":
				return context.input_tokens;
			case "priority":
				return context.priority;
			default:
				return undefined;
		}
	}

	/**
	 * Evaluate a condition
	 */
	private evaluateCondition(fieldValue: unknown, operator: string, conditionValue: unknown): boolean {
		switch (operator) {
			case "eq":
				return fieldValue === conditionValue;
			case "neq":
				return fieldValue !== conditionValue;
			case "gt":
				return typeof fieldValue === "number" && fieldValue > Number(conditionValue);
			case "lt":
				return typeof fieldValue === "number" && fieldValue < Number(conditionValue);
			case "in":
				return Array.isArray(conditionValue) && conditionValue.includes(fieldValue);
			case "matches":
				return typeof fieldValue === "string" && new RegExp(String(conditionValue)).test(fieldValue);
			default:
				return false;
		}
	}

	/**
	 * Get provider options from matching rules
	 */
	private async getProviderOptions(rules: LLMRoutingRule[]): Promise<ProviderOption[]> {
		const options: ProviderOption[] = [];

		for (const rule of rules) {
			const routes = JSON.parse(rule.routes_json) as RoutingRoute[];

			for (const route of routes) {
				// Get full provider by slug
				const provider = await this.getProviderBySlug(route.provider_slug);

				if (provider && provider.is_enabled === 1) {
					const isHealthy = this.providerHealth.get(provider.id) ?? true;

					options.push({
						provider,
						model: route.model,
						weight: route.weight,
						is_healthy: isHealthy,
					});
				}
			}
		}

		// Filter to only healthy providers
		return options.filter((o) => o.is_healthy);
	}

	/**
	 * Get provider by slug with caching
	 */
	private async getProviderBySlug(slug: string): Promise<LLMProvider | null> {
		// Check cache
		const cached = this.providerCache.get(slug);
		if (cached) {
			return cached;
		}

		// Fetch from DB
		const provider = await this.db
			.prepare("SELECT * FROM llm_providers WHERE slug = ?")
			.bind(slug)
			.first<LLMProvider>();

		if (provider) {
			this.providerCache.set(slug, provider);
		}

		return provider;
	}

	/**
	 * Get provider by ID with caching
	 */
	private async getProviderById(id: string): Promise<LLMProvider | null> {
		// Check cache by iterating (ID lookup)
		for (const [, provider] of this.providerCache) {
			if (provider.id === id) {
				return provider;
			}
		}

		// Fetch from DB
		const provider = await this.db.prepare("SELECT * FROM llm_providers WHERE id = ?").bind(id).first<LLMProvider>();

		if (provider) {
			this.providerCache.set(provider.slug, provider);
		}

		return provider;
	}

	/**
	 * Safely parse models_json string, returning empty array on invalid input
	 */
	private safeParseModelsJson(modelsJson: string | undefined | null): string[] {
		if (!modelsJson || modelsJson.trim() === "" || modelsJson.trim() === "[]") {
			return [];
		}
		try {
			const parsed = JSON.parse(modelsJson);
			if (!Array.isArray(parsed)) {
				return [];
			}
			// Handle both string[] and ModelInfo[] formats
			return parsed.map((item: unknown) =>
				typeof item === "string" ? item : ((item as { id?: string })?.id ?? "unknown"),
			);
		} catch {
			return [];
		}
	}

	/**
	 * Get default routing when no rules match
	 */
	private async getDefaultRoute(reason: string): Promise<RoutingDecision> {
		// Get first enabled provider with highest weight
		const provider = await this.db
			.prepare(
				`
				SELECT *
				FROM llm_providers
				WHERE is_enabled = 1
				ORDER BY weight DESC, created_at ASC
				LIMIT 1
			`,
			)
			.first<LLMProvider>();

		if (!provider) {
			throw new Error("No providers configured");
		}

		// Cache the provider
		this.providerCache.set(provider.slug, provider);

		// Get default model from models_json (safely parsed)
		const models = this.safeParseModelsJson(provider.models_json);
		const defaultModel = models[0] ?? "default";

		return {
			provider,
			model: defaultModel,
			fallbacks: [],
			reason: `default: ${reason}`,
		};
	}

	/**
	 * Select a provider based on weighted random selection
	 */
	private selectByWeight(options: ProviderOption[]): ProviderOption {
		if (options.length === 0) {
			throw new Error("No provider options available");
		}

		const totalWeight = options.reduce((sum, o) => sum + o.weight, 0);
		let random = Math.random() * totalWeight;

		for (const option of options) {
			random -= option.weight;
			if (random <= 0) {
				return option;
			}
		}

		// Fallback to first option (guaranteed to exist due to check above)
		return options[0] as ProviderOption;
	}

	/**
	 * Clear provider cache (for testing or config reload)
	 */
	clearCache(): void {
		this.providerCache.clear();
	}
}

/**
 * Create a router instance
 */
export function createRouter(db: D1Database, providerHealth?: Map<string, boolean>): LLMRouter {
	return new LLMRouter(db, providerHealth);
}
