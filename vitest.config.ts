import { defineWorkersConfig } from "@cloudflare/vitest-pool-workers/config";

export default defineWorkersConfig({
	test: {
		poolOptions: {
			workers: {
				wrangler: { configPath: "./wrangler.jsonc" },
				miniflare: {
					d1Databases: ["DB"],
					kvNamespaces: ["RATE_LIMIT_KV"],
					r2Buckets: ["ASSETS"],
					durableObjects: {
						TENANT_AGENT: "TenantAgent",
					},
					// Queue bindings (mocked — messages are captured, not sent)
					queueProducers: {
						AUDIT_QUEUE: "global-claw-audit",
						NOTIFICATION_QUEUE: "global-claw-notifications",
					},
					// Workers AI and Vectorize are NOT available in Miniflare.
					// Tests that touch AI/Vectorize must use mocks from tests/helpers/mocks.ts.
					// The Env type still expects these bindings, so test setup injects stubs.
				},
			},
		},
		globals: true,
		include: ["tests/**/*.test.ts"],
		coverage: {
			provider: "v8",
			reporter: ["text", "json-summary"],
			include: ["src/**/*.ts"],
			exclude: ["src/dashboard/**", "src/types/**"],
			thresholds: {
				statements: 70,
				branches: 60,
				functions: 70,
				lines: 70,
			},
		},
	},
});
