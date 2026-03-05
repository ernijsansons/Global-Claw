/**
 * LLM Routing Rules API Routes
 * Admin CRUD operations for routing rule management
 *
 * Routing rules determine which LLM provider/model handles requests
 * based on conditions like task_type, language, tenant_id, etc.
 */

import { Hono } from "hono";
import { requireAuth, requireRole } from "../lib/auth/middleware";
import type { ApiResponse, LLMRoutingRule, Pagination } from "../types";
import type { Env } from "../types/env";

const routingRules = new Hono<{ Bindings: Env }>();

// All routing rule routes require admin authentication
routingRules.use("/*", requireAuth());
routingRules.use("/*", requireRole("owner", "admin"));

// ============================================================================
// List Routing Rules
// GET /api/routing-rules
// ============================================================================

routingRules.get("/", async (c) => {
	const page = Number.parseInt(c.req.query("page") ?? "1", 10);
	const limit = Math.min(Number.parseInt(c.req.query("limit") ?? "20", 10), 100);
	const offset = (page - 1) * limit;
	const enabledOnly = c.req.query("enabled") === "true";

	let query = "SELECT * FROM llm_routing_rules";
	const params: unknown[] = [];

	if (enabledOnly) {
		query += " WHERE is_enabled = 1";
	}

	query += " ORDER BY priority DESC, created_at ASC LIMIT ? OFFSET ?";
	params.push(limit, offset);

	const result = await c.env.DB.prepare(query)
		.bind(...params)
		.all<LLMRoutingRule>();

	// Get total count
	const countQuery = enabledOnly
		? "SELECT COUNT(*) as count FROM llm_routing_rules WHERE is_enabled = 1"
		: "SELECT COUNT(*) as count FROM llm_routing_rules";
	const countResult = await c.env.DB.prepare(countQuery).first<{ count: number }>();
	const total = countResult?.count ?? 0;

	// Parse JSON fields for easier consumption
	const enrichedRules = (result.results ?? []).map((rule) => ({
		...rule,
		condition: JSON.parse(rule.condition_json),
		routes: JSON.parse(rule.routes_json),
	}));

	const pagination: Pagination = {
		page,
		limit,
		total,
		has_more: offset + limit < total,
	};

	const response: ApiResponse<typeof enrichedRules> = {
		success: true,
		data: enrichedRules,
		meta: pagination,
	};

	return c.json(response);
});

// ============================================================================
// Get Single Routing Rule
// GET /api/routing-rules/:id
// ============================================================================

routingRules.get("/:id", async (c) => {
	const id = c.req.param("id");

	const rule = await c.env.DB.prepare("SELECT * FROM llm_routing_rules WHERE id = ?").bind(id).first<LLMRoutingRule>();

	if (!rule) {
		return c.json(
			{
				success: false,
				error: { code: "NOT_FOUND", message: "Routing rule not found" },
			},
			404,
		);
	}

	const enrichedRule = {
		...rule,
		condition: JSON.parse(rule.condition_json),
		routes: JSON.parse(rule.routes_json),
	};

	const response: ApiResponse<typeof enrichedRule> = {
		success: true,
		data: enrichedRule,
	};

	return c.json(response);
});

// ============================================================================
// Create Routing Rule
// POST /api/routing-rules
// ============================================================================

interface RoutingCondition {
	field: string;
	operator: "eq" | "neq" | "gt" | "lt" | "in" | "matches";
	value: unknown;
}

interface RoutingRoute {
	provider_slug: string;
	model: string;
	weight: number;
}

interface CreateRuleBody {
	name: string;
	priority?: number;
	condition: RoutingCondition;
	routes: RoutingRoute[];
	is_enabled?: boolean;
}

