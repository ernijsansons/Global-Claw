/**
 * Telegram Bot Command Handlers
 * Handles /start, /help, /settings, /language commands
 */

import type { TelegramBotApi, TelegramMessage, TelegramUser } from "./bot-api";

/**
 * Supported languages
 */
export type SupportedLanguage = "lv" | "ru" | "en";

/**
 * Command context passed to handlers
 */
export interface CommandContext {
	bot: TelegramBotApi;
	message: TelegramMessage;
	user: TelegramUser;
	args: string;
	language: SupportedLanguage;
}

/**
 * Command handler function type
 */
export type CommandHandler = (ctx: CommandContext) => Promise<void>;

/**
 * Localized strings for bot responses
 */
const i18n: Record<SupportedLanguage, Record<string, string>> = {
	lv: {
		welcome: "Sveiki! Es esmu jūsu AI asistents. Izmantojiet /help, lai redzētu pieejamās komandas.",
		help: `Pieejamās komandas:
/start - Sākt sarunu
/help - Parādīt šo palīdzības ziņojumu
/settings - Skatīt un mainīt iestatījumus
/language - Mainīt valodu`,
		settings: `Jūsu iestatījumi:
🌐 Valoda: Latviešu
📊 Statuss: Aktīvs

Izmantojiet /language, lai mainītu valodu.`,
		language_prompt: `Izvēlieties valodu:
🇱🇻 /lv - Latviešu
🇷🇺 /ru - Krievu
🇬🇧 /en - Angļu`,
		language_changed: "Valoda mainīta uz latviešu.",
		unknown_command: "Nezināma komanda. Izmantojiet /help, lai redzētu pieejamās komandas.",
	},
	ru: {
		welcome: "Привет! Я ваш AI ассистент. Используйте /help, чтобы увидеть доступные команды.",
		help: `Доступные команды:
/start - Начать разговор
/help - Показать это сообщение помощи
/settings - Просмотр и изменение настроек
/language - Изменить язык`,
		settings: `Ваши настройки:
🌐 Язык: Русский
📊 Статус: Активен

Используйте /language, чтобы изменить язык.`,
		language_prompt: `Выберите язык:
🇱🇻 /lv - Латышский
🇷🇺 /ru - Русский
🇬🇧 /en - Английский`,
		language_changed: "Язык изменён на русский.",
		unknown_command: "Неизвестная команда. Используйте /help, чтобы увидеть доступные команды.",
	},
	en: {
		welcome: "Hello! I'm your AI assistant. Use /help to see available commands.",
		help: `Available commands:
/start - Start a conversation
/help - Show this help message
/settings - View and change settings
/language - Change language`,
		settings: `Your settings:
🌐 Language: English
📊 Status: Active

Use /language to change language.`,
		language_prompt: `Choose language:
🇱🇻 /lv - Latvian
🇷🇺 /ru - Russian
🇬🇧 /en - English`,
		language_changed: "Language changed to English.",
		unknown_command: "Unknown command. Use /help to see available commands.",
	},
};

/**
 * Get localized string
 */
export function t(key: string, language: SupportedLanguage): string {
	return i18n[language]?.[key] ?? i18n.en[key] ?? key;
}

/**
 * Handle /start command
 */
export async function handleStart(ctx: CommandContext): Promise<void> {
	await ctx.bot.sendMessage(ctx.message.chat.id, t("welcome", ctx.language));
}

/**
 * Handle /help command
 */
export async function handleHelp(ctx: CommandContext): Promise<void> {
	await ctx.bot.sendMessage(ctx.message.chat.id, t("help", ctx.language));
}

/**
 * Handle /settings command
 */
export async function handleSettings(ctx: CommandContext): Promise<void> {
	const settingsText = t("settings", ctx.language).replace(
		"Latviešu",
		ctx.language === "lv" ? "Latviešu" : ctx.language === "ru" ? "Русский" : "English",
	);
	await ctx.bot.sendMessage(ctx.message.chat.id, settingsText);
}

/**
 * Handle /language command
 */
export async function handleLanguage(ctx: CommandContext): Promise<void> {
	await ctx.bot.sendMessageWithKeyboard(ctx.message.chat.id, t("language_prompt", ctx.language), [
		[
			{ text: "🇱🇻 Latviešu", callback_data: "lang:lv" },
			{ text: "🇷🇺 Русский", callback_data: "lang:ru" },
			{ text: "🇬🇧 English", callback_data: "lang:en" },
		],
	]);
}

/**
 * Handle language selection callback
 */
export async function handleLanguageCallback(
	bot: TelegramBotApi,
	chatId: number,
	newLanguage: SupportedLanguage,
): Promise<void> {
	await bot.sendMessage(chatId, t("language_changed", newLanguage));
}

/**
 * Handle unknown command
 */
export async function handleUnknownCommand(ctx: CommandContext): Promise<void> {
	await ctx.bot.sendMessage(ctx.message.chat.id, t("unknown_command", ctx.language));
}

/**
 * Command registry
 */
const commandHandlers: Record<string, CommandHandler> = {
	start: handleStart,
	help: handleHelp,
	settings: handleSettings,
	language: handleLanguage,
};

/**
 * Language shortcut commands
 */
const languageShortcuts: Record<string, SupportedLanguage> = {
	lv: "lv",
	ru: "ru",
	en: "en",
};

/**
 * Route command to appropriate handler
 */
export async function routeCommand(
	bot: TelegramBotApi,
	message: TelegramMessage,
	command: string,
	args: string,
	currentLanguage: SupportedLanguage,
	onLanguageChange?: (userId: number, language: SupportedLanguage) => Promise<void>,
): Promise<SupportedLanguage> {
	// Check if this is a language shortcut command
	if (command in languageShortcuts) {
		const newLang = languageShortcuts[command] as SupportedLanguage;
		await handleLanguageCallback(bot, message.chat.id, newLang);
		if (onLanguageChange && message.from) {
			await onLanguageChange(message.from.id, newLang);
		}
		return newLang;
	}

	const user = message.from;
	if (!user) {
		return currentLanguage;
	}

	const ctx: CommandContext = {
		bot,
		message,
		user,
		args,
		language: currentLanguage,
	};

	const handler = commandHandlers[command];
	if (handler) {
		await handler(ctx);
	} else {
		await handleUnknownCommand(ctx);
	}

	return currentLanguage;
}

/**
 * Detect language from message text using simple heuristics
 */
export function detectLanguage(text: string): SupportedLanguage | null {
	const lowerText = text.toLowerCase();

	// Check for Latvian specific characters
	if (/[āčēģīķļņšūž]/.test(lowerText)) {
		return "lv";
	}

	// Check for Cyrillic (Russian)
	if (/[а-яё]/i.test(text)) {
		return "ru";
	}

	// Default to null (caller should use current language)
	return null;
}

/**
 * Get language from user's Telegram language_code
 */
export function getLanguageFromTelegram(languageCode: string | undefined): SupportedLanguage {
	if (!languageCode) {
		return "en";
	}

	const code = languageCode.toLowerCase();

	if (code.startsWith("lv")) {
		return "lv";
	}
	if (code.startsWith("ru")) {
		return "ru";
	}

	return "en";
}
