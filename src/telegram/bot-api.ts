/**
 * Telegram Bot API Wrapper
 * Provides type-safe access to Telegram Bot API methods
 */

/**
 * Telegram API response envelope
 */
interface TelegramResponse<T> {
	ok: boolean;
	result?: T;
	description?: string;
	error_code?: number;
}

/**
 * Telegram User object
 */
export interface TelegramUser {
	id: number;
	is_bot: boolean;
	first_name: string;
	last_name?: string;
	username?: string;
	language_code?: string;
}

/**
 * Telegram Chat object
 */
export interface TelegramChat {
	id: number;
	type: "private" | "group" | "supergroup" | "channel";
	title?: string;
	username?: string;
	first_name?: string;
	last_name?: string;
}

/**
 * Telegram Message object
 */
export interface TelegramMessage {
	message_id: number;
	from?: TelegramUser;
	chat: TelegramChat;
	date: number;
	text?: string;
	entities?: Array<{
		type: string;
		offset: number;
		length: number;
	}>;
	reply_to_message?: TelegramMessage;
}

/**
 * Telegram Update object (webhook payload)
 */
export interface TelegramUpdate {
	update_id: number;
	message?: TelegramMessage;
	edited_message?: TelegramMessage;
	callback_query?: {
		id: string;
		from: TelegramUser;
		message?: TelegramMessage;
		chat_instance: string;
		data?: string;
	};
}

/**
 * Telegram Bot info
 */
export interface TelegramBot {
	id: number;
	is_bot: boolean;
	first_name: string;
	username: string;
	can_join_groups: boolean;
	can_read_all_group_messages: boolean;
	supports_inline_queries: boolean;
}

/**
 * Send message options
 */
export interface SendMessageOptions {
	parse_mode?: "HTML" | "Markdown" | "MarkdownV2";
	reply_to_message_id?: number;
	disable_notification?: boolean;
	disable_web_page_preview?: boolean;
}

/**
 * Telegram Bot API client
 */
export class TelegramBotApi {
	private baseUrl: string;
	private token: string;

	constructor(token: string) {
		this.token = token;
		this.baseUrl = `https://api.telegram.org/bot${token}`;
	}

	/**
	 * Make an API request to Telegram
	 */
	private async request<T>(method: string, params?: Record<string, unknown>): Promise<T> {
		const url = `${this.baseUrl}/${method}`;

		const response = await fetch(url, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: params ? JSON.stringify(params) : undefined,
		});

		if (!response.ok) {
			throw new Error(`Telegram API HTTP error: ${response.status} ${response.statusText}`);
		}

		const data = (await response.json()) as TelegramResponse<T>;

		if (!data.ok) {
			throw new Error(`Telegram API error: ${data.error_code} - ${data.description}`);
		}

		return data.result as T;
	}

	/**
	 * Get information about the bot
	 */
	async getMe(): Promise<TelegramBot> {
		return this.request<TelegramBot>("getMe");
	}

	/**
	 * Send a text message
	 */
	async sendMessage(chatId: number | string, text: string, options?: SendMessageOptions): Promise<TelegramMessage> {
		return this.request<TelegramMessage>("sendMessage", {
			chat_id: chatId,
			text,
			...options,
		});
	}

	/**
	 * Send a typing action indicator
	 */
	async sendChatAction(
		chatId: number | string,
		action: "typing" | "upload_photo" | "record_video" = "typing",
	): Promise<boolean> {
		return this.request<boolean>("sendChatAction", {
			chat_id: chatId,
			action,
		});
	}

	/**
	 * Edit an existing message
	 */
	async editMessageText(
		chatId: number | string,
		messageId: number,
		text: string,
		options?: Omit<SendMessageOptions, "reply_to_message_id">,
	): Promise<TelegramMessage | boolean> {
		return this.request<TelegramMessage | boolean>("editMessageText", {
			chat_id: chatId,
			message_id: messageId,
			text,
			...options,
		});
	}

	/**
	 * Delete a message
	 */
	async deleteMessage(chatId: number | string, messageId: number): Promise<boolean> {
		return this.request<boolean>("deleteMessage", {
			chat_id: chatId,
			message_id: messageId,
		});
	}

	/**
	 * Set the webhook URL for receiving updates
	 */
	async setWebhook(
		url: string,
		options?: {
			secret_token?: string;
			max_connections?: number;
			allowed_updates?: string[];
		},
	): Promise<boolean> {
		return this.request<boolean>("setWebhook", {
			url,
			...options,
		});
	}

	/**
	 * Remove the webhook
	 */
	async deleteWebhook(dropPendingUpdates = false): Promise<boolean> {
		return this.request<boolean>("deleteWebhook", {
			drop_pending_updates: dropPendingUpdates,
		});
	}

	/**
	 * Get current webhook status
	 */
	async getWebhookInfo(): Promise<{
		url: string;
		has_custom_certificate: boolean;
		pending_update_count: number;
		last_error_date?: number;
		last_error_message?: string;
	}> {
		return this.request("getWebhookInfo");
	}

	/**
	 * Answer a callback query (inline keyboard button press)
	 */
	async answerCallbackQuery(
		callbackQueryId: string,
		options?: {
			text?: string;
			show_alert?: boolean;
			url?: string;
			cache_time?: number;
		},
	): Promise<boolean> {
		return this.request<boolean>("answerCallbackQuery", {
			callback_query_id: callbackQueryId,
			...options,
		});
	}

	/**
	 * Send a message with inline keyboard
	 */
	async sendMessageWithKeyboard(
		chatId: number | string,
		text: string,
		keyboard: Array<
			Array<{
				text: string;
				callback_data?: string;
				url?: string;
			}>
		>,
		options?: SendMessageOptions,
	): Promise<TelegramMessage> {
		return this.request<TelegramMessage>("sendMessage", {
			chat_id: chatId,
			text,
			reply_markup: {
				inline_keyboard: keyboard,
			},
			...options,
		});
	}
}

/**
 * Create a Telegram Bot API client
 */
export function createTelegramBot(token: string): TelegramBotApi {
	return new TelegramBotApi(token);
}

/**
 * Extract bot command from message text
 * Returns command without the leading slash, or null if not a command
 */
export function extractCommand(text: string): { command: string; args: string } | null {
	if (!text.startsWith("/")) {
		return null;
	}

	const parts = text.slice(1).split(/\s+/);
	const command = parts[0]?.split("@")[0] ?? ""; // Remove @botname suffix
	const args = parts.slice(1).join(" ");

	return { command: command.toLowerCase(), args };
}

/**
 * Escape special characters for MarkdownV2 format
 */
export function escapeMarkdownV2(text: string): string {
	return text.replace(/[_*[\]()~`>#+\-=|{}.!\\]/g, "\\$&");
}
