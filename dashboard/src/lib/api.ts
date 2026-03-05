/**
 * API Client for Global-Claw Dashboard
 * Handles all communication with the backend API
 */

import { browser } from "$app/environment";

export interface ApiResponse<T> {
	success: boolean;
	data?: T;
	error?: {
		code: string;
		message: string;
	};
	meta?: {
		page: number;
		limit: number;
		total: number;
		has_more: boolean;
	};
}

class ApiClient {
	private baseUrl: string;
	private token: string | null = null;

	constructor() {
		this.baseUrl = import.meta.env.VITE_API_URL ?? "http://localhost:8787";
		if (browser) {
			this.token = localStorage.getItem("gc_token");
		}
	}

	setToken(token: string | null) {
		this.token = token;
		if (browser) {
			if (token) {
				localStorage.setItem("gc_token", token);
			} else {
				localStorage.removeItem("gc_token");
			}
		}
	}

	getToken(): string | null {
		return this.token;
	}

	private async request<T>(method: string, path: string, body?: unknown): Promise<ApiResponse<T>> {
		const headers: Record<string, string> = {
			"Content-Type": "application/json",
		};

		if (this.token) {
			headers.Authorization = `Bearer ${this.token}`;
		}

		const response = await fetch(`${this.baseUrl}${path}`, {
			method,
			headers,
			body: body ? JSON.stringify(body) : undefined,
		});

		return response.json() as Promise<ApiResponse<T>>;
	}

	// Auth
	async login(email: string, password: string) {
		return this.request<{ token: string; user: unknown }>("POST", "/api/auth/login", {
			email,
			password,
		});
	}

	async register(email: string, password: string, name?: string) {
		return this.request<{ token: string; user: unknown }>("POST", "/api/auth/register", {
			email,
			password,
			name,
		});
	}

	// Dashboard
	async getOverview(_tenantId: string) {
		return this.request<{
			active_agents: { count: number; change_pct: number };
			messages_today: { count: number; sparkline: number[] };
			uptime: { pct: number; days: number };
			llm_cost_24h: { amount_usd: number; change_pct: number };
			agent_fleet_health: Array<{
				id: string;
				name: string;
				status: "online" | "idle" | "error";
				messages_hr: number;
				llm_provider: string;
			}>;
			active_workflows: Array<{
				id: string;
				name: string;
				status: "running" | "paused" | "completed";
				last_run: string;
			}>;
			recent_activity: Array<{
				type: string;
				description: string;
				timestamp: string;
				agent_name?: string;
			}>;
		}>("GET", "/api/dashboard/overview");
	}

	async getAnalytics(days = 7) {
		return this.request<{
			period: { start: string; end: string; days: number };
			summary: {
				avg_response_time_ms: number;
				issue_resolution_rate: number;
				customer_satisfaction: number;
				total_cost_usd: number;
			};
			messages_over_time: Array<{ date: string; count: number }>;
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
		}>("GET", `/api/dashboard/analytics?days=${days}`);
	}

	async getLLMCost(days = 30) {
		return this.request<{
			period: { start: string; end: string };
			totals: {
				cost_usd: number;
				input_tokens: number;
				output_tokens: number;
				requests: number;
				budget_usd: number;
				budget_remaining_usd: number;
			};
			providers: Array<{
				slug: string;
				name: string;
				cost_usd: number;
				percentage: number;
				input_tokens: number;
				output_tokens: number;
				requests: number;
				avg_latency_ms: number;
				health_pct: number;
			}>;
			daily_costs: Array<{ date: string; cost_usd: number; tokens: number }>;
		}>("GET", `/api/dashboard/llm-cost?days=${days}`);
	}

	// Agents
	async getAgents(tenantId: string, page = 1, limit = 20) {
		return this.request<
			Array<{
				id: string;
				name: string;
				status: string;
				llm_provider_slug: string;
				total_messages: number;
				created_at: string;
			}>
		>("GET", `/api/tenants/${tenantId}/agents?page=${page}&limit=${limit}`);
	}

	async getAgent(tenantId: string, agentId: string) {
		return this.request<{
			id: string;
			name: string;
			soul_md: string;
			agents_md: string;
			status: string;
			llm_provider_slug: string;
			llm_model: string;
			temperature: number;
			max_tokens: number;
			total_messages: number;
		}>("GET", `/api/tenants/${tenantId}/agents/${agentId}`);
	}

	async createAgent(tenantId: string, data: { name: string; soul_md?: string }) {
		return this.request<{ id: string }>("POST", `/api/tenants/${tenantId}/agents`, data);
	}

	async updateAgent(
		tenantId: string,
		agentId: string,
		data: Partial<{
			name: string;
			soul_md: string;
			agents_md: string;
			status: string;
			llm_provider_slug: string;
			llm_model: string;
			temperature: number;
			max_tokens: number;
		}>,
	) {
		return this.request<{ id: string }>("PATCH", `/api/tenants/${tenantId}/agents/${agentId}`, data);
	}

	// LLM Providers
	async getProviders() {
		return this.request<
			Array<{
				id: string;
				slug: string;
				name: string;
				is_enabled: boolean;
				models_json: string;
				pricing_json: string;
			}>
		>("GET", "/api/providers");
	}

	async updateProvider(id: string, data: { is_enabled?: boolean }) {
		return this.request<{ id: string }>("PATCH", `/api/providers/${id}`, data);
	}

	// Workflows
	async getWorkflows(tenantId: string) {
		return this.request<
			Array<{
				id: string;
				name: string;
				status: string;
				created_at: string;
			}>
		>("GET", `/api/tenants/${tenantId}/workflows`);
	}
}

export const api = new ApiClient();
