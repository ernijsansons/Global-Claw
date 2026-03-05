/**
 * LLM Executor
 * Fail-closed gateway for all LLM calls
 *
 * ALL LLM calls in Global-Claw MUST go through this executor.
 * Direct API calls to LLM providers are prohibited.
 *
 * Features:
 * - Provider-agnostic routing
 * - Automatic fallback on failure (respects allow_fallback flag)
 * - Circuit breaker integration
 * - Token/cost tracking
 * - Audit logging
 * - AI Gateway integration for observability
 */

import type { LLMMessage, LLMProvider, LLMRequest, LLMResponse, LLMStreamChunk } from "../../types";
import type { Env } from "../../types/env";
import { decrypt } from "../crypto";
import { LLMProviderError, ServiceUnavailableError } from "../errors";
import { type CircuitBreakerManager, getCircuitBreaker } from "./circuit-breaker";
import { type LLMProviderAdapter, type ProviderCallOptions, type ProviderConfig, createProvider } from "./providers";
import { type LLMRouter, type RouterContext, createRouter } from "./router";

/**
 * Executor options
 */
export interface ExecutorOptions {
	/** Maximum retries across fallback chain */
	maxRetries?: number;
	/** Timeout per request in ms */
	timeout?: number;
	/** Enable streaming */
	stream?: boolean;
	/** Skip circuit breaker check (for testing) */
	skipCircuitBreaker?: boolean;
}

/**
 * LLM Executor
 * Singleton per isolate for managing LLM calls
 */
export class LLMExecutor {
	private env: Env;
	private router: LLMRouter;
	private circuitBreaker: CircuitBreakerManager;
	private adapterCache: Map<string, LLMProviderAdapter>;
	private configCache: Map<string, ProviderConfig>;

	constructor(env: Env) {
		this.env = env;
		this.circuitBreaker = getCircuitBreaker();
		this.router = createRouter(env.DB, this.circuitBreaker.getHealthMap());
		this.adapterCache = new Map();
		this.configCache = new Map();
	}

	/**
	 * Execute an LLM request
	 *
	 * This is the ONLY way to call LLM providers in Global-Claw.
	 */
	async execute(request: LLMRequest, options?: ExecutorOptions): Promise<LLMResponse> {
		const maxRetries = options?.maxRetries ?? 3;
		const allowFallback = request.allow_fallback !== false; // Default to true
		let lastError: Error | undefined;

		// Get routing decision
		const routerContext: RouterContext = {
			tenant_id: request.tenant_id,
			agent_id: request.context?.agent_id,
			task_type: request.task_type,
			language: request.context?.language ?? this.detectLanguage(request.messages),
		};

		const routing = await this.router.route(routerContext);

		// Build list of providers to try (primary + fallbacks if allowed)
		const providersToTry = allowFallback
			? [{ provider: routing.provider, model: routing.model }, ...routing.fallbacks]
			: [{ provider: routing.provider, model: routing.model }];

		const maxAttempts = allowFallback ? Math.min(maxRetries, providersToTry.length) : 1;

		for (let attempt = 0; attempt < maxAttempts; attempt++) {
			const target = providersToTry[attempt];
			if (!target) continue;

			const providerId = target.provider.id;

			// Check circuit breaker
			if (!options?.skipCircuitBreaker && !this.circuitBreaker.canRequest(providerId)) {
				continue;
			}

			try {
				const adapter = await this.getAdapter(target.provider);
				const callStartTime = Date.now();

				const callOptions: ProviderCallOptions = {
					max_tokens: request.max_tokens,
					temperature: request.temperature,
					top_p: undefined, // LLMRequest doesn't have this field
					stop: request.stop_sequences,
					tools: request.tools,
					timeout_ms: options?.timeout ?? request.timeout_ms,
				};

				const result = await adapter.complete(request.messages, target.model, callOptions);

				// Record success - update both circuit breaker and router health
				this.circuitBreaker.recordSuccess(providerId);
				this.router.updateHealth(providerId, true);

				const latencyMs = Date.now() - callStartTime;
				const costCents = this.calculateCost(
					target.provider,
					result.metrics.input_tokens,
					result.metrics.output_tokens,
				);

				// Log usage
				await this.logUsage(request, {
					provider_id: providerId,
					model: target.model,
					latency_ms: latencyMs,
					input_tokens: result.metrics.input_tokens,
					output_tokens: result.metrics.output_tokens,
					cost_cents: costCents,
				});

				// Build response matching LLMResponse type
				return {
					trace_id: request.trace_id,
					provider: {
						name: target.provider.name,
						slug: target.provider.slug,
						model: target.model,
					},
					content: result.content,
					stop_reason: this.mapFinishReason(result.finish_reason),
					tool_calls: result.tool_calls,
					usage: {
						input_tokens: result.metrics.input_tokens,
						output_tokens: result.metrics.output_tokens,
					},
					latency_ms: latencyMs,
					cost_cents: costCents,
					completed_at: new Date().toISOString(),
				};
			} catch (error) {
				lastError = error instanceof Error ? error : new Error(String(error));

				// Record failure
				this.circuitBreaker.recordFailure(providerId, lastError);

				// Update router health
				this.router.updateHealth(providerId, false);
			}
		}

		// All providers failed
		if (lastError) {
			throw new LLMProviderError("all providers", lastError.message);
		}

		throw new ServiceUnavailableError("No LLM providers available");
	}

