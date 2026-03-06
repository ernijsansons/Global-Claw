/**
 * Memory API Routes
 * Knowledge & context management for agents
 *
 * Memory Types:
 * - Conversation: Message history
 * - Long-term: Facts & learnings
 * - Vector: Semantic embeddings
 */

import { Hono } from "hono";
import { requireAuth, requireRole } from "../lib/auth/middleware";
import type { Pagination } from "../types";
import type { Env } from "../types/env";

const memory = new Hono<{ Bindings: Env }>();

memory.use("/*", requireAuth());

interface MemoryEntry {
	id: string;
	tenant_id: string;
	agent_id?: string;
	type: "conversation" | "fact" | "embedding";
	content: string;
	metadata: Record<string, unknown>;
	confidence?: number;
	usage_count?: number;
	created_at: string;
	updated_at?: string;
}

// ============================================================================
// Search Memory
// GET /api/tenants/:tenantId/memory
// ============================================================================

memory.get("/tenants/:tenantId/memory", async (c) => {
	const tenantId = c.req.param("tenantId");
	const query = c.req.query("q");
	const agentId = c.req.query("agent_id");
	const type = c.req.query("type");
	const page = Number.parseInt(c.req.query("page") ?? "1", 10);
	const limit = Math.min(Number.parseInt(c.req.query("limit") ?? "20", 10), 100);
	const offset = (page - 1) * limit;

	// For now, we'll search the TenantAgent DO's memory
	// In production, this would query Vectorize for semantic search

	// Get DO stub
	const doId = c.env.TENANT_AGENT.idFromName(tenantId);
	const stub = c.env.TENANT_AGENT.get(doId);

	// Forward search request to DO
	const searchParams = new URLSearchParams();
	if (query) searchParams.set("q", query);
	if (agentId) searchParams.set("agent_id", agentId);
	if (type) searchParams.set("type", type);
	searchParams.set("limit", String(limit));
	searchParams.set("offset", String(offset));

	try {
		// DO route is /memory, not /memory/search
		const response = await stub.fetch(
			new Request(`https://do/memory?${searchParams.toString()}`, {
				method: "GET",
				headers: {
					"X-Tenant-ID": tenantId,
					"X-DO-Auth": c.env.JWT_SECRET,
					Authorization: c.req.header("Authorization") ?? "",
				},
			}),
		);

		if (!response.ok) {
			const error = (await response.json()) as { error?: { message?: string } };
			return c.json(
				{
					success: false,
					error: { code: "MEMORY_ERROR", message: error.error?.message ?? "Memory search failed" },
				},
				response.status as 400,
			);
		}

		const result = (await response.json()) as { data: MemoryEntry[]; meta: Pagination };
		return c.json({
			success: true,
			data: result.data,
			meta: result.meta,
		});
	} catch (err) {
		console.error("Memory search error:", err);
		return c.json(
			{
				success: false,
				error: { code: "MEMORY_ERROR", message: "Failed to search memory" },
			},
			500,
		);
	}
});

// ============================================================================
// Add Memory Entry
// POST /api/tenants/:tenantId/memory
// ============================================================================

interface CreateMemoryBody {
	agent_id?: string;
	type: "conversation" | "fact" | "embedding";
	content: string;
	metadata?: Record<string, unknown>;
}