routingRules.post("/", async (c) => {
	const body = await c.req.json<CreateRuleBody>();

	// Validate required fields
	if (!body.name || !body.condition || !body.routes || body.routes.length === 0) {
		return c.json(
			{
				success: false,
				error: {
					code: "VALIDATION_ERROR",
					message: "Missing required fields: name, condition, routes (must have at least one route)",
				},
			},
			400,
		);
	}

	// Validate condition
	if (!body.condition.field || !body.condition.operator) {
		return c.json(
			{
				success: false,
				error: { code: "VALIDATION_ERROR", message: "Condition must have field and operator" },
			},
			400,
		);
	}

	// Validate routes
	for (const route of body.routes) {
		if (!route.provider_slug || !route.model) {
			return c.json(
				{
					success: false,
					error: { code: "VALIDATION_ERROR", message: "Each route must have provider_slug and model" },
				},
				400,
			);
		}

		// Verify provider exists
		const provider = await c.env.DB.prepare("SELECT id FROM llm_providers WHERE slug = ?")
			.bind(route.provider_slug)
			.first();

		if (!provider) {
			return c.json(
				{
					success: false,
					error: { code: "NOT_FOUND", message: `Provider '${route.provider_slug}' not found` },
				},
				400,
			);
		}
	}

	// Normalize weights
	const totalWeight = body.routes.reduce((sum, r) => sum + (r.weight ?? 100), 0);
	const normalizedRoutes = body.routes.map((r) => ({
		...r,
		weight: Math.round(((r.weight ?? 100) / totalWeight) * 100),
	}));

	const id = crypto.randomUUID().replace(/-/g, "").slice(0, 32);

	await c.env.DB.prepare(
		`INSERT INTO llm_routing_rules (
			id, name, priority, condition_json, routes_json, is_enabled
		) VALUES (?, ?, ?, ?, ?, ?)`,
	)
		.bind(
			id,
			body.name,
			body.priority ?? 0,
			JSON.stringify(body.condition),
			JSON.stringify(normalizedRoutes),
			body.is_enabled !== false ? 1 : 0,
		)
		.run();

	// Fetch the created rule
	const rule = await c.env.DB.prepare("SELECT * FROM llm_routing_rules WHERE id = ?").bind(id).first<LLMRoutingRule>();

	if (!rule) {
		return c.json(
			{ success: false, error: { code: "INTERNAL_ERROR", message: "Failed to retrieve created rule" } },
			500,
		);
	}

	const enrichedRule = {
		...rule,
		condition: JSON.parse(rule.condition_json),
		routes: JSON.parse(rule.routes_json),
	};

	const response: ApiResponse<typeof enrichedRule> = {
		success: true,
		data: enrichedRule,
	};

	return c.json(response, 201);
});

// ============================================================================
// Update Routing Rule
// PATCH /api/routing-rules/:id
// ============================================================================

interface UpdateRuleBody {
	name?: string;
	priority?: number;
	condition?: RoutingCondition;
	routes?: RoutingRoute[];
	is_enabled?: boolean;
}

