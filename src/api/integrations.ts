/**
 * Integrations API Routes
 * OAuth flows for 1-click plugin connections
 *
 * Supported integrations:
 * - Google Calendar
 * - Google Sheets
 * - Notion
 * - HubSpot (Phase 2)
 */

import { Hono } from "hono";
import { requireAuth, requireRole } from "../lib/auth/middleware";
import { decrypt, encrypt } from "../lib/crypto";
import type { ApiResponse, Pagination, PluginConnection } from "../types";
import type { Env } from "../types/env";

const integrations = new Hono<{ Bindings: Env }>();

// All integration routes require authentication
integrations.use("/*", requireAuth());

/**
 * Supported OAuth providers
 */
interface OAuthProvider {
	name: string;
	slug: string;
	authUrl: string;
	tokenUrl: string;
	scopes: string[];
	icon: string;
}

const OAUTH_PROVIDERS: Record<string, OAuthProvider> = {
	google_calendar: {
		name: "Google Calendar",
		slug: "google_calendar",
		authUrl: "https://accounts.google.com/o/oauth2/v2/auth",
		tokenUrl: "https://oauth2.googleapis.com/token",
		scopes: ["https://www.googleapis.com/auth/calendar", "https://www.googleapis.com/auth/calendar.events"],
		icon: "calendar",
	},
	google_sheets: {
		name: "Google Sheets",
		slug: "google_sheets",
		authUrl: "https://accounts.google.com/o/oauth2/v2/auth",
		tokenUrl: "https://oauth2.googleapis.com/token",
		scopes: ["https://www.googleapis.com/auth/spreadsheets"],
		icon: "table",
	},
	notion: {
		name: "Notion",
		slug: "notion",
		authUrl: "https://api.notion.com/v1/oauth/authorize",
		tokenUrl: "https://api.notion.com/v1/oauth/token",
		scopes: [],
		icon: "file-text",
	},
	hubspot: {
		name: "HubSpot",
		slug: "hubspot",
		authUrl: "https://app.hubspot.com/oauth/authorize",
		tokenUrl: "https://api.hubapi.com/oauth/v1/token",
		scopes: ["crm.objects.contacts.read", "crm.objects.contacts.write"],
		icon: "users",
	},
};

// ============================================================================
// List Available Integrations
// GET /api/tenants/:tenantId/integrations/available
// ============================================================================

integrations.get("/tenants/:tenantId/integrations/available", async (c) => {
	const providers = Object.values(OAUTH_PROVIDERS).map((p) => ({
		slug: p.slug,
		name: p.name,
		icon: p.icon,
		scopes: p.scopes,
	}));

	const response: ApiResponse<typeof providers> = {
		success: true,
		data: providers,
	};

	return c.json(response);
});

// ============================================================================
// List Connected Integrations
// GET /api/tenants/:tenantId/integrations
// ============================================================================

integrations.get("/tenants/:tenantId/integrations", async (c) => {
	const tenantId = c.req.param("tenantId");
	const agentId = c.req.query("agent_id");
	const page = Number.parseInt(c.req.query("page") ?? "1", 10);
	const limit = Math.min(Number.parseInt(c.req.query("limit") ?? "20", 10), 100);
	const offset = (page - 1) * limit;

	let query = "SELECT * FROM plugin_connections WHERE tenant_id = ?";
	const params: unknown[] = [tenantId];

	if (agentId) {
		query += " AND agent_id = ?";
		params.push(agentId);
	}

	query += " ORDER BY created_at DESC LIMIT ? OFFSET ?";
	params.push(limit, offset);

	const result = await c.env.DB.prepare(query)
		.bind(...params)
		.all<PluginConnection>();

	// Get total count
	let countQuery = "SELECT COUNT(*) as count FROM plugin_connections WHERE tenant_id = ?";
	const countParams: unknown[] = [tenantId];
	if (agentId) {
		countQuery += " AND agent_id = ?";
		countParams.push(agentId);
	}
	const countResult = await c.env.DB.prepare(countQuery)
		.bind(...countParams)
		.first<{ count: number }>();
	const total = countResult?.count ?? 0;

	// Map to safe response (exclude encrypted tokens)
	const connections = (result.results ?? []).map((conn) => ({
		id: conn.id,
		tenant_id: conn.tenant_id,
		agent_id: conn.agent_id,
		provider: conn.provider,
		status: conn.status,
		scopes: JSON.parse(conn.scopes_json ?? "[]"),
		created_at: conn.created_at,
	}));

	const pagination: Pagination = {
		page,
		limit,
		total,
		has_more: offset + limit < total,
	};

	const response: ApiResponse<typeof connections> = {
		success: true,
		data: connections,
		meta: pagination,
	};

	return c.json(response);
});

