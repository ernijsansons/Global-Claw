/**
 * LLM Router Tests
 * Phase 3: Provider-agnostic routing
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { LLMRouter, type RouterContext, createRouter } from "../../src/lib/llm/router";

// Mock D1 database
const mockDb = {
	prepare: vi.fn(),
};

const createMockStatement = (results: unknown[] = []) => ({
	bind: vi.fn().mockReturnThis(),
	all: vi.fn().mockResolvedValue({ results }),
	first: vi.fn().mockResolvedValue(results[0] ?? null),
});

describe("LLMRouter", () => {
	let router: LLMRouter;
	let healthMap: Map<string, boolean>;

	beforeEach(() => {
		vi.clearAllMocks();
		healthMap = new Map();
		router = new LLMRouter(mockDb as unknown as D1Database, healthMap);
	});

	describe("route()", () => {
		it("should return default route when no rules match", async () => {
			// Mock no rules
			mockDb.prepare.mockReturnValueOnce(
				createMockStatement([]), // No rules
			);

			// Mock default provider
			mockDb.prepare.mockReturnValueOnce(
				createMockStatement([
					{
						id: "prov_1",
						name: "Default Provider",
						slug: "default",
						api_base_url: "https://api.example.com",
						models_json: '["model-1", "model-2"]',
						is_enabled: 1,
						weight: 100,
					},
				]),
			);

			const context: RouterContext = {
				tenant_id: "tenant-1",
				task_type: "chat",
			};

			const result = await router.route(context);

			expect(result.provider.slug).toBe("default");
			expect(result.model).toBe("model-1");
			expect(result.reason).toContain("default");
			expect(result.fallbacks).toHaveLength(0);
		});

		it("should match rules by field conditions", async () => {
			// Mock rules with field condition
			mockDb.prepare.mockReturnValueOnce(
				createMockStatement([
					{
						id: "rule_1",
						name: "Complex Reasoning Rule",
						priority: 10,
						condition_json: '{"field":"task_type","operator":"eq","value":"reasoning"}',
						routes_json: '[{"provider_slug":"anthropic","model":"claude-sonnet-4","weight":100}]',
						is_enabled: 1,
					},
				]),
			);

			// Mock provider lookup
			mockDb.prepare.mockReturnValueOnce(
				createMockStatement([
					{
						id: "prov_anthropic",
						name: "Anthropic",
						slug: "anthropic",
						api_base_url: "https://api.anthropic.com/v1",
						models_json: '["claude-sonnet-4"]',
						is_enabled: 1,
					},
				]),
			);

			const context: RouterContext = {
				tenant_id: "tenant-1",
				task_type: "reasoning",
			};

			const result = await router.route(context);

			expect(result.provider.slug).toBe("anthropic");
			expect(result.model).toBe("claude-sonnet-4");
			expect(result.reason).toContain("Complex Reasoning Rule");
		});

		it("should respect provider health status", async () => {
			// Mock rules
			mockDb.prepare.mockReturnValueOnce(
				createMockStatement([
					{
						id: "rule_1",
						name: "Multi-Provider Rule",
						priority: 10,
						condition_json: "{}",
						routes_json:
							'[{"provider_slug":"anthropic","model":"claude","weight":80},{"provider_slug":"openai","model":"gpt-4","weight":20}]',
						is_enabled: 1,
					},
				]),
			);

			// Mock provider lookups
			mockDb.prepare.mockReturnValueOnce(
				createMockStatement([
					{
						id: "prov_anthropic",
						name: "Anthropic",
						slug: "anthropic",
						api_base_url: "https://api.anthropic.com/v1",
						models_json: '["claude"]',
						is_enabled: 1,
					},
				]),
			);

			mockDb.prepare.mockReturnValueOnce(
				createMockStatement([
					{
						id: "prov_openai",
						name: "OpenAI",
						slug: "openai",
						api_base_url: "https://api.openai.com/v1",
						models_json: '["gpt-4"]',
						is_enabled: 1,
					},
				]),
			);

			// Mark anthropic as unhealthy
			healthMap.set("prov_anthropic", false);
			healthMap.set("prov_openai", true);

			const context: RouterContext = {
				tenant_id: "tenant-1",
			};

			const result = await router.route(context);

			// Should only return healthy provider (openai)
			expect(result.provider.slug).toBe("openai");
		});

		it("should build fallback list from healthy providers", async () => {
			// Mock rules
			mockDb.prepare.mockReturnValueOnce(
				createMockStatement([
					{
						id: "rule_1",
						name: "Multi-Provider Rule",
						priority: 10,
						condition_json: "{}",
						routes_json:
							'[{"provider_slug":"anthropic","model":"claude","weight":50},{"provider_slug":"openai","model":"gpt-4","weight":30},{"provider_slug":"qwen","model":"qwen-max","weight":20}]',
						is_enabled: 1,
					},
				]),
			);

			// Mock all provider lookups
			mockDb.prepare.mockReturnValueOnce(
				createMockStatement([{ id: "prov_anthropic", slug: "anthropic", models_json: '["claude"]', is_enabled: 1 }]),
			);
			mockDb.prepare.mockReturnValueOnce(
				createMockStatement([{ id: "prov_openai", slug: "openai", models_json: '["gpt-4"]', is_enabled: 1 }]),
			);
			mockDb.prepare.mockReturnValueOnce(
				createMockStatement([{ id: "prov_qwen", slug: "qwen", models_json: '["qwen-max"]', is_enabled: 1 }]),
			);

			// All providers healthy
			healthMap.set("prov_anthropic", true);
			healthMap.set("prov_openai", true);
			healthMap.set("prov_qwen", true);

			const context: RouterContext = {
				tenant_id: "tenant-1",
			};

			const result = await router.route(context);

			// Should have fallbacks (excluding selected provider)
			expect(result.fallbacks.length).toBeGreaterThan(0);
			expect(result.fallbacks.every((f) => f.provider.slug !== result.provider.slug)).toBe(true);
		});
	});

	describe("updateHealth()", () => {
		it("should update provider health status", () => {
			router.updateHealth("prov_1", false);
			expect(healthMap.get("prov_1")).toBe(false);

			router.updateHealth("prov_1", true);
			expect(healthMap.get("prov_1")).toBe(true);
		});
	});

	describe("clearCache()", () => {
		it("should clear provider cache", () => {
			// This is mainly for testing the method doesn't throw
			router.clearCache();
		});
	});
});

describe("createRouter()", () => {
	it("should create a router instance", () => {
		const router = createRouter(mockDb as unknown as D1Database);
		expect(router).toBeInstanceOf(LLMRouter);
	});

	it("should accept health map", () => {
		const healthMap = new Map([["prov_1", false]]);
		const router = createRouter(mockDb as unknown as D1Database, healthMap);
		expect(router).toBeInstanceOf(LLMRouter);
	});
});
