/**
 * Anthropic Claude Provider Adapter
 * Handles Claude API calls with proper message formatting
 */

import type { LLMMessage, LLMStreamChunk } from "../../../types";
import { BaseProvider, type ProviderCallOptions, type ProviderResponse, registerProvider } from "./base";

/**
 * Anthropic API message format
 */
interface AnthropicMessage {
	role: "user" | "assistant";
	content: string | AnthropicContentBlock[];
}

interface AnthropicContentBlock {
	type: "text" | "image" | "tool_use" | "tool_result";
	text?: string;
	id?: string;
	name?: string;
	input?: Record<string, unknown>;
	tool_use_id?: string;
	content?: string;
}

/**
 * Anthropic API response
 */
interface AnthropicResponse {
	id: string;
	type: "message";
	role: "assistant";
	content: AnthropicContentBlock[];
	model: string;
	stop_reason: "end_turn" | "max_tokens" | "tool_use" | "stop_sequence";
	usage: {
		input_tokens: number;
		output_tokens: number;
	};
}

/**
 * Anthropic streaming event
 */
interface AnthropicStreamEvent {
	type: string;
	message?: AnthropicResponse;
	index?: number;
	content_block?: AnthropicContentBlock;
	delta?: {
		type: string;
		text?: string;
		partial_json?: string;
	};
	usage?: {
		output_tokens: number;
	};
}

/**
 * Anthropic Claude Provider
 */
export class AnthropicProvider extends BaseProvider {
	private readonly apiVersion = "2023-06-01";

	async complete(messages: LLMMessage[], model: string, options?: ProviderCallOptions): Promise<ProviderResponse> {
		const startTime = Date.now();

		try {
			const { systemPrompt, formattedMessages } = this.formatMessages(messages);

			const body: Record<string, unknown> = {
				model,
				max_tokens: options?.max_tokens ?? 4096,
				messages: formattedMessages,
			};

			if (systemPrompt) {
				body.system = systemPrompt;
			}

			if (options?.temperature !== undefined) {
				body.temperature = options.temperature;
			}

			if (options?.top_p !== undefined) {
				body.top_p = options.top_p;
			}

			if (options?.stop) {
				body.stop_sequences = options.stop;
			}

			if (options?.tools) {
				body.tools = options.tools.map((tool) => ({
					name: tool.name,
					description: tool.description,
					input_schema: tool.input_schema,
				}));
			}

			const response = await fetch(`${this.config.base_url}/messages`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					"x-api-key": this.apiKey,
					"anthropic-version": this.apiVersion,
				},
				body: JSON.stringify(body),
				signal: AbortSignal.timeout(this.getTimeout(options)),
			});

			if (!response.ok) {
				const error = await response.text();
				throw new Error(`Anthropic API error: ${response.status} - ${error}`);
			}

			const data = (await response.json()) as AnthropicResponse;
			const latency = Date.now() - startTime;

			// Extract text content
			let content = "";
			const toolCalls: { id: string; name: string; input: Record<string, unknown> }[] = [];

			for (const block of data.content) {
				if (block.type === "text" && block.text) {
					content += block.text;
				} else if (block.type === "tool_use" && block.id && block.name && block.input) {
					toolCalls.push({
						id: block.id,
						name: block.name,
						input: block.input,
					});
				}
			}

