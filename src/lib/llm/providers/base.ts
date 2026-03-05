/**
 * Base LLM Provider Interface
 * All provider adapters must implement this interface
 *
 * This enables provider-agnostic LLM routing - providers are loaded
 * from D1 and selected at runtime based on routing rules.
 */

import type { LLMMessage, LLMStreamChunk } from "../../../types";

/**
 * Provider configuration stored in D1
 */
export interface ProviderConfig {
	id: string;
	name: string;
	slug: string;
	api_type: "anthropic" | "openai" | "qwen" | "openai_compatible";
	base_url: string;
	models_json: string;
	default_model: string;
	cost_input_per_1m: number;
	cost_output_per_1m: number;
	rate_limit_rpm: number;
	rate_limit_tpm: number;
	timeout_ms: number;
	is_enabled: boolean;
}

/**
 * Model information
 */
export interface ModelInfo {
	id: string;
	name: string;
	context_window: number;
	max_output_tokens: number;
	supports_tools: boolean;
	supports_vision: boolean;
	supports_streaming: boolean;
}

/**
 * Provider call options
 */
export interface ProviderCallOptions {
	/** Maximum tokens to generate */
	max_tokens?: number;
	/** Sampling temperature (0-2) */
	temperature?: number;
	/** Top-p sampling (0-1) */
	top_p?: number;
	/** Stop sequences */
	stop?: string[];
	/** Enable streaming */
	stream?: boolean;
	/** Tool definitions */
	tools?: ToolDefinition[];
	/** Timeout override in ms */
	timeout_ms?: number;
}

/**
 * Tool definition for function calling
 */
export interface ToolDefinition {
	name: string;
	description: string;
	input_schema: Record<string, unknown>;
}

/**
 * Tool call in response
 */
export interface ToolCall {
	id: string;
	name: string;
	input: Record<string, unknown>;
}

/**
 * Provider response metrics
 */
export interface ProviderMetrics {
	latency_ms: number;
	input_tokens: number;
	output_tokens: number;
	total_tokens: number;
	cost_usd: number;
}

/**
 * LLM Provider Adapter Interface
 * All provider adapters must implement these methods
 *
 * Note: This is the runtime adapter, distinct from the LLMProvider
 * database model in types/index.ts
 */
export interface LLMProviderAdapter {
	/** Provider slug (e.g., 'anthropic', 'openai') */
	readonly slug: string;

	/** Provider display name */
	readonly name: string;

	/**
	 * Check if provider is healthy and available
	 */
	isHealthy(): boolean;

	/**
	 * Get available models for this provider
	 */
	getModels(): ModelInfo[];

	/**
	 * Make a completion request (non-streaming)
	 */
	complete(messages: LLMMessage[], model: string, options?: ProviderCallOptions): Promise<ProviderResponse>;

	/**
	 * Make a streaming completion request
	 */
	stream(
		messages: LLMMessage[],
		model: string,
		options?: ProviderCallOptions,
	): AsyncGenerator<LLMStreamChunk, void, unknown>;
}

/**
 * Provider response structure
 */
export interface ProviderResponse {
	content: string;
	tool_calls?: ToolCall[];
	finish_reason: "stop" | "length" | "tool_use" | "content_filter" | "error";
	metrics: ProviderMetrics;
}

/**
 * Abstract base class for provider implementations
 * Provides common functionality
 */
export abstract class BaseProvider implements LLMProviderAdapter {
	protected config: ProviderConfig;
	protected apiKey: string;
	protected models: ModelInfo[];
	protected healthy = true;
	protected lastError?: Error;
	protected lastErrorTime?: number;

	constructor(config: ProviderConfig, apiKey: string) {
		this.config = config;
		this.apiKey = apiKey;
		this.models = JSON.parse(config.models_json) as ModelInfo[];
	}

	get slug(): string {
		return this.config.slug;
	}

	get name(): string {
		return this.config.name;
	}

	isHealthy(): boolean {
		// If we had an error recently, check if cooldown period has passed
		if (this.lastErrorTime) {
			const cooldownMs = 60000; // 1 minute cooldown
			if (Date.now() - this.lastErrorTime < cooldownMs) {
				return false;
			}
			// Cooldown passed, reset
			this.healthy = true;
			this.lastError = undefined;
			this.lastErrorTime = undefined;
		}
		return this.healthy;
	}

	getModels(): ModelInfo[] {
		return this.models;
	}

	/**
	 * Mark provider as unhealthy after an error
	 */
	protected markUnhealthy(error: Error): void {
		this.healthy = false;
		this.lastError = error;
		this.lastErrorTime = Date.now();
	}

	/**
	 * Calculate cost based on token usage
	 */
	protected calculateCost(inputTokens: number, outputTokens: number): number {
		const inputCost = (inputTokens / 1_000_000) * this.config.cost_input_per_1m;
		const outputCost = (outputTokens / 1_000_000) * this.config.cost_output_per_1m;
		return inputCost + outputCost;
	}

	/**
	 * Get default timeout for this provider
	 */
	protected getTimeout(options?: ProviderCallOptions): number {
		return options?.timeout_ms ?? this.config.timeout_ms ?? 30000;
	}

	abstract complete(messages: LLMMessage[], model: string, options?: ProviderCallOptions): Promise<ProviderResponse>;

	abstract stream(
		messages: LLMMessage[],
		model: string,
		options?: ProviderCallOptions,
	): AsyncGenerator<LLMStreamChunk, void, unknown>;
}

/**
 * Factory function type for creating provider instances
 */
export type ProviderFactory = (config: ProviderConfig, apiKey: string) => LLMProviderAdapter;

/**
 * Registry of provider factories
 */
export const providerFactories: Record<string, ProviderFactory> = {};

/**
 * Register a provider factory
 */
export function registerProvider(apiType: string, factory: ProviderFactory): void {
	providerFactories[apiType] = factory;
}

/**
 * Create a provider instance from config
 */
export function createProvider(config: ProviderConfig, apiKey: string): LLMProviderAdapter {
	const factory = providerFactories[config.api_type];
	if (!factory) {
		throw new Error(`Unknown provider API type: ${config.api_type}`);
	}
	return factory(config, apiKey);
}
