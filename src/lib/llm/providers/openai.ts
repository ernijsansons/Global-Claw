/**
 * OpenAI-Compatible Provider Adapter
 * Works with OpenAI, Azure OpenAI, and OpenAI-compatible APIs
 */

import type { LLMMessage, LLMStreamChunk } from "../../../types";
import { BaseProvider, type ProviderCallOptions, type ProviderResponse, registerProvider } from "./base";

/**
 * OpenAI API message format
 */
interface OpenAIMessage {
	role: "system" | "user" | "assistant" | "tool";
	content: string | null;
	tool_calls?: OpenAIToolCall[];
	tool_call_id?: string;
}

interface OpenAIToolCall {
	id: string;
	type: "function";
	function: {
		name: string;
		arguments: string;
	};
}

/**
 * OpenAI API response
 */
interface OpenAIResponse {
	id: string;
	object: "chat.completion";
	created: number;
	model: string;
	choices: Array<{
		index: number;
		message: {
			role: "assistant";
			content: string | null;
			tool_calls?: OpenAIToolCall[];
		};
		finish_reason: "stop" | "length" | "tool_calls" | "content_filter";
	}>;
	usage: {
		prompt_tokens: number;
		completion_tokens: number;
		total_tokens: number;
	};
}

/**
 * OpenAI streaming chunk
 */
interface OpenAIStreamChunk {
	id: string;
	object: "chat.completion.chunk";
	created: number;
	model: string;
	choices: Array<{
		index: number;
		delta: {
			role?: "assistant";
			content?: string;
			tool_calls?: Array<{
				index: number;
				id?: string;
				type?: "function";
				function?: {
					name?: string;
					arguments?: string;
				};
			}>;
		};
		finish_reason: "stop" | "length" | "tool_calls" | "content_filter" | null;
	}>;
	usage?: {
		prompt_tokens: number;
		completion_tokens: number;
		total_tokens: number;
	};
}

/**
 * OpenAI-Compatible Provider
 */
export class OpenAIProvider extends BaseProvider {
	async complete(messages: LLMMessage[], model: string, options?: ProviderCallOptions): Promise<ProviderResponse> {
		const startTime = Date.now();

		try {
			const formattedMessages = this.formatMessages(messages);

			const body: Record<string, unknown> = {
				model,
				messages: formattedMessages,
				max_tokens: options?.max_tokens ?? 4096,
			};

			if (options?.temperature !== undefined) {
				body.temperature = options.temperature;
			}

			if (options?.top_p !== undefined) {
				body.top_p = options.top_p;
			}

			if (options?.stop) {
				body.stop = options.stop;
			}

			if (options?.tools) {
				body.tools = options.tools.map((tool) => ({
					type: "function",
					function: {
						name: tool.name,
						description: tool.description,
						parameters: tool.input_schema,
					},
				}));
			}

			const response = await fetch(this.getEndpointUrl("/chat/completions"), {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${this.apiKey}`,
				},
				body: JSON.stringify(body),
				signal: AbortSignal.timeout(this.getTimeout(options)),
			});

			if (!response.ok) {
				const error = await response.text();
				throw new Error(`OpenAI API error: ${response.status} - ${error}`);
			}

			const data = (await response.json()) as OpenAIResponse;
			const latency = Date.now() - startTime;

			const choice = data.choices[0];
			if (!choice) {
				throw new Error("No choices in response");
			}

			// Extract tool calls
			const toolCalls = choice.message.tool_calls?.map((tc) => ({
				id: tc.id,
				name: tc.function.name,
				input: JSON.parse(tc.function.arguments) as Record<string, unknown>,
			}));

			return {
				content: choice.message.content ?? "",
				tool_calls: toolCalls,
				finish_reason: this.mapFinishReason(choice.finish_reason),
				metrics: {
					latency_ms: latency,
					input_tokens: data.usage.prompt_tokens,
					output_tokens: data.usage.completion_tokens,
					total_tokens: data.usage.total_tokens,
					cost_usd: this.calculateCost(data.usage.prompt_tokens, data.usage.completion_tokens),
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
			const formattedMessages = this.formatMessages(messages);

			const body: Record<string, unknown> = {
				model,
				messages: formattedMessages,
				max_tokens: options?.max_tokens ?? 4096,
				stream: true,
				stream_options: { include_usage: true },
			};

			if (options?.temperature !== undefined) {
				body.temperature = options.temperature;
			}

			const response = await fetch(this.getEndpointUrl("/chat/completions"), {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${this.apiKey}`,
				},
				body: JSON.stringify(body),
				signal: AbortSignal.timeout(this.getTimeout(options)),
			});

			if (!response.ok) {
				const error = await response.text();
				throw new Error(`OpenAI API error: ${response.status} - ${error}`);
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
								const chunk = JSON.parse(data) as OpenAIStreamChunk;
								const choice = chunk.choices[0];

								if (choice?.delta.content) {
									yield {
										type: "content",
										content: choice.delta.content,
									};
								}

								if (chunk.usage) {
									inputTokens = chunk.usage.prompt_tokens;
									outputTokens = chunk.usage.completion_tokens;
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
	 * Format messages for OpenAI API
	 */
	private formatMessages(messages: LLMMessage[]): OpenAIMessage[] {
		return messages.map((msg) => {
			// Convert content to string if it's an array
			const contentStr =
				typeof msg.content === "string" ? msg.content : msg.content.map((c) => ("text" in c ? c.text : "")).join("\n");

			const formatted: OpenAIMessage = {
				role: msg.role as "system" | "user" | "assistant" | "tool",
				content: contentStr,
			};

			if (msg.role === "tool" && msg.tool_use_id) {
				formatted.tool_call_id = msg.tool_use_id;
			}

			return formatted;
		});
	}

	/**
	 * Map OpenAI finish reason to standard format
	 */
	private mapFinishReason(reason: string): "stop" | "length" | "tool_use" | "content_filter" | "error" {
		switch (reason) {
			case "stop":
				return "stop";
			case "length":
				return "length";
			case "tool_calls":
				return "tool_use";
			case "content_filter":
				return "content_filter";
			default:
				return "stop";
		}
	}
}

// Register the provider factory
registerProvider("openai", (config, apiKey) => new OpenAIProvider(config, apiKey));
registerProvider("openai_compatible", (config, apiKey) => new OpenAIProvider(config, apiKey));
