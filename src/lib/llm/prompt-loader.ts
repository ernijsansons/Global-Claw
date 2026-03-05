/**
 * Prompt Loader
 * Versioned prompt template management
 *
 * Loads prompt templates from the prompts/ directory
 * with support for versioning, i18n, and variable substitution.
 */

import type { R2Bucket } from "@cloudflare/workers-types";

/**
 * Prompt template metadata
 */
export interface PromptTemplate {
	id: string;
	name: string;
	version: string;
	language: string;
	content: string;
	variables: string[];
	created_at: string;
}

/**
 * Prompt loader options
 */
export interface PromptLoaderOptions {
	/** Default language */
	defaultLanguage?: string;
	/** Cache TTL in ms */
	cacheTtl?: number;
}

/**
 * Variable substitution context
 */
export interface PromptContext {
	/** User's name */
	user_name?: string;
	/** Agent's name */
	agent_name?: string;
	/** Tenant's name */
	tenant_name?: string;
	/** Current date */
	current_date?: string;
	/** Current time */
	current_time?: string;
	/** Language */
	language?: string;
	/** Custom variables */
	[key: string]: string | undefined;
}

/**
 * Built-in prompt templates
 */
const BUILTIN_PROMPTS: Record<string, Record<string, string>> = {
	system_default: {
		en: `You are a helpful AI assistant for {{tenant_name}}.
Your name is {{agent_name}}.
Current date: {{current_date}}

Be concise, helpful, and professional.`,
		lv: `Tu esi palīdzīgs AI asistents {{tenant_name}}.
Tavs vārds ir {{agent_name}}.
Šodienas datums: {{current_date}}

Esi kodolīgs, palīdzīgs un profesionāls.`,
		ru: `Вы полезный AI-ассистент для {{tenant_name}}.
Ваше имя {{agent_name}}.
Текущая дата: {{current_date}}

Будьте кратким, полезным и профессиональным.`,
	},
	welcome_message: {
		en: `Hello {{user_name}}! I'm {{agent_name}}, your AI assistant. How can I help you today?`,
		lv: "Sveiki {{user_name}}! Es esmu {{agent_name}}, jūsu AI asistents. Kā varu jums šodien palīdzēt?",
		ru: "Здравствуйте {{user_name}}! Я {{agent_name}}, ваш AI-ассистент. Чем могу вам помочь сегодня?",
	},
	error_message: {
		en: "I apologize, but I encountered an issue processing your request. Please try again or contact support if the problem persists.",
		lv: "Atvainojos, bet man radās problēma, apstrādājot jūsu pieprasījumu. Lūdzu, mēģiniet vēlreiz vai sazinieties ar atbalsta dienestu, ja problēma turpinās.",
		ru: "Приношу извинения, но при обработке вашего запроса возникла проблема. Пожалуйста, попробуйте еще раз или свяжитесь со службой поддержки, если проблема не исчезнет.",
	},
	fallback_response: {
		en: `I'm not sure I understand. Could you please rephrase your question?`,
		lv: "Neesmu pārliecināts, vai saprotu. Vai varētu, lūdzu, pārformulēt savu jautājumu?",
		ru: "Я не уверен, что понимаю. Не могли бы вы перефразировать свой вопрос?",
	},
};

/**
 * Prompt Loader
 * Manages prompt templates with caching and versioning
 */
export class PromptLoader {
	private r2?: R2Bucket;
	private cache: Map<string, { template: string; expiresAt: number }>;
	private options: PromptLoaderOptions;

	constructor(r2?: R2Bucket, options?: PromptLoaderOptions) {
		this.r2 = r2;
		this.cache = new Map();
		this.options = {
			defaultLanguage: "en",
			cacheTtl: 300000, // 5 minutes
			...options,
		};
	}

	/**
	 * Load a prompt template
	 */
	async load(promptId: string, language?: string, version?: string): Promise<string> {
		const lang = language ?? this.options.defaultLanguage ?? "en";
		const cacheKey = `${promptId}:${lang}:${version ?? "latest"}`;

		// Check cache
		const cached = this.cache.get(cacheKey);
		if (cached && cached.expiresAt > Date.now()) {
			return cached.template;
		}

		// Try to load from R2 if available
		if (this.r2) {
			try {
				const r2Key = version ? `prompts/${promptId}/${version}/${lang}.txt` : `prompts/${promptId}/latest/${lang}.txt`;

				const object = await this.r2.get(r2Key);
				if (object) {
					const template = await object.text();
					this.cacheTemplate(cacheKey, template);
					return template;
				}
			} catch {
				// Fall through to built-in prompts
			}
		}

		// Fall back to built-in prompts
		const builtinPrompt = BUILTIN_PROMPTS[promptId];
		if (builtinPrompt) {
			const template = builtinPrompt[lang] ?? builtinPrompt.en ?? "";
			this.cacheTemplate(cacheKey, template);
			return template;
		}

		throw new Error(`Prompt not found: ${promptId}`);
	}

	/**
	 * Render a prompt with variable substitution
	 */
	async render(promptId: string, context: PromptContext, language?: string, version?: string): Promise<string> {
		const template = await this.load(promptId, language, version);
		return this.substitute(template, context);
	}

	/**
	 * Substitute variables in a template
	 */
	substitute(template: string, context: PromptContext): string {
		// Add default context values
		const fullContext: PromptContext = {
			current_date: new Date().toLocaleDateString(),
			current_time: new Date().toLocaleTimeString(),
			...context,
		};

		// Replace {{variable}} patterns
		return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
			const value = fullContext[key];
			return value !== undefined ? value : match;
		});
	}

	/**
	 * Extract variables from a template
	 */
	extractVariables(template: string): string[] {
		const matches = template.matchAll(/\{\{(\w+)\}\}/g);
		const variables = new Set<string>();
		for (const match of matches) {
			const varName = match[1];
			if (varName) {
				variables.add(varName);
			}
		}
		return Array.from(variables);
	}

	/**
	 * Get all built-in prompt IDs
	 */
	getBuiltinPromptIds(): string[] {
		return Object.keys(BUILTIN_PROMPTS);
	}

	/**
	 * Get available languages for a prompt
	 */
	getAvailableLanguages(promptId: string): string[] {
		const builtinPrompt = BUILTIN_PROMPTS[promptId];
		if (builtinPrompt) {
			return Object.keys(builtinPrompt);
		}
		return [];
	}

	/**
	 * Clear the cache
	 */
	clearCache(): void {
		this.cache.clear();
	}

	/**
	 * Cache a template
	 */
	private cacheTemplate(key: string, template: string): void {
		this.cache.set(key, {
			template,
			expiresAt: Date.now() + (this.options.cacheTtl ?? 300000),
		});
	}
}

/**
 * Create a prompt loader instance
 */
export function createPromptLoader(r2?: R2Bucket, options?: PromptLoaderOptions): PromptLoader {
	return new PromptLoader(r2, options);
}
