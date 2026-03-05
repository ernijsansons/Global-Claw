/**
 * LLM Providers API Routes
 * Admin CRUD operations for LLM provider management
 *
 * All routes require admin authentication.
 */

import { Hono } from "hono";
import { encrypt } from "../lib/crypto";
import { getCircuitBreaker } from "../lib/llm/circuit-breaker";
import type { ApiResponse, LLMProvider, Pagination } from "../types";
import type { Env } from "../types/env";

const providers = new Hono<{ Bindings: Env }>();

// ============================================================================
// List Providers
// GET /api/providers
// ============================================================================

providers.get("/", async (c) => {
	const page = Number.parseInt(c.req.query("page") ?? "1", 10);
	const limit = Math.min(Number.parseInt(c.req.query("limit") ?? "20", 10), 100);
	const offset = (page - 1) * limit;
	const enabledOnly = c.req.query("enabled") === "true";

	let query = "SELECT * FROM llm_providers";
	const params: unknown[] = [];

	if (enabledOnly) {
		query += " WHERE is_enabled = 1";
	}

	query += " ORDER BY weight DESC, created_at ASC LIMIT ? OFFSET ?";
	params.push(limit, offset);

	const result = await c.env.DB.prepare(query)
		.bind(...params)
		.all<LLMProvider>();

	// Get total count
	const countQuery = enabledOnly
		? "SELECT COUNT(*) as count FROM llm_providers WHERE is_enabled = 1"
		: "SELECT COUNT(*) as count FROM llm_providers";
	const countResult = await c.env.DB.prepare(countQuery).first<{ count: number }>();
	const total = countResult?.count ?? 0;

	// Get circuit breaker states
	const circuitBreaker = getCircuitBreaker();
	const healthStates = circuitBreaker.getAllStates();

	// Enrich providers with health info (without exposing API keys)
	const enrichedProviders = (result.results ?? []).map((provider) => {
		const health = healthStates.get(provider.id);
		return {
			...provider,
			api_key_encrypted: undefined, // Never expose encrypted key
			circuit_state: health?.state ?? "closed",
			health_score: health?.health_score ?? 1.0,
		};
	});

	const pagination: Pagination = {
		page,
		limit,
		total,
		has_more: offset + limit < total,
	};

	const response: ApiResponse<typeof enrichedProviders> = {
		success: true,
		data: enrichedProviders,
		meta: pagination,
	};

	return c.json(response);
});

// ============================================================================
// Get Single Provider
// GET /api/providers/:id
// ============================================================================

providers.get("/:id", async (c) => {
	const id = c.req.param("id");

	const provider = await c.env.DB.prepare("SELECT * FROM llm_providers WHERE id = ?").bind(id).first<LLMProvider>();

	if (!provider) {
		return c.json(
			{
				success: false,
				error: { code: "NOT_FOUND", message: "Provider not found" },
			},
			404,
		);
	}

	// Get circuit breaker state
	const circuitBreaker = getCircuitBreaker();
	const health = circuitBreaker.getState(provider.id);

	const enrichedProvider = {
		...provider,
		api_key_encrypted: undefined, // Never expose encrypted key
		has_api_key: !!provider.api_key_encrypted && provider.api_key_encrypted !== "PLACEHOLDER_ENCRYPT_ME",
		circuit_state: health.state,
		health_score: health.health_score,
	};

	const response: ApiResponse<typeof enrichedProvider> = {
		success: true,
		data: enrichedProvider,
	};

	return c.json(response);
});

// ============================================================================
// Create Provider
// POST /api/providers
// ============================================================================

interface CreateProviderBody {
	name: string;
	slug: string;
	api_base_url: string;
	api_key: string;
	models_json?: string;
	cost_per_1m_input_cents?: number;
	cost_per_1m_output_cents?: number;
	cost_tier?: "budget" | "standard" | "premium";
	weight?: number;
	max_requests_per_min?: number;
	is_enabled?: boolean;
}

