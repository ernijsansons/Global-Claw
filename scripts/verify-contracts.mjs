#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

let failed = false;

function ok(message) {
	console.info(`\u2713 ${message}`);
}

function warn(message) {
	console.warn(`\u26a0 ${message}`);
}

function fail(message) {
	console.error(`\u2717 ${message}`);
	failed = true;
}

function requireFile(path) {
	if (!existsSync(path)) {
		fail(`Missing file: ${path}`);
		return "";
	}
	return readFileSync(path, "utf8");
}

function parseJsonc(path) {
	const raw = requireFile(path);
	if (!raw) return null;
	const withoutBlockComments = raw.replace(/\/\*[\s\S]*?\*\//g, "");
	const withoutLineComments = withoutBlockComments.replace(/^\s*\/\/.*$/gm, "");
	const withoutTrailingCommas = withoutLineComments.replace(/,\s*([}\]])/g, "$1");
	try {
		return JSON.parse(withoutTrailingCommas);
	} catch (error) {
		fail(`Could not parse ${path} as JSONC: ${error instanceof Error ? error.message : String(error)}`);
		return null;
	}
}

const root = process.cwd();

// 1) Migration contract
const migrations = [
	"migrations/0001_init.sql",
	"migrations/0002_llm_providers.sql",
	"migrations/0003_agents_memory.sql",
	"migrations/0004_operational.sql",
];

for (const file of migrations) {
	if (!existsSync(join(root, file))) {
		fail(`Missing migration: ${file}`);
	}
}

const m1 = requireFile("migrations/0001_init.sql");
const m2 = requireFile("migrations/0002_llm_providers.sql");
const m3 = requireFile("migrations/0003_agents_memory.sql");
const m4 = requireFile("migrations/0004_operational.sql");

if (m1 && !m1.includes("'deleted'")) {
	fail("0001_init.sql must include tenant status 'deleted' for soft-delete.");
}
if (m2 && !m2.includes("CREATE TABLE IF NOT EXISTS llm_providers")) {
	fail("0002_llm_providers.sql missing llm_providers table.");
}
if (m2 && !m2.includes("PLACEHOLDER_ENCRYPT_ME")) {
	warn("0002_llm_providers.sql does not include placeholder keys; verify provider seed strategy.");
}
if (m2 && !/,\s*0\)\s*;?\s*$/m.test(m2)) {
	warn("Could not confirm provider seeds are disabled by default (is_enabled=0).");
}
if (m3 && !m3.includes("CREATE TABLE IF NOT EXISTS plugin_connections")) {
	fail("0003_agents_memory.sql must define plugin_connections table.");
}
if (m3?.includes("plugin_tokens")) {
	fail("0003_agents_memory.sql should not define plugin_tokens; use plugin_connections.");
}
if (m4 && !m4.includes("CREATE TABLE IF NOT EXISTS audit_log")) {
	fail("0004_operational.sql missing audit_log table.");
}
if (m4 && !m4.includes("CREATE TABLE IF NOT EXISTS stripe_events")) {
	fail("0004_operational.sql missing stripe_events table.");
}

if (!failed) {
	ok("Migration contract: 0001..0004 present and core tables validated.");
}

// 2) Package/dependency contract
const pkgRaw = requireFile("package.json");
if (pkgRaw) {
	try {
		const pkg = JSON.parse(pkgRaw);
		const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
		for (const dep of ["hono", "drizzle-orm", "zod", "@hono/zod-openapi", "agents", "vitest", "wrangler"]) {
			if (!deps[dep]) fail(`Missing dependency: ${dep}`);
		}
		for (const script of [
			"db:migrate:local",
			"db:migrate:staging",
			"db:migrate:production",
			"verify:contracts",
			"test:integration",
		]) {
			if (!pkg.scripts?.[script]) fail(`Missing package script: ${script}`);
		}
		if (!failed) ok("Package contract: dependencies and scripts are present.");
	} catch (error) {
		fail(`Could not parse package.json: ${error instanceof Error ? error.message : String(error)}`);
	}
}

// 3) Wrangler binding contract
const wrangler = parseJsonc("wrangler.jsonc");
if (wrangler) {
	for (const key of [
		"durable_objects",
		"d1_databases",
		"r2_buckets",
		"kv_namespaces",
		"queues",
		"vectorize",
		"workflows",
	]) {
		if (!wrangler[key]) fail(`wrangler.jsonc missing root binding: ${key}`);
	}

	for (const envName of ["staging", "production"]) {
		const env = wrangler.env?.[envName];
		if (!env) {
			fail(`wrangler.jsonc missing env.${envName}`);
			continue;
		}
		for (const key of ["d1_databases", "r2_buckets", "kv_namespaces", "queues", "vectorize", "vars"]) {
			if (!env[key]) fail(`wrangler.jsonc env.${envName} missing ${key}`);
		}
	}

	const prodDbId = wrangler.env?.production?.d1_databases?.[0]?.database_id;
	const prodKvId = wrangler.env?.production?.kv_namespaces?.[0]?.id;
	if (typeof prodDbId === "string" && prodDbId.includes("TBD")) {
		warn("Production D1 database_id is still placeholder (TBD). Fill before production deploy.");
	}
	if (typeof prodKvId === "string" && prodKvId.includes("TBD")) {
		warn("Production KV id is still placeholder (TBD). Fill before production deploy.");
	}

	if (!failed) ok("Wrangler contract: required root/env bindings are present.");
}

// 4) Secrets/env contract
const envExample = requireFile(".env.example");
if (envExample) {
	for (const key of [
		"JWT_SECRET=",
		"ENCRYPTION_KEY=",
		"STRIPE_SECRET_KEY=",
		"STRIPE_WEBHOOK_SECRET=",
		"TELEGRAM_WEBHOOK_SECRET=",
	]) {
		if (!envExample.includes(key)) fail(`.env.example missing ${key}`);
	}
	if (!failed) ok("Env contract: required secret keys documented in .env.example.");
}

// 5) Route/doc contract spot checks
const claude = requireFile("CLAUDE.md");
const skill = requireFile(".claude/skills/global-claw-execution/SKILL.md");
if (claude && skill) {
	for (const route of ["/api/ws", "/tg/webhook/:agentId", "/api/auth/register", "/api/stripe/webhook"]) {
		if (!claude.includes(route)) fail(`CLAUDE.md missing route contract: ${route}`);
		if (!skill.includes(route)) fail(`Execution skill missing route contract: ${route}`);
	}
	if (!failed) ok("Route contract: core routes aligned between CLAUDE.md and execution skill.");
}

if (failed) {
	process.exit(1);
}

console.info("Contract verification passed.");
