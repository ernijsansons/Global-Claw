/**
 * Partners API Routes
 * Partner management and tenant assignment
 *
 * Partner Tiers:
 * - Affiliate: 30% recurring × 24mo
 * - Partner: 40% off RRP (5 active tenants)
 * - Premium: 50% off RRP (25 tenants OR €500 MRR), white-label
 * - Master: 55% off RRP + 10% override (50 tenants OR 5 sub-resellers)
 */

import { Hono } from "hono";
import { requireAuth, requireRole } from "../lib/auth/middleware";
import type { ApiResponse, Pagination, Partner } from "../types";
import type { Env } from "../types/env";

const partners = new Hono<{ Bindings: Env }>();

// All partner routes require authentication
partners.use("/*", requireAuth());

// ============================================================================
// List Partners (Admin only)
// GET /api/partners
// ============================================================================

partners.get("/", requireRole("owner", "admin"), async (c) => {
	const page = Number.parseInt(c.req.query("page") ?? "1", 10);
	const limit = Math.min(Number.parseInt(c.req.query("limit") ?? "20", 10), 100);
	const offset = (page - 1) * limit;
	const tier = c.req.query("tier");
	const status = c.req.query("status");

	let query = "SELECT * FROM partners WHERE 1=1";
	const params: unknown[] = [];

	if (tier) {
		query += " AND tier = ?";
		params.push(tier);
	}
	if (status) {
		query += " AND status = ?";
		params.push(status);
	}

	query += " ORDER BY created_at DESC LIMIT ? OFFSET ?";
	params.push(limit, offset);

	const result = await c.env.DB.prepare(query)
		.bind(...params)
		.all<Partner>();

	// Get total count
	let countQuery = "SELECT COUNT(*) as count FROM partners WHERE 1=1";
	const countParams: unknown[] = [];
	if (tier) {
		countQuery += " AND tier = ?";
		countParams.push(tier);
	}
	if (status) {
		countQuery += " AND status = ?";
		countParams.push(status);
	}
	const countResult = await c.env.DB.prepare(countQuery)
		.bind(...countParams)
		.first<{ count: number }>();
	const total = countResult?.count ?? 0;

	const pagination: Pagination = {
		page,
		limit,
		total,
		has_more: offset + limit < total,
	};

	const response: ApiResponse<Partner[]> = {
		success: true,
		data: result.results ?? [],
		meta: pagination,
	};

	return c.json(response);
});

// ============================================================================
// Get Partner Details
// GET /api/partners/:id
// ============================================================================

partners.get("/:id", requireRole("owner", "admin"), async (c) => {
	const id = c.req.param("id");

	const partner = await c.env.DB.prepare("SELECT * FROM partners WHERE id = ?").bind(id).first<Partner>();

	if (!partner) {
		return c.json(
			{
				success: false,
				error: { code: "NOT_FOUND", message: "Partner not found" },
			},
			404,
		);
	}

	// Get tenant count
	const tenantCount = await c.env.DB.prepare("SELECT COUNT(*) as count FROM tenant_partners WHERE partner_id = ?")
		.bind(id)
		.first<{ count: number }>();

	// Get total MRR from associated tenants
	const mrrResult = await c.env.DB.prepare(
		`SELECT SUM(
			CASE t.plan
				WHEN 'starter' THEN 29
				WHEN 'pro' THEN 79
				WHEN 'business' THEN 149
				WHEN 'enterprise' THEN 500
				ELSE 0
			END
		) as mrr
		FROM tenants t
		JOIN tenant_partners tp ON t.id = tp.tenant_id
		WHERE tp.partner_id = ? AND t.status = 'active'`,
	)
		.bind(id)
		.first<{ mrr: number }>();

	const enrichedPartner = {
		...partner,
		stats: {
			tenant_count: tenantCount?.count ?? 0,
			total_mrr: mrrResult?.mrr ?? 0,
			commission_rate: getCommissionRate(partner.tier),
		},
	};

	const response: ApiResponse<typeof enrichedPartner> = {
		success: true,
		data: enrichedPartner,
	};

	return c.json(response);
});

