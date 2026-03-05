/**
 * API Key Utilities for Global-Claw
 * SHA-256 hash verification for API keys
 *
 * Key format: gc_[live|test]_[32 hex chars]
 * Storage: Only SHA-256 hash is stored in D1
 */

import type { D1Database } from "@cloudflare/workers-types";
import type { TenantContext, TenantRole } from "../../types";
import { sha256 } from "../crypto";
import { AuthError } from "../errors";

/**
 * API key prefixes
 */
export const API_KEY_PREFIX = {
	LIVE: "gc_live_",
	TEST: "gc_test_",
} as const;

/**
 * Generate a new API key
 * @returns The full API key (only returned once, never stored)
 */
export function generateApiKey(isTest = false): string {
	const prefix = isTest ? API_KEY_PREFIX.TEST : API_KEY_PREFIX.LIVE;
	const randomPart = crypto.randomUUID().replace(/-/g, "");
	return `${prefix}${randomPart}`;
}

/**
 * Hash an API key for storage
 */
export async function hashApiKey(apiKey: string): Promise<string> {
	return sha256(apiKey);
}

/**
 * Validate API key format
 */
export function isValidApiKeyFormat(apiKey: string): boolean {
	// Must start with gc_live_ or gc_test_
	if (!apiKey.startsWith(API_KEY_PREFIX.LIVE) && !apiKey.startsWith(API_KEY_PREFIX.TEST)) {
		return false;
	}

	// Must have exactly 32 hex chars after prefix
	const prefix = apiKey.startsWith(API_KEY_PREFIX.LIVE) ? API_KEY_PREFIX.LIVE : API_KEY_PREFIX.TEST;
	const randomPart = apiKey.slice(prefix.length);

	return /^[a-f0-9]{32}$/.test(randomPart);
}

/**
 * API key record from database
 */
interface ApiKeyRecord {
	id: string;
	tenant_id: string;
	name: string;
	key_hash: string;
	scopes: string;
	is_active: number;
	last_used_at: string | null;
	created_by: string;
}

/**
 * Verify an API key and return tenant context
 * @throws AuthError if key is invalid or inactive
 */
export async function verifyApiKey(apiKey: string, db: D1Database): Promise<TenantContext> {
	// Validate format
	if (!isValidApiKeyFormat(apiKey)) {
		throw new AuthError("Invalid API key format");
	}

	// Hash the key
	const keyHash = await hashApiKey(apiKey);

	// Look up in database
	const result = await db
		.prepare(
			`
			SELECT
				ak.id,
				ak.tenant_id,
				ak.name,
				ak.key_hash,
				ak.scopes,
				ak.is_active,
				ak.created_by,
				t.status as tenant_status,
				t.plan
			FROM api_keys ak
			JOIN tenants t ON t.id = ak.tenant_id
			WHERE ak.key_hash = ?
		`,
		)
		.bind(keyHash)
		.first<ApiKeyRecord & { tenant_status: string; plan: string }>();

	if (!result) {
		throw new AuthError("Invalid API key");
	}

	// Check if key is active
	if (!result.is_active) {
		throw new AuthError("API key is disabled");
	}

	// Check if tenant is active
	if (result.tenant_status !== "active") {
		throw new AuthError("Tenant is not active");
	}

	// Update last used timestamp (fire and forget)
	db.prepare("UPDATE api_keys SET last_used_at = datetime('now') WHERE id = ?").bind(result.id).run();

	// Parse scopes
	const scopes = JSON.parse(result.scopes) as string[];

	return {
		user_id: result.created_by,
		tenant_id: result.tenant_id,
		role: "api_key" as TenantRole,
		plan: result.plan,
		api_key_id: result.id,
		scopes,
	};
}

/**
 * Check if context has required scope
 */
export function hasScope(context: TenantContext, requiredScope: string): boolean {
	if (!context.scopes) return false;

	// Check exact match or wildcard
	return context.scopes.some((scope) => {
		if (scope === requiredScope) return true;
		// Check wildcard (e.g., "agents.*" matches "agents.read")
		if (scope.endsWith(".*")) {
			const prefix = scope.slice(0, -1);
			return requiredScope.startsWith(prefix);
		}
		return false;
	});
}

/**
 * Common API key scopes
 */
export const API_SCOPES = {
	// Agents
	AGENTS_READ: "agents.read",
	AGENTS_WRITE: "agents.write",

	// Conversations
	CONVERSATIONS_READ: "conversations.read",
	CONVERSATIONS_WRITE: "conversations.write",

	// Workflows
	WORKFLOWS_READ: "workflows.read",
	WORKFLOWS_WRITE: "workflows.write",

	// Memory
	MEMORY_READ: "memory.read",
	MEMORY_WRITE: "memory.write",

	// Admin
	ADMIN_READ: "admin.read",
	ADMIN_WRITE: "admin.write",
} as const;
