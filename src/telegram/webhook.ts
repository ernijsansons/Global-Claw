/**
 * Telegram Webhook Handler
 * Handles incoming updates from Telegram Bot API
 *
 * Route: POST /tg/webhook/:agentId
 * Verifies X-Telegram-Bot-Api-Secret-Token header
 */

import { Hono } from "hono";
import { decrypt } from "../lib/crypto";
import { constantTimeEqual } from "../lib/crypto";
import { getExecutor } from "../lib/llm/executor";
import type { Agent } from "../types";
import type { Env } from "../types/env";
import { type TelegramUpdate, createTelegramBot, extractCommand } from "./bot-api";
import { type SupportedLanguage, getLanguageFromTelegram, routeCommand } from "./commands";

const telegramWebhook = new Hono<{ Bindings: Env }>();

/**
 * Verify Telegram webhook secret token
 */
function verifyWebhookSecret(request: Request, secret: string): boolean {
	const headerSecret = request.headers.get("X-Telegram-Bot-Api-Secret-Token");
	if (!headerSecret) {
		return false;
	}
	return constantTimeEqual(headerSecret, secret);
}

/**
 * POST /tg/webhook/:agentId
 * Main webhook endpoint for Telegram updates
 */
telegramWebhook.post("/:agentId", async (c) => {
	const agentId = c.req.param("agentId");

	// Verify webhook secret
	if (!verifyWebhookSecret(c.req.raw, c.env.TELEGRAM_WEBHOOK_SECRET)) {
		return c.json({ error: "Invalid webhook secret" }, 401);
	}

	// Get agent from D1
	const agent = await c.env.DB.prepare("SELECT * FROM agents WHERE id = ? AND status = 'active'")
		.bind(agentId)
		.first<Agent>();

	if (!agent) {
		return c.json({ error: "Agent not found or inactive" }, 404);
	}

	// Agent must have a configured bot token
	if (!agent.telegram_bot_token_encrypted) {
		return c.json({ error: "Agent has no Telegram bot configured" }, 400);
	}

	// Decrypt bot token
	let botToken: string;
	try {
		botToken = await decrypt(agent.telegram_bot_token_encrypted, c.env.ENCRYPTION_KEY);
	} catch {
		console.error(`Failed to decrypt bot token for agent ${agentId}`);
		return c.json({ error: "Failed to decrypt bot token" }, 500);
	}

	// Parse the update
	let update: TelegramUpdate;
	try {
		update = await c.req.json<TelegramUpdate>();
	} catch {
		return c.json({ error: "Invalid update payload" }, 400);
	}

	// Create bot API client
	const bot = createTelegramBot(botToken);

	// Process the update
	try {
		await processUpdate(c.env, agent, bot, update);
	} catch (error) {
		console.error(`Error processing update for agent ${agentId}:`, error);
		// Don't return error to Telegram to avoid retries on unrecoverable errors
	}

	// Always return 200 OK to Telegram
	return c.json({ ok: true });
});

/**
 * Process a Telegram update
 */
async function processUpdate(
	env: Env,
	agent: Agent,
	bot: ReturnType<typeof createTelegramBot>,
	update: TelegramUpdate,
): Promise<void> {
	// Handle callback queries (inline keyboard button presses)
	if (update.callback_query) {
		const query = update.callback_query;
		const data = query.data;

		// Acknowledge the callback
		await bot.answerCallbackQuery(query.id);

		// Handle language change callbacks
		if (data?.startsWith("lang:")) {
			const newLang = data.slice(5) as SupportedLanguage;
			if (["lv", "ru", "en"].includes(newLang) && query.message) {
				// Store language preference
				await storeUserLanguage(env, query.from.id, newLang);

				// Send confirmation
				const confirmations: Record<SupportedLanguage, string> = {
					lv: "Valoda mainīta uz latviešu.",
					ru: "Язык изменён на русский.",
					en: "Language changed to English.",
				};
				await bot.sendMessage(query.message.chat.id, confirmations[newLang]);
			}
		}
		return;
	}

	// Handle messages
	const message = update.message ?? update.edited_message;
	if (!message) {
		return;
	}

	const chatId = message.chat.id;
	const text = message.text;
	const userId = message.from?.id;

	if (!text || !userId) {
		return;
	}

	// Get user's language preference
	const userLanguage = await getUserLanguage(env, userId, message.from?.language_code);

	// Check if it's a command
	const commandInfo = extractCommand(text);
	if (commandInfo) {
		await routeCommand(bot, message, commandInfo.command, commandInfo.args, userLanguage, async (uid, lang) => {
			await storeUserLanguage(env, uid, lang);
		});
		return;
	}

	// Not a command - process as a regular message with LLM
	await processMessage(env, agent, bot, chatId, userId, text, userLanguage);
}