// ============================================================================
// Create Partner
// POST /api/partners
// ============================================================================

interface CreatePartnerBody {
	user_id: string; // Required - links to existing user
	tier?: "affiliate" | "partner" | "premium" | "master";
	referral_code?: string;
	company_name?: string;
	commission_rate?: number;
}

partners.post("/", requireRole("owner"), async (c) => {
	const body = await c.req.json<CreatePartnerBody>();

	// Validate required fields
	if (!body.user_id) {
		return c.json(
			{
				success: false,
				error: { code: "VALIDATION_ERROR", message: "user_id is required" },
			},
			400,
		);
	}

	// Verify user exists
	const user = await c.env.DB.prepare("SELECT id, name, email FROM users WHERE id = ?")
		.bind(body.user_id)
		.first<{ id: string; name: string | null; email: string }>();

	if (!user) {
		return c.json(
			{
				success: false,
				error: { code: "NOT_FOUND", message: "User not found" },
			},
			404,
		);
	}

	// Check if this user is already a partner
	const existing = await c.env.DB.prepare("SELECT id FROM partners WHERE user_id = ?").bind(body.user_id).first();

	if (existing) {
		return c.json(
			{
				success: false,
				error: { code: "DUPLICATE", message: "User is already a partner" },
			},
			409,
		);
	}

	// Generate referral code if not provided
	const baseName = user.name ?? user.email.split("@")[0] ?? "partner";
	const referralCode =
		body.referral_code ??
		`${baseName.toUpperCase().slice(0, 5)}-${crypto.randomUUID().slice(0, 4)}`.replace(/[^A-Z0-9-]/g, "");

	const id = crypto.randomUUID();

	await c.env.DB.prepare(
		`INSERT INTO partners (
			id, user_id, tier, referral_code, company_name, commission_rate, status, created_at, updated_at
		) VALUES (?, ?, ?, ?, ?, ?, 'active', datetime('now'), datetime('now'))`,
	)
		.bind(
			id,
			body.user_id,
			body.tier ?? "affiliate",
			referralCode,
			body.company_name ?? null,
			body.commission_rate ?? 0.3, // Default 30%
		)
		.run();

	const partner = await c.env.DB.prepare("SELECT * FROM partners WHERE id = ?").bind(id).first<Partner>();

	const response: ApiResponse<Partner> = {
		success: true,
		data: partner as Partner,
	};

	return c.json(response, 201);
});

// ============================================================================
// Update Partner
// PATCH /api/partners/:id
// ============================================================================

interface UpdatePartnerBody {
	tier?: "affiliate" | "partner" | "premium" | "master";
	status?: "active" | "suspended" | "inactive";
	company_name?: string;
	commission_rate?: number;
}

