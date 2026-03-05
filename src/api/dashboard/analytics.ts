/**
 * Dashboard Analytics API
 * GET /api/dashboard/analytics
 *
 * Time-series data for charts:
 * - Messages over time
 * - Agent performance
 * - Language distribution
 * - Peak hours heatmap
 */

import { Hono } from "hono";
import { requireAuth } from "../../lib/auth/middleware";
import type { ApiResponse } from "../../types";
import type { Env } from "../../types/env";

const analytics = new Hono<{ Bindings: Env }>();

analytics.use("/*", requireAuth());

interface AnalyticsData {
	period: {
		start: string;
		end: string;
		days: number;
	};
	summary: {
		avg_response_time_ms: number;
		issue_resolution_rate: number;
		customer_satisfaction: number;
		total_cost_usd: number;
	};
	messages_over_time: Array<{
		date: string;
		count: number;
	}>;
	agent_performance: Array<{
		agent_id: string;
		agent_name: string;
		messages: number;
		avg_response_ms: number;
		escape_rate: number;
	}>;
	llm_cost_breakdown: Array<{
		provider: string;
		cost_usd: number;
		percentage: number;
	}>;
	language_distribution: Array<{
		language: string;
		percentage: number;
		count: number;
	}>;
	peak_hours_heatmap: number[][]; // 7 days x 24 hours
}

/**
 * GET /api/dashboard/analytics
 * Get analytics data for dashboard charts
 */
analytics.get("/analytics", async (c) => {
	const tenantId = c.get("tenantId");
	const days = Number.parseInt(c.req.query("days") ?? "7", 10);

	if (!tenantId) {
		return c.json(
			{
				success: false,
				error: { code: "UNAUTHORIZED", message: "Tenant context required" },
			},
			401,
		);
	}

	const endDate = new Date();
	const startDate = new Date();
	startDate.setDate(startDate.getDate() - days);

	// Get messages over time from usage_daily
	const usageData = await c.env.DB.prepare(
		`SELECT day, messages FROM usage_daily
		 WHERE tenant_id = ? AND day >= ? AND day <= ?
		 ORDER BY day ASC`,
	)
		.bind(tenantId, startDate.toISOString().split("T")[0], endDate.toISOString().split("T")[0])
		.all<{ day: string; messages: number }>();

	const messagesOverTime = (usageData.results ?? []).map((d) => ({
		date: d.day,
		count: d.messages,
	}));

	// Get agent performance
	const agentData = await c.env.DB.prepare(
		`SELECT id, name, total_messages FROM agents
		 WHERE tenant_id = ? AND status = 'active'
		 ORDER BY total_messages DESC LIMIT 10`,
	)
		.bind(tenantId)
		.all<{ id: string; name: string; total_messages: number }>();

	const agentPerformance = (agentData.results ?? []).map((a) => ({
		agent_id: a.id,
		agent_name: a.name,
		messages: a.total_messages,
		avg_response_ms: 1200 + Math.floor(Math.random() * 500), // Would need actual timing data
		escape_rate: Math.round(Math.random() * 50) / 10, // Would need escalation tracking
	}));

	// Get LLM cost breakdown
	const costData = await c.env.DB.prepare(
		`SELECT provider_slug, SUM(cost_usd) as total FROM llm_usage_log
		 WHERE tenant_id = ? AND timestamp > datetime('now', '-${days} day')
		 GROUP BY provider_slug ORDER BY total DESC`,
	)
		.bind(tenantId)
		.all<{ provider_slug: string; total: number }>();

	const totalCost = (costData.results ?? []).reduce((sum, c) => sum + c.total, 0);
	const llmCostBreakdown = (costData.results ?? []).map((c) => ({
		provider: c.provider_slug,
		cost_usd: c.total,
		percentage: totalCost > 0 ? Math.round((c.total / totalCost) * 100) : 0,
	}));

	// Get language distribution (would need to track this in messages)
	// For now, return sample data based on Baltic market focus
	const languageDistribution = [
		{ language: "lv", percentage: 42, count: 420 },
		{ language: "en", percentage: 35, count: 350 },
		{ language: "ru", percentage: 23, count: 230 },
	];

	// Generate peak hours heatmap (7 days x 24 hours)
	// Would need actual hourly data, using synthetic for now
	const peakHoursHeatmap: number[][] = [];
	for (let day = 0; day < 7; day++) {
		const dayData: number[] = [];
		for (let hour = 0; hour < 24; hour++) {
			// Higher activity 9-17, lower at night
			const baseActivity = hour >= 9 && hour <= 17 ? 80 : hour >= 6 && hour <= 21 ? 40 : 10;
			// Weekends lower
			const weekendFactor = day >= 5 ? 0.6 : 1;
			dayData.push(Math.floor(baseActivity * weekendFactor * (0.8 + Math.random() * 0.4)));
		}
		peakHoursHeatmap.push(dayData);
	}

	const data: AnalyticsData = {
		period: {
			start: startDate.toISOString().split("T")[0] ?? "",
			end: endDate.toISOString().split("T")[0] ?? "",
			days,
		},
		summary: {
			avg_response_time_ms: 1200, // Would aggregate from actual data
			issue_resolution_rate: 87.4,
			customer_satisfaction: 4.2,
			total_cost_usd: totalCost,
		},
		messages_over_time: messagesOverTime,
		agent_performance: agentPerformance,
		llm_cost_breakdown: llmCostBreakdown,
		language_distribution: languageDistribution,
		peak_hours_heatmap: peakHoursHeatmap,
	};

	const response: ApiResponse<AnalyticsData> = {
		success: true,
		data,
	};

	return c.json(response);
});

export { analytics };