/**
 * Process a regular message (non-command) with LLM
 */
async function processMessage(
	env: Env,
	agent: Agent,
	bot: ReturnType<typeof createTelegramBot>,
	chatId: number,
	userId: number,
	text: string,
	language: SupportedLanguage,
): Promise<void> {
	// Send typing indicator
	await bot.sendChatAction(chatId, "typing");

	// TODO: Get conversation history from TenantAgent DO for context
	// const tenantDO = env.TENANT_AGENT.get(env.TENANT_AGENT.idFromName(agent.tenant_id));

	// Build system prompt from agent's soul_md
	let systemPrompt = agent.soul_md;
	if (agent.agents_md) {
		systemPrompt += `\n\n${agent.agents_md}`;
	}

	// Add language instruction
	const languageInstructions: Record<SupportedLanguage, string> = {
		lv: "Respond in Latvian (latviešu valodā).",
		ru: "Respond in Russian (по-русски).",
		en: "Respond in English.",
	};
	systemPrompt += `\n\n${languageInstructions[language]}`;

	// Get LLM executor
	const executor = getExecutor(env);

	try {
		// Execute LLM call
		const response = await executor.execute({
			tenant_id: agent.tenant_id,
			trace_id: `tg-${chatId}-${Date.now()}`,
			messages: [
				{ role: "system", content: systemPrompt },
				{ role: "user", content: text },
			],
			task_type: "chat",
			context: {
				agent_id: agent.id,
				language,
				channel: "telegram",
				user_id: String(userId),
			},
			max_tokens: agent.max_tokens,
			temperature: agent.temperature,
			allow_fallback: true,
		});

		// Send response to user
		if (response.content) {
			// Split long messages (Telegram has 4096 char limit)
			const maxLength = 4000;
			const content = response.content;

			if (content.length <= maxLength) {
				await bot.sendMessage(chatId, content);
			} else {
				// Split into multiple messages
				for (let i = 0; i < content.length; i += maxLength) {
					const chunk = content.slice(i, i + maxLength);
					await bot.sendMessage(chatId, chunk);
				}
			}
		}

		// Update message counters
		await env.DB.prepare(
			"UPDATE agents SET total_messages = total_messages + 1, updated_at = datetime('now') WHERE id = ?",
		)
			.bind(agent.id)
			.run();
	} catch (error) {
		console.error(`LLM error for agent ${agent.id}:`, error);

		// Send error message to user
		const errorMessages: Record<SupportedLanguage, string> = {
			lv: "Atvainojiet, radās tehniska kļūda. Lūdzu mēģiniet vēlreiz.",
			ru: "Извините, произошла техническая ошибка. Пожалуйста, попробуйте снова.",
			en: "Sorry, a technical error occurred. Please try again.",
		};
		await bot.sendMessage(chatId, errorMessages[language]);
	}
}

/**
 * Get user's language preference from KV
 */
async function getUserLanguage(env: Env, userId: number, telegramLanguageCode?: string): Promise<SupportedLanguage> {
	// Try to get from KV
	const stored = await env.RATE_LIMIT_KV.get(`user:${userId}:lang`);
	if (stored && ["lv", "ru", "en"].includes(stored)) {
		return stored as SupportedLanguage;
	}

	// Fall back to Telegram language code
	return getLanguageFromTelegram(telegramLanguageCode);
}

/**
 * Store user's language preference in KV
 */
async function storeUserLanguage(env: Env, userId: number, language: SupportedLanguage): Promise<void> {
	// Store for 1 year
	await env.RATE_LIMIT_KV.put(`user:${userId}:lang`, language, {
		expirationTtl: 365 * 24 * 60 * 60,
	});
}

export { telegramWebhook };
