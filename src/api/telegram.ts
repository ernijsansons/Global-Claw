/**
 * Telegram Setup API Routes
 * POST /api/tenants/:id/telegram/setup - Register bot + set webhook
 *
 * This endpoint allows tenants to configure a Telegram bot for their agents.
 */

import { Hono } from "hono";
import { requireAuth } from "../lib/auth/middleware";
import { encrypt } from "../lib/crypto";
import { type TelegramBot, createTelegramBot } from "../telegram/bot-api";
import type { Agent, ApiResponse } from "../types";
import type { Env } from "../types/env";

const telegramApi = new Hono<{ Bindings: Env }>();

// All telegram setup routes require authentication
telegramApi.use("/*", requireAuth());

/**
 * POST /api/tenants/:tenantId/telegram/setup
 *
 * Register a Telegram bot for an agent and set up the webhook.
 *
 * Request body:
 * - agent_id: string - The agent to configure
 * - bot_token: string - Telegram bot token from @BotFather
 *
 * Response:
 * - bot_username: string - The configured bot's username
 * - webhook_url: string - The webhook URL that was set
 */
interface TelegramSetupBody {
	agent_id: string;
	bot_token: string;
}

interface TelegramSetupResponse {
	bot_username: string;
	webhook_url: string;
	webhook_set: boolean;
}

telegramApi.post("/tenants/:tenantId/telegram/setup", async (c) => {
	const tenantId = c.req.param("tenantId");
	const body = await c.req.json<TelegramSetupBody>();

	// Validate required fields
	if (!body.agent_id || !body.bot_token) {
		return c.json(
			{
				success: false,
				error: {
					code: "VALIDATION_ERROR",
					message: "Missing required fields: agent_id, bot_token",
				},
			},
			400,
		);
	}

	// Verify the agent belongs to this tenant
	const agent = await c.env.DB.prepare("SELECT * FROM agents WHERE id = ? AND tenant_id = ?")
		.bind(body.agent_id, tenantId)
		.first<Agent>();

	if (!agent) {
		return c.json(
			{
				success: false,
				error: {
					code: "NOT_FOUND",
					message: "Agent not found or does not belong to this tenant",
				},
			},
			404,
		);
	}

	// Validate the bot token by calling getMe
	const bot = createTelegramBot(body.bot_token);
	let botInfo: TelegramBot;
	try {
		botInfo = await bot.getMe();
	} catch {
		return c.json(
			{
				success: false,
				error: {
					code: "INVALID_TOKEN",
					message: "Invalid Telegram bot token. Please verify with @BotFather.",
				},
			},
			400,
		);
	}

	// Build webhook URL
	const webhookUrl = `${c.env.APP_URL}/tg/webhook/${agent.id}`;

	// Set the webhook with Telegram
	let webhookSet = false;
	try {
		await bot.setWebhook(webhookUrl, {
			secret_token: c.env.TELEGRAM_WEBHOOK_SECRET,
			allowed_updates: ["message", "edited_message", "callback_query"],
		});
		webhookSet = true;
	} catch (error) {
		console.error("Failed to set Telegram webhook:", error);
		// Continue - we'll still save the bot token
	}

	// Encrypt the bot token
	const encryptedToken = await encrypt(body.bot_token, c.env.ENCRYPTION_KEY);

	// Update the agent with bot info
	await c.env.DB.prepare(
		`UPDATE agents
		 SET telegram_bot_token_encrypted = ?,
		     telegram_bot_username = ?,
		     updated_at = datetime('now')
		 WHERE id = ?`,
	)
		.bind(encryptedToken, botInfo.username, agent.id)
		.run();

	const response: ApiResponse<TelegramSetupResponse> = {
		success: true,
		data: {
			bot_username: botInfo.username,
			webhook_url: webhookUrl,
			webhook_set: webhookSet,
		},
	};

	return c.json(response, 201);
});

/**
 * DELETE /api/tenants/:tenantId/telegram/disconnect
 *
 * Disconnect a Telegram bot from an agent.
 *
 * Request body:
 * - agent_id: string - The agent to disconnect
 */