// ============================================================================
// Initiate OAuth Connection
// POST /api/tenants/:tenantId/integrations
// ============================================================================

interface InitiateOAuthBody {
	provider: string;
	agent_id?: string;
}

integrations.post("/tenants/:tenantId/integrations", requireRole("owner", "admin"), async (c) => {
	const tenantId = c.req.param("tenantId");
	const body = await c.req.json<InitiateOAuthBody>();

	// Validate provider
	const provider = OAUTH_PROVIDERS[body.provider];
	if (!provider) {
		return c.json(
			{
				success: false,
				error: {
					code: "INVALID_PROVIDER",
					message: `Unknown provider: ${body.provider}. Available: ${Object.keys(OAUTH_PROVIDERS).join(", ")}`,
				},
			},
			400,
		);
	}

	// Create state token for CSRF protection
	const state = crypto.randomUUID();
	const stateData = {
		tenant_id: tenantId,
		provider: body.provider,
		agent_id: body.agent_id,
		created_at: Date.now(),
	};

	// Store state in KV with 10 minute expiration
	await c.env.RATE_LIMIT_KV.put(`oauth_state:${state}`, JSON.stringify(stateData), {
		expirationTtl: 600,
	});

	// Build OAuth URL
	const redirectUri = `${c.env.APP_URL}/oauth/${body.provider}/callback`;
	const params = new URLSearchParams({
		client_id: getClientId(c.env, body.provider),
		redirect_uri: redirectUri,
		response_type: "code",
		state,
		access_type: "offline",
		prompt: "consent",
	});

	if (provider.scopes.length > 0) {
		params.set("scope", provider.scopes.join(" "));
	}

	// Notion uses different params
	if (body.provider === "notion") {
		params.set("owner", "user");
	}

	const authUrl = `${provider.authUrl}?${params.toString()}`;

	const response: ApiResponse<{ auth_url: string; state: string }> = {
		success: true,
		data: {
			auth_url: authUrl,
			state,
		},
	};

	return c.json(response);
});

// ============================================================================
// OAuth Callback Handler
// GET /oauth/:provider/callback
// ============================================================================

integrations.get("/oauth/:provider/callback", async (c) => {
	const provider = c.req.param("provider");
	const code = c.req.query("code");
	const state = c.req.query("state");
	const error = c.req.query("error");

	// Handle OAuth errors
	if (error) {
		const errorDescription = c.req.query("error_description") ?? error;
		return c.redirect(`${c.env.DASHBOARD_URL}/integrations?error=${encodeURIComponent(errorDescription)}`);
	}

	if (!code || !state) {
		return c.redirect(`${c.env.DASHBOARD_URL}/integrations?error=missing_params`);
	}

	// Validate state
	const stateJson = await c.env.RATE_LIMIT_KV.get(`oauth_state:${state}`);
	if (!stateJson) {
		return c.redirect(`${c.env.DASHBOARD_URL}/integrations?error=invalid_state`);
	}

	const stateData = JSON.parse(stateJson) as {
		tenant_id: string;
		provider: string;
		agent_id?: string;
		created_at: number;
	};

	// Clean up state
	await c.env.RATE_LIMIT_KV.delete(`oauth_state:${state}`);

	// Validate provider matches
	if (stateData.provider !== provider) {
		return c.redirect(`${c.env.DASHBOARD_URL}/integrations?error=provider_mismatch`);
	}

	const providerConfig = OAUTH_PROVIDERS[provider];
	if (!providerConfig) {
		return c.redirect(`${c.env.DASHBOARD_URL}/integrations?error=unknown_provider`);
	}

	// Exchange code for tokens
	const redirectUri = `${c.env.APP_URL}/oauth/${provider}/callback`;

	try {
		const tokenResponse = await exchangeCodeForTokens(c.env, provider, code, redirectUri);

		// Encrypt tokens before storage
		const encryptedAccessToken = await encrypt(tokenResponse.access_token, c.env.ENCRYPTION_KEY);
		const encryptedRefreshToken = tokenResponse.refresh_token
			? await encrypt(tokenResponse.refresh_token, c.env.ENCRYPTION_KEY)
			: null;

		// Store connection in D1
		const connectionId = crypto.randomUUID();
		await c.env.DB.prepare(
			`INSERT INTO plugin_connections (
				id, tenant_id, agent_id, provider,
				oauth_access_token_encrypted, oauth_refresh_token_encrypted,
				status, scopes_json, created_at
			) VALUES (?, ?, ?, ?, ?, ?, 'active', ?, datetime('now'))`,
		)
			.bind(
				connectionId,
				stateData.tenant_id,
				stateData.agent_id ?? null,
				provider,
				encryptedAccessToken,
				encryptedRefreshToken,
				JSON.stringify(providerConfig.scopes),
			)
			.run();

		// Redirect to dashboard with success
		return c.redirect(`${c.env.DASHBOARD_URL}/integrations?connected=${provider}`);
	} catch (err) {
		console.error("OAuth token exchange failed:", err);
		return c.redirect(`${c.env.DASHBOARD_URL}/integrations?error=token_exchange_failed`);
	}
});

