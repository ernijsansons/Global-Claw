/**
 * Alibaba Qwen Provider Adapter
 * Uses OpenAI-compatible API with Qwen-specific adjustments
 */

import type { LLMMessage, LLMStreamChunk } from "../../../types";
import { BaseProvider, type ProviderCallOptions, type ProviderResponse, registerProvider } from "./base";

/**
 * Qwen API uses OpenAI-compatible format with some differences
 */
interface QwenMessage {
	role: "system" | "user" | "assistant";
	content: string;
}

interface QwenResponse {
	output: {
		text: string;
		finish_reason: "stop" | "length" | "null";
	};
	usage: {
		input_tokens: number;
		output_tokens: number;
		total_tokens: number;
	};
	request_id: string;
}

interface QwenStreamChunk {
	output: {
		text: string;
		finish_reason: "stop" | "length" | "null" | null;
	};
	usage?: {
		input_tokens: number;
		output_tokens: number;
		total_tokens: number;
	};
}

/**
 * Qwen Provider
 * Alibaba's Qwen models via DashScope API
 */
export class QwenProvider extends BaseProvider {
	async complete(messages: LLMMessage[], model: string, options?: ProviderCallOptions): Promise<ProviderResponse> {
		const startTime = Date.now();

		try {
			const formattedMessages = this.formatMessages(messages);

			const body = {
				model,
				input: {
					messages: formattedMessages,
				},
				parameters: {
					max_tokens: options?.max_tokens ?? 4096,
					temperature: options?.temperature ?? 0.7,
					top_p: options?.top_p ?? 0.9,
					result_format: "message",
				},
			};

			const response = await fetch(`${this.config.base_url}/services/aigc/text-generation/generation`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${this.apiKey}`,
					"X-DashScope-SSE": "disable",
				},
				body: JSON.stringify(body),
				signal: AbortSignal.timeout(this.getTimeout(options)),
			});

			if (!response.ok) {
				const error = await response.text();
				throw new Error(`Qwen API error: ${response.status} - ${error}`);
			}

			const data = (await response.json()) as QwenResponse;
			const latency = Date.now() - startTime;

			return {
				content: data.output.text,
				finish_reason: this.mapFinishReason(data.output.finish_reason),
				metrics: {
					latency_ms: latency,
					input_tokens: data.usage.input_tokens,
					output_tokens: data.usage.output_tokens,
					total_tokens: data.usage.total_tokens,
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
			const formattedMessages = this.formatMessages(messages);

			const body = {
				model,
				input: {
					messages: formattedMessages,
				},
				parameters: {
					max_tokens: options?.max_tokens ?? 4096,
					temperature: options?.temperature ?? 0.7,
					top_p: options?.top_p ?? 0.9,
					result_format: "message",
					incremental_output: true,
				},
			};

			const response = await fetch(`${this.config.base_url}/services/aigc/text-generation/generation`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${this.apiKey}`,
					"X-DashScope-SSE": "enable",
				},
				body: JSON.stringify(body),
				signal: AbortSignal.timeout(this.getTimeout(options)),
			});

			if (!response.ok) {
				const error = await response.text();
				throw new Error(`Qwen API error: ${response.status} - ${error}`);
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
						if (line.startsWith("data:")) {
							const data = line.slice(5).trim();
							if (!data || data === "[DONE]") continue;

							try {
								const chunk = JSON.parse(data) as QwenStreamChunk;

								if (chunk.output.text) {
									yield {
										type: "content",
										content: chunk.output.text,
									};
								}

								if (chunk.usage) {
									inputTokens = chunk.usage.input_tokens;
									outputTokens = chunk.usage.output_tokens;
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
	 * Format messages for Qwen API
	 */
	private formatMessages(messages: LLMMessage[]): QwenMessage[] {
		return messages
			.filter((msg) => msg.role === "system" || msg.role === "user" || msg.role === "assistant")
			.map((msg) => {
				// Convert content to string if it's an array
				const contentStr =
					typeof msg.content === "string"
						? msg.content
						: msg.content.map((c) => ("text" in c ? c.text : "")).join("\n");

				return {
					role: msg.role as "system" | "user" | "assistant",
					content: contentStr,
				};
			});
	}

	/**
	 * Map Qwen finish reason to standard format
	 */
	private mapFinishReason(reason: string): "stop" | "length" | "tool_use" | "content_filter" | "error" {
		switch (reason) {
			case "stop":
				return "stop";
			case "length":
				return "length";
			default:
				return "stop";
		}
	}
}

// Register the provider factory
registerProvider("qwen", (config, apiKey) => new QwenProvider(config, apiKey));
