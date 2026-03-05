#!/usr/bin/env node
// Cross-platform D1 migration runner (works on Windows + Linux)
// Usage: node scripts/migrate.mjs [local|staging|production]

import { execSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { join } from "node:path";

const env = process.argv[2] || "local";
const migrationsDir = join(process.cwd(), "migrations");

const files = readdirSync(migrationsDir)
	.filter((f) => f.endsWith(".sql"))
	.sort();

console.info(`Applying ${files.length} migrations to ${env}...`);

for (const file of files) {
	const filePath = join(migrationsDir, file);
	const envFlag = env === "local" ? "--local" : `--env ${env} --remote`;
	const cmd = `npx wrangler d1 execute global-claw-primary ${envFlag} --file="${filePath}"`;
	console.info(`  → ${file}`);
	try {
		execSync(cmd, { stdio: "inherit" });
	} catch (_err) {
		console.error(`  ✗ Failed: ${file}`);
		process.exit(1);
	}
}

console.info(`✓ All ${files.length} migrations applied to ${env}`);