// ============================================================================
// Disconnect Integration
// DELETE /api/tenants/:tenantId/integrations/:id
// ============================================================================

integrations.delete("/tenants/:tenantId/integrations/:id", requireRole("owner", "admin"), async (c) => {
	const tenantId = c.req.param("tenantId");
	const connectionId = c.req.param("id");

	// Verify connection exists and belongs to tenant
	const connection = await c.env.DB.prepare(
		"SELECT id, provider FROM plugin_connections WHERE id = ? AND tenant_id = ?",
	)
		.bind(connectionId, tenantId)
		.first<{ id: string; provider: string }>();

	if (!connection) {
		return c.json(
			{
				success: false,
				error: { code: "NOT_FOUND", message: "Integration connection not found" },
			},
			404,
		);
	}

	// Delete the connection
	await c.env.DB.prepare("DELETE FROM plugin_connections WHERE id = ?").bind(connectionId).run();

	// Log audit event
	await c.env.AUDIT_QUEUE.send({
		tenant_id: tenantId,
		actor_id: c.get("userId") ?? "unknown",
		actor_type: "user",
		action: "integration.disconnected",
		resource_type: "plugin_connection",
		resource_id: connectionId,
		details: { provider: connection.provider },
		timestamp: new Date().toISOString(),
	});

	const response: ApiResponse<{ deleted: boolean }> = {
		success: true,
		data: { deleted: true },
	};

	return c.json(response);
});

// ============================================================================
// Refresh Token
// POST /api/tenants/:tenantId/integrations/:id/refresh
// ============================================================================

integrations.post("/tenants/:tenantId/integrations/:id/refresh", requireRole("owner", "admin"), async (c) => {
	const tenantId = c.req.param("tenantId");
	const connectionId = c.req.param("id");

	// Get connection
	const connection = await c.env.DB.prepare("SELECT * FROM plugin_connections WHERE id = ? AND tenant_id = ?")
		.bind(connectionId, tenantId)
		.first<PluginConnection>();

	if (!connection) {
		return c.json(
			{
				success: false,
				error: { code: "NOT_FOUND", message: "Integration connection not found" },
			},
			404,
		);
	}

	if (!connection.oauth_refresh_token_encrypted) {
		return c.json(
			{
				success: false,
				error: { code: "NO_REFRESH_TOKEN", message: "No refresh token available" },
			},
			400,
		);
	}

	try {
		// Decrypt refresh token
		const refreshToken = await decrypt(connection.oauth_refresh_token_encrypted, c.env.ENCRYPTION_KEY);

		// Refresh the token
		const tokenResponse = await refreshAccessToken(c.env, connection.provider, refreshToken);

		// Encrypt new tokens
		const encryptedAccessToken = await encrypt(tokenResponse.access_token, c.env.ENCRYPTION_KEY);
		const encryptedRefreshToken = tokenResponse.refresh_token
			? await encrypt(tokenResponse.refresh_token, c.env.ENCRYPTION_KEY)
			: connection.oauth_refresh_token_encrypted;

		// Update connection
		await c.env.DB.prepare(
			`UPDATE plugin_connections SET
				oauth_access_token_encrypted = ?,
				oauth_refresh_token_encrypted = ?,
				status = 'active'
			WHERE id = ?`,
		)
			.bind(encryptedAccessToken, encryptedRefreshToken, connectionId)
			.run();

		const response: ApiResponse<{ refreshed: boolean }> = {
			success: true,
			data: { refreshed: true },
		};

		return c.json(response);
	} catch (err) {
		console.error("Token refresh failed:", err);

		// Mark connection as expired
		await c.env.DB.prepare("UPDATE plugin_connections SET status = 'expired' WHERE id = ?").bind(connectionId).run();

		return c.json(
			{
				success: false,
				error: { code: "REFRESH_FAILED", message: "Failed to refresh token. Please reconnect." },
			},
			400,
		);
	}
});

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get OAuth client ID for a provider from environment
 */