providers.post("/", async (c) => {
	const body = await c.req.json<CreateProviderBody>();

	// Validate required fields
	if (!body.name || !body.slug || !body.api_base_url || !body.api_key) {
		return c.json(
			{
				success: false,
				error: { code: "VALIDATION_ERROR", message: "Missing required fields: name, slug, api_base_url, api_key" },
			},
			400,
		);
	}

	// Check for duplicate slug
	const existing = await c.env.DB.prepare("SELECT id FROM llm_providers WHERE slug = ?").bind(body.slug).first();

	if (existing) {
		return c.json(
			{
				success: false,
				error: { code: "DUPLICATE", message: "Provider with this slug already exists" },
			},
			409,
		);
	}

	// Encrypt API key
	const encryptedKey = await encrypt(body.api_key, c.env.ENCRYPTION_KEY);

	const id = crypto.randomUUID().replace(/-/g, "").slice(0, 32);

	await c.env.DB.prepare(
		`INSERT INTO llm_providers (
			id, name, slug, api_base_url, api_key_encrypted,
			models_json, cost_per_1m_input_cents, cost_per_1m_output_cents,
			cost_tier, weight, max_requests_per_min, is_enabled
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
	)
		.bind(
			id,
			body.name,
			body.slug,
			body.api_base_url,
			encryptedKey,
			body.models_json ?? "[]",
			body.cost_per_1m_input_cents ?? 0,
			body.cost_per_1m_output_cents ?? 0,
			body.cost_tier ?? "standard",
			body.weight ?? 50,
			body.max_requests_per_min ?? 60,
			body.is_enabled !== false ? 1 : 0,
		)
		.run();

	// Fetch the created provider
	const provider = await c.env.DB.prepare("SELECT * FROM llm_providers WHERE id = ?").bind(id).first<LLMProvider>();

	// Exclude api_key_encrypted from response
	const { api_key_encrypted: _, ...safeProvider } = provider!;

	return c.json(
		{
			success: true,
			data: {
				...safeProvider,
				has_api_key: true,
			},
		},
		201,
	);
});

// ============================================================================
// Update Provider
// PATCH /api/providers/:id
// ============================================================================

interface UpdateProviderBody {
	name?: string;
	api_base_url?: string;
	api_key?: string;
	models_json?: string;
	cost_per_1m_input_cents?: number;
	cost_per_1m_output_cents?: number;
	cost_tier?: "budget" | "standard" | "premium";
	weight?: number;
	max_requests_per_min?: number;
	is_enabled?: boolean;
}

providers.patch("/:id", async (c) => {
	const id = c.req.param("id");
	const body = await c.req.json<UpdateProviderBody>();

	// Check provider exists
	const existing = await c.env.DB.prepare("SELECT id FROM llm_providers WHERE id = ?").bind(id).first();

	if (!existing) {
		return c.json(
			{
				success: false,
				error: { code: "NOT_FOUND", message: "Provider not found" },
			},
			404,
		);
	}

	// Build update query
	const updates: string[] = [];
	const params: unknown[] = [];

	if (body.name !== undefined) {
		updates.push("name = ?");
		params.push(body.name);
	}
	if (body.api_base_url !== undefined) {
		updates.push("api_base_url = ?");
		params.push(body.api_base_url);
	}
	if (body.api_key !== undefined) {
		const encryptedKey = await encrypt(body.api_key, c.env.ENCRYPTION_KEY);
		updates.push("api_key_encrypted = ?");
		params.push(encryptedKey);
	}
	if (body.models_json !== undefined) {
		updates.push("models_json = ?");
		params.push(body.models_json);
	}
	if (body.cost_per_1m_input_cents !== undefined) {
		updates.push("cost_per_1m_input_cents = ?");
		params.push(body.cost_per_1m_input_cents);
	}
	if (body.cost_per_1m_output_cents !== undefined) {
		updates.push("cost_per_1m_output_cents = ?");
		params.push(body.cost_per_1m_output_cents);
	}
	if (body.cost_tier !== undefined) {
		updates.push("cost_tier = ?");
		params.push(body.cost_tier);
	}
	if (body.weight !== undefined) {
		updates.push("weight = ?");
		params.push(body.weight);
	}
	if (body.max_requests_per_min !== undefined) {
		updates.push("max_requests_per_min = ?");
		params.push(body.max_requests_per_min);
	}
	if (body.is_enabled !== undefined) {
		updates.push("is_enabled = ?");
		params.push(body.is_enabled ? 1 : 0);
	}

	if (updates.length === 0) {
		return c.json(
			{
				success: false,
				error: { code: "VALIDATION_ERROR", message: "No fields to update" },
			},
			400,
		);
	}

	updates.push("updated_at = datetime('now')");
	params.push(id);

	await c.env.DB.prepare(`UPDATE llm_providers SET ${updates.join(", ")} WHERE id = ?`)
		.bind(...params)
		.run();

	// Fetch updated provider
	const provider = await c.env.DB.prepare("SELECT * FROM llm_providers WHERE id = ?").bind(id).first<LLMProvider>();

	// Exclude api_key_encrypted from response
	const { api_key_encrypted, ...safeProvider } = provider!;

	return c.json({
		success: true,
		data: {
			...safeProvider,
			has_api_key: !!api_key_encrypted && api_key_encrypted !== "PLACEHOLDER_ENCRYPT_ME",
		},
	});
});

// ============================================================================
// Delete Provider
// DELETE /api/providers/:id
// ============================================================================

providers.delete("/:id", async (c) => {
	const id = c.req.param("id");

	// Check provider exists
	const existing = await c.env.DB.prepare("SELECT id FROM llm_providers WHERE id = ?").bind(id).first();

	if (!existing) {
		return c.json(
			{
				success: false,
				error: { code: "NOT_FOUND", message: "Provider not found" },
			},
			404,
		);
	}

	// Check if provider is referenced in routing rules
	const rulesResult = await c.env.DB.prepare("SELECT COUNT(*) as count FROM llm_routing_rules WHERE routes_json LIKE ?")
		.bind(`%"provider_id":"${id}"%`)
		.first<{ count: number }>();

	if (rulesResult && rulesResult.count > 0) {
		return c.json(
			{
				success: false,
				error: {
					code: "REFERENCE_ERROR",
					message: "Provider is referenced in routing rules. Remove from rules first.",
				},
			},
			409,
		);
	}

	await c.env.DB.prepare("DELETE FROM llm_providers WHERE id = ?").bind(id).run();

	// Reset circuit breaker for this provider
	const circuitBreaker = getCircuitBreaker();
	circuitBreaker.reset(id);

	return c.json({ success: true, data: { deleted: true } });
});

// ============================================================================
// Reset Provider Circuit Breaker
// POST /api/providers/:id/reset-circuit
// ============================================================================

providers.post("/:id/reset-circuit", async (c) => {
	const id = c.req.param("id");

	// Check provider exists
	const existing = await c.env.DB.prepare("SELECT id FROM llm_providers WHERE id = ?").bind(id).first();

	if (!existing) {
		return c.json(
			{
				success: false,
				error: { code: "NOT_FOUND", message: "Provider not found" },
			},
			404,
		);
	}

	const circuitBreaker = getCircuitBreaker();
	circuitBreaker.reset(id);

	const health = circuitBreaker.getState(id);

	return c.json({
		success: true,
		data: {
			provider_id: id,
			circuit_state: health.state,
			health_score: health.health_score,
		},
	});
});

export { providers };