	/**
	 * Execute an LLM request with streaming
	 * Supports fallback to alternative providers on failure
	 */
	async *executeStream(request: LLMRequest, options?: ExecutorOptions): AsyncGenerator<LLMStreamChunk, void, unknown> {
		const maxRetries = options?.maxRetries ?? 3;
		const allowFallback = request.allow_fallback !== false; // Default to true
		let lastError: Error | undefined;

		// Get routing decision
		const routerContext: RouterContext = {
			tenant_id: request.tenant_id,
			agent_id: request.context?.agent_id,
			task_type: request.task_type,
			language: request.context?.language ?? this.detectLanguage(request.messages),
		};

		const routing = await this.router.route(routerContext);

		// Build list of providers to try (primary + fallbacks if allowed)
		const providersToTry = allowFallback
			? [{ provider: routing.provider, model: routing.model }, ...routing.fallbacks]
			: [{ provider: routing.provider, model: routing.model }];

		const maxAttempts = allowFallback ? Math.min(maxRetries, providersToTry.length) : 1;

		for (let attempt = 0; attempt < maxAttempts; attempt++) {
			const target = providersToTry[attempt];
			if (!target) continue;

			const providerId = target.provider.id;

			// Check circuit breaker
			if (!options?.skipCircuitBreaker && !this.circuitBreaker.canRequest(providerId)) {
				continue;
			}

			try {
				const adapter = await this.getAdapter(target.provider);

				const callOptions: ProviderCallOptions = {
					max_tokens: request.max_tokens,
					temperature: request.temperature,
					stop: request.stop_sequences,
					tools: request.tools,
					timeout_ms: options?.timeout ?? request.timeout_ms,
					stream: true,
				};

				const stream = adapter.stream(request.messages, target.model, callOptions);
				let streamSucceeded = false;
				let streamError: Error | undefined;

				for await (const chunk of stream) {
					// If this is the done chunk, log usage and mark success
					if (chunk.type === "done" && chunk.metrics) {
						streamSucceeded = true;
						this.circuitBreaker.recordSuccess(providerId);
						this.router.updateHealth(providerId, true);
						await this.logUsage(request, {
							provider_id: providerId,
							model: target.model,
							latency_ms: chunk.metrics.latency_ms,
							input_tokens: chunk.metrics.input_tokens,
							output_tokens: chunk.metrics.output_tokens,
							cost_cents: this.calculateCost(target.provider, chunk.metrics.input_tokens, chunk.metrics.output_tokens),
						});
					} else if (chunk.type === "error") {
						// Record error but don't yield yet - try fallback first
						streamError = new Error(chunk.error);
						this.circuitBreaker.recordFailure(providerId);
						this.router.updateHealth(providerId, false);
						break;
					}

					yield chunk;
				}

				// If stream completed successfully, we're done
				if (streamSucceeded) {
					return;
				}

				// If stream had an error, save it and try next provider
				if (streamError) {
					lastError = streamError;
					continue;
				}

				// Stream completed without explicit done - assume success
				return;
			} catch (error) {
				lastError = error instanceof Error ? error : new Error(String(error));
				this.circuitBreaker.recordFailure(providerId);
				this.router.updateHealth(providerId, false);
				// Continue to next provider
			}
		}

		// All providers failed
		yield {
			type: "error",
			error: lastError?.message ?? "No LLM providers available",
		};
	}

	/**
	 * Get or create a provider adapter instance
	 */
	private async getAdapter(provider: LLMProvider): Promise<LLMProviderAdapter> {
		// Check cache
		let adapter = this.adapterCache.get(provider.id);
		if (adapter) {
			return adapter;
		}

		// Build config from provider
		const config: ProviderConfig = {
			id: provider.id,
			name: provider.name,
			slug: provider.slug,
			api_type: this.inferApiType(provider.slug),
			base_url: provider.api_base_url,
			models_json: provider.models_json,
			default_model: JSON.parse(provider.models_json)[0] ?? "default",
			cost_input_per_1m: provider.cost_per_1m_input_cents / 100,
			cost_output_per_1m: provider.cost_per_1m_output_cents / 100,
			rate_limit_rpm: provider.max_requests_per_min,
			rate_limit_tpm: 100000, // Default TPM
			timeout_ms: 30000, // Default timeout
			is_enabled: provider.is_enabled === 1,
			// Add AI Gateway config if available
			gateway:
				this.env.CF_ACCOUNT_ID && this.env.AI_GATEWAY_SLUG
					? {
							account_id: this.env.CF_ACCOUNT_ID,
							gateway_slug: this.env.AI_GATEWAY_SLUG,
						}
					: undefined,
		};

		// Decrypt API key
		if (!provider.api_key_encrypted) {
			throw new Error(`Provider has no API key: ${provider.id}`);
		}

		const apiKey = await decrypt(provider.api_key_encrypted, this.env.ENCRYPTION_KEY);

		// Create adapter
		adapter = createProvider(config, apiKey);
		this.adapterCache.set(provider.id, adapter);

		return adapter;
	}