routingRules.patch("/:id", async (c) => {
	const id = c.req.param("id");
	const body = await c.req.json<UpdateRuleBody>();

	// Check rule exists
	const existing = await c.env.DB.prepare("SELECT id FROM llm_routing_rules WHERE id = ?").bind(id).first();

	if (!existing) {
		return c.json(
			{
				success: false,
				error: { code: "NOT_FOUND", message: "Routing rule not found" },
			},
			404,
		);
	}

	// Validate routes if provided
	if (body.routes) {
		if (body.routes.length === 0) {
			return c.json(
				{
					success: false,
					error: { code: "VALIDATION_ERROR", message: "Routes must have at least one entry" },
				},
				400,
			);
		}

		for (const route of body.routes) {
			if (!route.provider_slug || !route.model) {
				return c.json(
					{
						success: false,
						error: { code: "VALIDATION_ERROR", message: "Each route must have provider_slug and model" },
					},
					400,
				);
			}

			// Verify provider exists
			const provider = await c.env.DB.prepare("SELECT id FROM llm_providers WHERE slug = ?")
				.bind(route.provider_slug)
				.first();

			if (!provider) {
				return c.json(
					{
						success: false,
						error: { code: "NOT_FOUND", message: `Provider '${route.provider_slug}' not found` },
					},
					400,
				);
			}
		}
	}

	// Build update query
	const updates: string[] = [];
	const params: unknown[] = [];

	if (body.name !== undefined) {
		updates.push("name = ?");
		params.push(body.name);
	}
	if (body.priority !== undefined) {
		updates.push("priority = ?");
		params.push(body.priority);
	}
	if (body.condition !== undefined) {
		updates.push("condition_json = ?");
		params.push(JSON.stringify(body.condition));
	}
	if (body.routes !== undefined) {
		// Normalize weights
		const totalWeight = body.routes.reduce((sum, r) => sum + (r.weight ?? 100), 0);
		const normalizedRoutes = body.routes.map((r) => ({
			...r,
			weight: Math.round(((r.weight ?? 100) / totalWeight) * 100),
		}));
		updates.push("routes_json = ?");
		params.push(JSON.stringify(normalizedRoutes));
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

	await c.env.DB.prepare(`UPDATE llm_routing_rules SET ${updates.join(", ")} WHERE id = ?`)
		.bind(...params)
		.run();

	// Fetch updated rule
	const rule = await c.env.DB.prepare("SELECT * FROM llm_routing_rules WHERE id = ?").bind(id).first<LLMRoutingRule>();

	if (!rule) {
		return c.json(
			{ success: false, error: { code: "INTERNAL_ERROR", message: "Failed to retrieve updated rule" } },
			500,
		);
	}

	const enrichedRule = {
		...rule,
		condition: JSON.parse(rule.condition_json),
		routes: JSON.parse(rule.routes_json),
	};

	const response: ApiResponse<typeof enrichedRule> = {
		success: true,
		data: enrichedRule,
	};

	return c.json(response);
});

// ============================================================================
// Delete Routing Rule
// DELETE /api/routing-rules/:id
// ============================================================================

routingRules.delete("/:id", async (c) => {
	const id = c.req.param("id");

	// Check rule exists
	const existing = await c.env.DB.prepare("SELECT id FROM llm_routing_rules WHERE id = ?").bind(id).first();

	if (!existing) {
		return c.json(
			{
				success: false,
				error: { code: "NOT_FOUND", message: "Routing rule not found" },
			},
			404,
		);
	}

	await c.env.DB.prepare("DELETE FROM llm_routing_rules WHERE id = ?").bind(id).run();

	return c.json({ success: true, data: { deleted: true } });
});

// ============================================================================
// Test Routing Rule
// POST /api/routing-rules/test
// Simulates routing decision without executing LLM call
// ============================================================================

interface TestRoutingBody {
	tenant_id: string;
	agent_id?: string;
	task_type?: string;
	language?: string;
	input_tokens?: number;
	priority?: number;
}

routingRules.post("/test", async (c) => {
	const body = await c.req.json<TestRoutingBody>();

	if (!body.tenant_id) {
		return c.json(
			{
				success: false,
				error: { code: "VALIDATION_ERROR", message: "tenant_id is required" },
			},
			400,
		);
	}

	// Get all enabled rules ordered by priority
	const rules = await c.env.DB.prepare(
		"SELECT * FROM llm_routing_rules WHERE is_enabled = 1 ORDER BY priority DESC",
	).all<LLMRoutingRule>();

	const matchedRules: Array<{ rule: LLMRoutingRule; reason: string }> = [];

	for (const rule of rules.results ?? []) {
		const condition = JSON.parse(rule.condition_json) as Record<string, unknown>;
		let matches = true;
		let reason = "";

		// Check field-based condition
		if (condition.field && condition.operator) {
			const fieldValue = getFieldValue(body, condition.field as string);
			const conditionMet = evaluateCondition(fieldValue, condition.operator as string, condition.value);

			if (!conditionMet) {
				matches = false;
				reason = `Field '${condition.field}' with value '${fieldValue}' did not match ${condition.operator} '${condition.value}'`;
			} else {
				reason = `Field '${condition.field}' matched ${condition.operator} '${condition.value}'`;
			}
		}

		// Check legacy conditions
		if (condition.tenant_id && condition.tenant_id !== body.tenant_id) {
			matches = false;
			reason = "tenant_id mismatch";
		}
		if (condition.agent_id && condition.agent_id !== body.agent_id) {
			matches = false;
			reason = "agent_id mismatch";
		}
		if (condition.task_type && condition.task_type !== body.task_type) {
			matches = false;
			reason = "task_type mismatch";
		}
		if (condition.language && condition.language !== body.language) {
			matches = false;
			reason = "language mismatch";
		}

		if (matches) {
			matchedRules.push({ rule, reason: reason || "All conditions matched" });
		}
	}

	// Determine which provider would be selected
	let selectedProvider: { provider_slug: string; model: string } | null = null;
	let selectedRule: LLMRoutingRule | null = null;

	if (matchedRules.length > 0 && matchedRules[0]) {
		selectedRule = matchedRules[0].rule;
		const routes = JSON.parse(selectedRule.routes_json) as Array<{
			provider_slug: string;
			model: string;
			weight: number;
		}>;

		// Select by weight (for testing, just pick highest weight)
		routes.sort((a, b) => b.weight - a.weight);
		if (routes[0]) {
			selectedProvider = { provider_slug: routes[0].provider_slug, model: routes[0].model };
		}
	}

	return c.json({
		success: true,
		data: {
			context: body,
			matched_rules: matchedRules.map((m) => ({
				id: m.rule.id,
				name: m.rule.name,
				priority: m.rule.priority,
				reason: m.reason,
			})),
			selected_rule: selectedRule
				? {
						id: selectedRule.id,
						name: selectedRule.name,
					}
				: null,
			selected_provider: selectedProvider,
			fallback_used: matchedRules.length === 0,
		},
	});
});

// Helper functions
function getFieldValue(context: TestRoutingBody, field: string): unknown {
	switch (field) {
		case "tenant_id":
			return context.tenant_id;
		case "agent_id":
			return context.agent_id;
		case "task_type":
			return context.task_type;
		case "language":
			return context.language;
		case "input_tokens":
			return context.input_tokens;
		case "priority":
			return context.priority;
		default:
			return undefined;
	}
}

function evaluateCondition(fieldValue: unknown, operator: string, conditionValue: unknown): boolean {
	switch (operator) {
		case "eq":
			return fieldValue === conditionValue;
		case "neq":
			return fieldValue !== conditionValue;
		case "gt":
			return typeof fieldValue === "number" && fieldValue > Number(conditionValue);
		case "lt":
			return typeof fieldValue === "number" && fieldValue < Number(conditionValue);
		case "in":
			return Array.isArray(conditionValue) && conditionValue.includes(fieldValue);
		case "matches":
			return typeof fieldValue === "string" && new RegExp(String(conditionValue)).test(fieldValue);
		default:
			return false;
	}
}

export { routingRules };