partners.patch("/:id", requireRole("owner"), async (c) => {
	const id = c.req.param("id");
	const body = await c.req.json<UpdatePartnerBody>();

	// Check partner exists
	const existing = await c.env.DB.prepare("SELECT id FROM partners WHERE id = ?").bind(id).first();
	if (!existing) {
		return c.json(
			{
				success: false,
				error: { code: "NOT_FOUND", message: "Partner not found" },
			},
			404,
		);
	}

	// Build update query
	const updates: string[] = [];
	const params: unknown[] = [];

	if (body.tier !== undefined) {
		updates.push("tier = ?");
		params.push(body.tier);
	}
	if (body.status !== undefined) {
		updates.push("status = ?");
		params.push(body.status);
	}
	if (body.company_name !== undefined) {
		updates.push("company_name = ?");
		params.push(body.company_name);
	}
	if (body.commission_rate !== undefined) {
		updates.push("commission_rate = ?");
		params.push(body.commission_rate);
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

	await c.env.DB.prepare(`UPDATE partners SET ${updates.join(", ")} WHERE id = ?`)
		.bind(...params)
		.run();

	const partner = await c.env.DB.prepare("SELECT * FROM partners WHERE id = ?").bind(id).first<Partner>();

	const response: ApiResponse<Partner> = {
		success: true,
		data: partner as Partner,
	};

	return c.json(response);
});

// ============================================================================
// List Tenants Under Partner
// GET /api/partners/:id/tenants
// ============================================================================

partners.get("/:id/tenants", requireRole("owner", "admin"), async (c) => {
	const partnerId = c.req.param("id");
	const page = Number.parseInt(c.req.query("page") ?? "1", 10);
	const limit = Math.min(Number.parseInt(c.req.query("limit") ?? "20", 10), 100);
	const offset = (page - 1) * limit;

	// Verify partner exists
	const partner = await c.env.DB.prepare("SELECT id FROM partners WHERE id = ?").bind(partnerId).first();
	if (!partner) {
		return c.json(
			{
				success: false,
				error: { code: "NOT_FOUND", message: "Partner not found" },
			},
			404,
		);
	}

	// Get tenants
	const result = await c.env.DB.prepare(
		`SELECT t.* FROM tenants t
		 JOIN tenant_partners tp ON t.id = tp.tenant_id
		 WHERE tp.partner_id = ?
		 ORDER BY t.created_at DESC LIMIT ? OFFSET ?`,
	)
		.bind(partnerId, limit, offset)
		.all();

	// Get total count
	const countResult = await c.env.DB.prepare("SELECT COUNT(*) as count FROM tenant_partners WHERE partner_id = ?")
		.bind(partnerId)
		.first<{ count: number }>();
	const total = countResult?.count ?? 0;

	const pagination: Pagination = {
		page,
		limit,
		total,
		has_more: offset + limit < total,
	};

	const response: ApiResponse<unknown[]> = {
		success: true,
		data: result.results ?? [],
		meta: pagination,
	};

	return c.json(response);
});

// ============================================================================
// Assign Tenant to Partner
// POST /api/partners/:id/tenants
// ============================================================================

interface AssignTenantBody {
	tenant_id: string;
}

partners.post("/:id/tenants", requireRole("owner"), async (c) => {
	const partnerId = c.req.param("id");
	const body = await c.req.json<AssignTenantBody>();

	if (!body.tenant_id) {
		return c.json(
			{
				success: false,
				error: { code: "VALIDATION_ERROR", message: "tenant_id is required" },
			},
			400,
		);
	}

	// Verify partner exists
	const partner = await c.env.DB.prepare("SELECT id, referral_code FROM partners WHERE id = ?")
		.bind(partnerId)
		.first<{ id: string; referral_code: string }>();
	if (!partner) {
		return c.json(
			{
				success: false,
				error: { code: "NOT_FOUND", message: "Partner not found" },
			},
			404,
		);
	}

	// Verify tenant exists
	const tenant = await c.env.DB.prepare("SELECT id FROM tenants WHERE id = ?").bind(body.tenant_id).first();
	if (!tenant) {
		return c.json(
			{
				success: false,
				error: { code: "NOT_FOUND", message: "Tenant not found" },
			},
			404,
		);
	}

	// Check if already assigned
	const existing = await c.env.DB.prepare("SELECT tenant_id FROM tenant_partners WHERE tenant_id = ?")
		.bind(body.tenant_id)
		.first();
	if (existing) {
		return c.json(
			{
				success: false,
				error: { code: "ALREADY_ASSIGNED", message: "Tenant is already assigned to a partner" },
			},
			409,
		);
	}

	// Create assignment
	await c.env.DB.prepare(
		"INSERT INTO tenant_partners (tenant_id, partner_id, referred_at) VALUES (?, ?, datetime('now'))",
	)
		.bind(body.tenant_id, partnerId)
		.run();

	const response: ApiResponse<{ assigned: boolean }> = {
		success: true,
		data: { assigned: true },
	};

	return c.json(response, 201);
});

// ============================================================================
// Helper Functions
// ============================================================================

function getCommissionRate(tier: string): number {
	const rates: Record<string, number> = {
		affiliate: 30,
		partner: 40,
		premium: 50,
		master: 55,
	};
	return rates[tier] ?? 0;
}

export { partners };