memory.post("/tenants/:tenantId/memory", requireRole("owner", "admin", "member"), async (c) => {
	const tenantId = c.req.param("tenantId");
	const body = await c.req.json<CreateMemoryBody>();

	// Validate required fields
	if (!body.content || !body.type) {
		return c.json(
			{
				success: false,
				error: { code: "VALIDATION_ERROR", message: "content and type are required" },
			},
			400,
		);
	}

	// Validate type
	if (!["conversation", "fact", "embedding"].includes(body.type)) {
		return c.json(
			{
				success: false,
				error: { code: "VALIDATION_ERROR", message: "type must be conversation, fact, or embedding" },
			},
			400,
		);
	}

	// Get DO stub
	const doId = c.env.TENANT_AGENT.idFromName(tenantId);
	const stub = c.env.TENANT_AGENT.get(doId);

	try {
		const response = await stub.fetch(
			new Request("https://do/memory", {
				method: "POST",
				headers: {
					"X-Tenant-ID": tenantId,
					"X-DO-Auth": c.env.JWT_SECRET,
					"Content-Type": "application/json",
					Authorization: c.req.header("Authorization") ?? "",
				},
				body: JSON.stringify(body),
			}),
		);

		if (!response.ok) {
			const error = (await response.json()) as { error?: { message?: string } };
			return c.json(
				{
					success: false,
					error: { code: "MEMORY_ERROR", message: error.error?.message ?? "Failed to add memory" },
				},
				response.status as 400,
			);
		}

		const result = (await response.json()) as { data: MemoryEntry };
		return c.json(
			{
				success: true,
				data: result.data,
			},
			201,
		);
	} catch (err) {
		console.error("Memory add error:", err);
		return c.json(
			{
				success: false,
				error: { code: "MEMORY_ERROR", message: "Failed to add memory entry" },
			},
			500,
		);
	}
});

// ============================================================================
// Delete Memory Entry
// DELETE /api/tenants/:tenantId/memory/:id
// ============================================================================

memory.delete("/tenants/:tenantId/memory/:id", requireRole("owner", "admin"), async (c) => {
	const tenantId = c.req.param("tenantId");
	const memoryId = c.req.param("id");

	// Get DO stub
	const doId = c.env.TENANT_AGENT.idFromName(tenantId);
	const stub = c.env.TENANT_AGENT.get(doId);

	try {
		const response = await stub.fetch(
			new Request(`https://do/memory/${memoryId}`, {
				method: "DELETE",
				headers: {
					"X-Tenant-ID": tenantId,
					"X-DO-Auth": c.env.JWT_SECRET,
					Authorization: c.req.header("Authorization") ?? "",
				},
			}),
		);

		if (!response.ok) {
			const error = (await response.json()) as { error?: { message?: string } };
			return c.json(
				{
					success: false,
					error: { code: "MEMORY_ERROR", message: error.error?.message ?? "Failed to delete memory" },
				},
				response.status as 400,
			);
		}

		return c.json({
			success: true,
			data: { deleted: true },
		});
	} catch (err) {
		console.error("Memory delete error:", err);
		return c.json(
			{
				success: false,
				error: { code: "MEMORY_ERROR", message: "Failed to delete memory entry" },
			},
			500,
		);
	}
});

// ============================================================================
// Get Memory Stats
// GET /api/tenants/:tenantId/memory/stats
// ============================================================================

memory.get("/tenants/:tenantId/memory/stats", async (c) => {
	const tenantId = c.req.param("tenantId");

	// Get DO stub
	const doId = c.env.TENANT_AGENT.idFromName(tenantId);
	const stub = c.env.TENANT_AGENT.get(doId);

	try {
		const response = await stub.fetch(
			new Request("https://do/memory/stats", {
				method: "GET",
				headers: {
					"X-Tenant-ID": tenantId,
					"X-DO-Auth": c.env.JWT_SECRET,
					Authorization: c.req.header("Authorization") ?? "",
				},
			}),
		);

		if (!response.ok) {
			// Return default stats if DO doesn't have memory stats yet
			return c.json({
				success: true,
				data: {
					conversation_count: 0,
					fact_count: 0,
					embedding_count: 0,
					total_size_bytes: 0,
				},
			});
		}

		const result = (await response.json()) as { data: Record<string, number> };
		return c.json({
			success: true,
			data: result.data,
		});
	} catch (err) {
		console.error("Memory stats error:", err);
		return c.json({
			success: true,
			data: {
				conversation_count: 0,
				fact_count: 0,
				embedding_count: 0,
				total_size_bytes: 0,
			},
		});
	}
});

export { memory };