function getClientId(env: Env, provider: string): string {
	const clientIds: Record<string, string | undefined> = {
		google_calendar: env.GOOGLE_CLIENT_ID,
		google_sheets: env.GOOGLE_CLIENT_ID,
		notion: env.NOTION_CLIENT_ID,
		hubspot: env.HUBSPOT_CLIENT_ID,
	};
	return clientIds[provider] ?? "";
}

/**
 * Get OAuth client secret for a provider from environment
 */
function getClientSecret(env: Env, provider: string): string {
	const clientSecrets: Record<string, string | undefined> = {
		google_calendar: env.GOOGLE_CLIENT_SECRET,
		google_sheets: env.GOOGLE_CLIENT_SECRET,
		notion: env.NOTION_CLIENT_SECRET,
		hubspot: env.HUBSPOT_CLIENT_SECRET,
	};
	return clientSecrets[provider] ?? "";
}

/**
 * Exchange authorization code for tokens
 */
interface TokenResponse {
	access_token: string;
	refresh_token?: string;
	expires_in?: number;
	token_type: string;
}

async function exchangeCodeForTokens(
	env: Env,
	provider: string,
	code: string,
	redirectUri: string,
): Promise<TokenResponse> {
	const providerConfig = OAUTH_PROVIDERS[provider];
	if (!providerConfig) {
		throw new Error(`Unknown provider: ${provider}`);
	}

	const clientId = getClientId(env, provider);
	const clientSecret = getClientSecret(env, provider);

	const body = new URLSearchParams({
		grant_type: "authorization_code",
		code,
		redirect_uri: redirectUri,
		client_id: clientId,
		client_secret: clientSecret,
	});

	const headers: Record<string, string> = {
		"Content-Type": "application/x-www-form-urlencoded",
	};

	// Notion requires Basic auth
	if (provider === "notion") {
		const auth = btoa(`${clientId}:${clientSecret}`);
		headers.Authorization = `Basic ${auth}`;
	}

	const response = await fetch(providerConfig.tokenUrl, {
		method: "POST",
		headers,
		body: body.toString(),
	});

	if (!response.ok) {
		const errorText = await response.text();
		throw new Error(`Token exchange failed: ${response.status} ${errorText}`);
	}

	return response.json() as Promise<TokenResponse>;
}

/**
 * Refresh an access token
 */
async function refreshAccessToken(env: Env, provider: string, refreshToken: string): Promise<TokenResponse> {
	const providerConfig = OAUTH_PROVIDERS[provider];
	if (!providerConfig) {
		throw new Error(`Unknown provider: ${provider}`);
	}

	const clientId = getClientId(env, provider);
	const clientSecret = getClientSecret(env, provider);

	const body = new URLSearchParams({
		grant_type: "refresh_token",
		refresh_token: refreshToken,
		client_id: clientId,
		client_secret: clientSecret,
	});

	const headers: Record<string, string> = {
		"Content-Type": "application/x-www-form-urlencoded",
	};

	// Notion requires Basic auth
	if (provider === "notion") {
		const auth = btoa(`${clientId}:${clientSecret}`);
		headers.Authorization = `Basic ${auth}`;
	}

	const response = await fetch(providerConfig.tokenUrl, {
		method: "POST",
		headers,
		body: body.toString(),
	});

	if (!response.ok) {
		const errorText = await response.text();
		throw new Error(`Token refresh failed: ${response.status} ${errorText}`);
	}

	return response.json() as Promise<TokenResponse>;
}

export { integrations };
