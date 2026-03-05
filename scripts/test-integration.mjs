#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";

if (!existsSync("tests/integration")) {
	console.info("No tests/integration directory found. Skipping integration tests.");
	process.exit(0);
}

const result = spawnSync("npx", ["vitest", "run", "tests/integration", "--passWithNoTests"], {
	stdio: "inherit",
	shell: process.platform === "win32",
});

if (typeof result.status === "number") {
	process.exit(result.status);
}

process.exit(1);