			return {
				content,
				tool_calls: toolCalls.length > 0 ? toolCalls : undefined,
				finish_reason: this.mapStopReason(data.stop_reason),
				metrics: {
					latency_ms: latency,
					input_tokens: data.usage.input_tokens,
					output_tokens: data.usage.output_tokens,
					total_tokens: data.usage.input_tokens + data.usage.output_tokens,
					cost_usd: this.calculateCost(data.usage.input_tokens, data.usage.output_tokens),
				},
			};
		} catch (error) {
			this.markUnhealthy(error instanceof Error ? error : new Error(String(error)));
			throw error;
		}
	}

	async *stream(
		messages: LLMMessage[],
		model: string,
		options?: ProviderCallOptions,
	): AsyncGenerator<LLMStreamChunk, void, unknown> {
		const startTime = Date.now();

		try {
			const { systemPrompt, formattedMessages } = this.formatMessages(messages);

			const body: Record<string, unknown> = {
				model,
				max_tokens: options?.max_tokens ?? 4096,
				messages: formattedMessages,
				stream: true,
			};

			if (systemPrompt) {
				body.system = systemPrompt;
			}

			if (options?.temperature !== undefined) {
				body.temperature = options.temperature;
			}

			const response = await fetch(`${this.config.base_url}/messages`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					"x-api-key": this.apiKey,
					"anthropic-version": this.apiVersion,
				},
				body: JSON.stringify(body),
				signal: AbortSignal.timeout(this.getTimeout(options)),
			});

			if (!response.ok) {
				const error = await response.text();
				throw new Error(`Anthropic API error: ${response.status} - ${error}`);
			}

			if (!response.body) {
				throw new Error("No response body");
			}

			const reader = response.body.getReader();
			const decoder = new TextDecoder();
			let buffer = "";
			let inputTokens = 0;
			let outputTokens = 0;

			try {
				while (true) {
					const { done, value } = await reader.read();
					if (done) break;

					buffer += decoder.decode(value, { stream: true });
					const lines = buffer.split("\n");
					buffer = lines.pop() ?? "";

					for (const line of lines) {
						if (line.startsWith("data: ")) {
							const data = line.slice(6);
							if (data === "[DONE]") continue;

							try {
								const event = JSON.parse(data) as AnthropicStreamEvent;

								if (event.type === "message_start" && event.message?.usage) {
									inputTokens = event.message.usage.input_tokens;
								} else if (event.type === "content_block_delta" && event.delta?.text) {
									yield {
										type: "content",
										content: event.delta.text,
									};
								} else if (event.type === "message_delta" && event.usage) {
									outputTokens = event.usage.output_tokens;
								}
							} catch {
								// Skip malformed JSON
							}
						}
					}
				}
			} finally {
				reader.releaseLock();
			}

			// Yield final metrics
			yield {
				type: "done",
				metrics: {
					latency_ms: Date.now() - startTime,
					input_tokens: inputTokens,
					output_tokens: outputTokens,
					total_tokens: inputTokens + outputTokens,
					cost_usd: this.calculateCost(inputTokens, outputTokens),
				},
			};
		} catch (error) {
			this.markUnhealthy(error instanceof Error ? error : new Error(String(error)));
			yield {
				type: "error",
				error: error instanceof Error ? error.message : String(error),
			};
		}
	}

	/**
	 * Format messages for Anthropic API
	 * Extracts system prompt and converts to Anthropic format
	 */
	private formatMessages(messages: LLMMessage[]): {
		systemPrompt: string | undefined;
		formattedMessages: AnthropicMessage[];
	} {
		let systemPrompt: string | undefined;
		const formattedMessages: AnthropicMessage[] = [];

		for (const msg of messages) {
			// Convert content to string for consistent handling
			const contentStr =
				typeof msg.content === "string" ? msg.content : msg.content.map((c) => ("text" in c ? c.text : "")).join("\n");

			if (msg.role === "system") {
				// Anthropic uses a separate system parameter
				systemPrompt = (systemPrompt ?? "") + contentStr;
			} else if (msg.role === "user" || msg.role === "assistant") {
				// Use string content for simplicity
				formattedMessages.push({
					role: msg.role,
					content: contentStr,
				});
			} else if (msg.role === "tool" && msg.tool_use_id) {
				// Tool result - content must be a string
				const contentStr = typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content);
				formattedMessages.push({
					role: "user",
					content: [
						{
							type: "tool_result",
							tool_use_id: msg.tool_use_id,
							content: contentStr,
						},
					],
				});
			}
		}

		return { systemPrompt, formattedMessages };
	}

	/**
	 * Map Anthropic stop reason to standard format
	 */
	private mapStopReason(reason: string): "stop" | "length" | "tool_use" | "content_filter" | "error" {
		switch (reason) {
			case "end_turn":
			case "stop_sequence":
				return "stop";
			case "max_tokens":
				return "length";
			case "tool_use":
				return "tool_use";
			default:
				return "stop";
		}
	}
}

// Register the provider factory
registerProvider("anthropic", (config, apiKey) => new AnthropicProvider(config, apiKey));