interface TelegramDisconnectBody {
	agent_id: string;
}

telegramApi.delete("/tenants/:tenantId/telegram/disconnect", async (c) => {
	const tenantId = c.req.param("tenantId");
	const body = await c.req.json<TelegramDisconnectBody>();

	if (!body.agent_id) {
		return c.json(
			{
				success: false,
				error: {
					code: "VALIDATION_ERROR",
					message: "Missing required field: agent_id",
				},
			},
			400,
		);
	}

	// Verify the agent belongs to this tenant and has a bot configured
	const agent = await c.env.DB.prepare(
		"SELECT id, telegram_bot_token_encrypted FROM agents WHERE id = ? AND tenant_id = ?",
	)
		.bind(body.agent_id, tenantId)
		.first<Pick<Agent, "id" | "telegram_bot_token_encrypted">>();

	if (!agent) {
		return c.json(
			{
				success: false,
				error: {
					code: "NOT_FOUND",
					message: "Agent not found or does not belong to this tenant",
				},
			},
			404,
		);
	}

	// If there's a bot token, try to delete the webhook
	if (agent.telegram_bot_token_encrypted) {
		try {
			const { decrypt } = await import("../lib/crypto");
			const botToken = await decrypt(agent.telegram_bot_token_encrypted, c.env.ENCRYPTION_KEY);
			const bot = createTelegramBot(botToken);
			await bot.deleteWebhook(true); // Drop pending updates
		} catch (error) {
			console.error("Failed to delete Telegram webhook:", error);
			// Continue - we'll still clear the bot info
		}
	}

	// Clear the bot info from the agent
	await c.env.DB.prepare(
		`UPDATE agents
		 SET telegram_bot_token_encrypted = NULL,
		     telegram_bot_username = NULL,
		     updated_at = datetime('now')
		 WHERE id = ?`,
	)
		.bind(body.agent_id)
		.run();

	return c.json({
		success: true,
		data: { disconnected: true },
	});
});

/**
 * GET /api/tenants/:tenantId/telegram/status
 *
 * Get Telegram bot status for an agent.
 *
 * Query params:
 * - agent_id: string - The agent to check
 */
telegramApi.get("/tenants/:tenantId/telegram/status", async (c) => {
	const tenantId = c.req.param("tenantId");
	const agentId = c.req.query("agent_id");

	if (!agentId) {
		return c.json(
			{
				success: false,
				error: {
					code: "VALIDATION_ERROR",
					message: "Missing required query param: agent_id",
				},
			},
			400,
		);
	}

	// Get agent with bot info
	const agent = await c.env.DB.prepare(
		"SELECT id, telegram_bot_token_encrypted, telegram_bot_username FROM agents WHERE id = ? AND tenant_id = ?",
	)
		.bind(agentId, tenantId)
		.first<Pick<Agent, "id" | "telegram_bot_token_encrypted" | "telegram_bot_username">>();

	if (!agent) {
		return c.json(
			{
				success: false,
				error: {
					code: "NOT_FOUND",
					message: "Agent not found or does not belong to this tenant",
				},
			},
			404,
		);
	}

	const isConnected = !!agent.telegram_bot_token_encrypted;

	// If connected, get webhook info
	let webhookInfo = null;
	if (isConnected && agent.telegram_bot_token_encrypted) {
		try {
			const { decrypt } = await import("../lib/crypto");
			const botToken = await decrypt(agent.telegram_bot_token_encrypted, c.env.ENCRYPTION_KEY);
			const bot = createTelegramBot(botToken);
			webhookInfo = await bot.getWebhookInfo();
		} catch (error) {
			console.error("Failed to get webhook info:", error);
		}
	}

	return c.json({
		success: true,
		data: {
			connected: isConnected,
			bot_username: agent.telegram_bot_username,
			webhook_url: webhookInfo?.url ?? null,
			webhook_pending_updates: webhookInfo?.pending_update_count ?? 0,
			webhook_last_error: webhookInfo?.last_error_message ?? null,
		},
	});
});

export { telegramApi };