	/**
	 * Infer API type from provider slug
	 */
	private inferApiType(slug: string): ProviderConfig["api_type"] {
		if (slug.includes("anthropic") || slug.includes("claude")) {
			return "anthropic";
		}
		if (slug.includes("openai") || slug.includes("gpt")) {
			return "openai";
		}
		if (slug.includes("qwen") || slug.includes("alibaba")) {
			return "qwen";
		}
		return "openai_compatible";
	}

	/**
	 * Calculate cost in cents
	 */
	private calculateCost(provider: LLMProvider, inputTokens: number, outputTokens: number): number {
		const inputCost = (inputTokens / 1_000_000) * provider.cost_per_1m_input_cents;
		const outputCost = (outputTokens / 1_000_000) * provider.cost_per_1m_output_cents;
		return Math.round((inputCost + outputCost) * 100) / 100;
	}

	/**
	 * Map provider finish reason to LLMResponse stop_reason
	 */
	private mapFinishReason(
		reason: "stop" | "length" | "tool_use" | "content_filter" | "error",
	): LLMResponse["stop_reason"] {
		switch (reason) {
			case "stop":
				return "end_turn";
			case "length":
				return "max_tokens";
			case "tool_use":
				return "tool_use";
			default:
				return "stop_sequence";
		}
	}

	/**
	 * Log usage to D1
	 */
	private async logUsage(
		request: LLMRequest,
		metrics: {
			provider_id: string;
			model: string;
			latency_ms: number;
			input_tokens: number;
			output_tokens: number;
			cost_cents: number;
		},
	): Promise<void> {
		try {
			await this.env.DB.prepare(
				`
				INSERT INTO llm_usage_log (
					id, tenant_id, provider_id, model,
					input_tokens, output_tokens, latency_ms, cost_cents,
					status, trace_id, created_at
				) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'success', ?, datetime('now'))
			`,
			)
				.bind(
					crypto.randomUUID(),
					request.tenant_id,
					metrics.provider_id,
					metrics.model,
					metrics.input_tokens,
					metrics.output_tokens,
					metrics.latency_ms,
					metrics.cost_cents,
					request.trace_id,
				)
				.run();
		} catch (error) {
			// Log error but don't fail the request
			console.error("Failed to log LLM usage:", error);
		}
	}

	/**
	 * Detect language from messages
	 */
	private detectLanguage(messages: LLMMessage[]): string | undefined {
		// Simple heuristic: check last user message
		const lastUserMessage = messages.filter((m) => m.role === "user").pop();
		if (!lastUserMessage) return undefined;

		// Handle both string and array content
		let content: string;
		if (typeof lastUserMessage.content === "string") {
			content = lastUserMessage.content.toLowerCase();
		} else if (Array.isArray(lastUserMessage.content)) {
			// Find first text content
			const textContent = lastUserMessage.content.find((c) => c.type === "text");
			if (textContent && "text" in textContent) {
				content = textContent.text.toLowerCase();
			} else {
				return undefined;
			}
		} else {
			return undefined;
		}

		// Check for Latvian
		if (/[āčēģīķļņšūž]/.test(content)) {
			return "lv";
		}

		// Check for Russian
		if (/[а-яё]/i.test(content)) {
			return "ru";
		}

		// Default to English
		return "en";
	}

	/**
	 * Clear caches (for testing or config reload)
	 */
	clearCaches(): void {
		this.adapterCache.clear();
		this.configCache.clear();
		this.router.clearCache();
	}
}

/**
 * Create an executor instance
 */
export function createExecutor(env: Env): LLMExecutor {
	return new LLMExecutor(env);
}

/**
 * Singleton executor per request context
 */
const executorSymbol = Symbol.for("global-claw-executor");

/**
 * Get or create executor for the current request
 */
export function getExecutor(env: Env): LLMExecutor {
	const global = globalThis as unknown as { [key: symbol]: LLMExecutor };
	if (!global[executorSymbol]) {
		global[executorSymbol] = new LLMExecutor(env);
	}
	return global[executorSymbol];
}
