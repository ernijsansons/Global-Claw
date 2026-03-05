/**
 * Telegram Module Tests
 * Phase 5: Telegram Integration
 */

import { describe, expect, it } from "vitest";
import { escapeMarkdownV2, extractCommand } from "../../src/telegram/bot-api";
import { detectLanguage, getLanguageFromTelegram, t } from "../../src/telegram/commands";

describe("Telegram Bot API", () => {
	describe("extractCommand()", () => {
		it("should extract command and args from message text", () => {
			const result = extractCommand("/start hello world");

			expect(result).toEqual({
				command: "start",
				args: "hello world",
			});
		});

		it("should extract command without args", () => {
			const result = extractCommand("/help");

			expect(result).toEqual({
				command: "help",
				args: "",
			});
		});

		it("should return null for non-command messages", () => {
			const result = extractCommand("Hello, how are you?");

			expect(result).toBeNull();
		});

		it("should handle command with @bot suffix", () => {
			const result = extractCommand("/start@mybot some args");

			expect(result).toEqual({
				command: "start",
				args: "some args",
			});
		});

		it("should convert command to lowercase", () => {
			const result = extractCommand("/START");

			expect(result).toEqual({
				command: "start",
				args: "",
			});
		});

		it("should handle multiple spaces between args", () => {
			const result = extractCommand("/test  multiple   spaces");

			expect(result).toEqual({
				command: "test",
				args: "multiple spaces",
			});
		});
	});

	describe("escapeMarkdownV2()", () => {
		it("should escape special characters", () => {
			const text = "Hello *world* _test_ [link](url)";
			const escaped = escapeMarkdownV2(text);

			expect(escaped).toBe("Hello \\*world\\* \\_test\\_ \\[link\\]\\(url\\)");
		});

		it("should escape code block characters", () => {
			const text = "`code` ```block```";
			const escaped = escapeMarkdownV2(text);

			expect(escaped).toBe("\\`code\\` \\`\\`\\`block\\`\\`\\`");
		});

		it("should escape mathematical symbols", () => {
			// Note: < is not escaped in MarkdownV2, only > is
			const text = "5 > 3 and 2 < 4, also ~test~";
			const escaped = escapeMarkdownV2(text);

			expect(escaped).toBe("5 \\> 3 and 2 < 4, also \\~test\\~");
		});

		it("should return empty string for empty input", () => {
			expect(escapeMarkdownV2("")).toBe("");
		});
	});
});

describe("Telegram Commands", () => {
	describe("t() localization", () => {
		it("should return Latvian translation", () => {
			const welcome = t("welcome", "lv");

			expect(welcome).toContain("Sveiki");
		});

		it("should return Russian translation", () => {
			const welcome = t("welcome", "ru");

			expect(welcome).toContain("Привет");
		});

		it("should return English translation", () => {
			const welcome = t("welcome", "en");

			expect(welcome).toContain("Hello");
		});

		it("should fall back to key if translation missing", () => {
			const unknown = t("nonexistent_key", "en");

			expect(unknown).toBe("nonexistent_key");
		});
	});

	describe("detectLanguage()", () => {
		it("should detect Latvian from special characters", () => {
			const lang = detectLanguage("Šis ir teksts latviešu valodā");

			expect(lang).toBe("lv");
		});

		it("should detect Russian from Cyrillic", () => {
			const lang = detectLanguage("Привет, как дела?");

			expect(lang).toBe("ru");
		});

		it("should return null for English text", () => {
			const lang = detectLanguage("Hello, how are you?");

			expect(lang).toBeNull();
		});

		it("should detect Latvian letters", () => {
			const letters = ["ā", "č", "ē", "ģ", "ī", "ķ", "ļ", "ņ", "š", "ū", "ž"];

			for (const letter of letters) {
				expect(detectLanguage(`Word with ${letter}`)).toBe("lv");
			}
		});
	});

	describe("getLanguageFromTelegram()", () => {
		it("should return lv for Latvian language code", () => {
			expect(getLanguageFromTelegram("lv")).toBe("lv");
			expect(getLanguageFromTelegram("lv-LV")).toBe("lv");
		});

		it("should return ru for Russian language code", () => {
			expect(getLanguageFromTelegram("ru")).toBe("ru");
			expect(getLanguageFromTelegram("ru-RU")).toBe("ru");
		});

		it("should return en for English language code", () => {
			expect(getLanguageFromTelegram("en")).toBe("en");
			expect(getLanguageFromTelegram("en-US")).toBe("en");
			expect(getLanguageFromTelegram("en-GB")).toBe("en");
		});

		it("should default to en for unknown language codes", () => {
			expect(getLanguageFromTelegram("de")).toBe("en");
			expect(getLanguageFromTelegram("fr")).toBe("en");
			expect(getLanguageFromTelegram("es")).toBe("en");
		});

		it("should default to en for undefined", () => {
			expect(getLanguageFromTelegram(undefined)).toBe("en");
		});
	});
});
