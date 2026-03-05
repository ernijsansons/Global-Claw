/**
 * WebSocket API
 * GET /api/ws
 *
 * Real-time updates for dashboard:
 * - Agent status changes
 * - Message count updates
 * - LLM call completions
 * - Workflow run updates
 * - Budget alerts
 */

import { Hono } from "hono";
import { verifyJWT } from "../lib/auth/jwt";
import type { Env } from "../types/env";

const ws = new Hono<{ Bindings: Env }>();

/**
 * WebSocket message types
 */
interface WSMessage {
	type: string;
	timestamp: string;
	data?: Record<string, unknown>;
}

/**
 * GET /api/ws
 * WebSocket upgrade endpoint
 *
 * Auth: JWT token passed as ?token= query parameter
 * IMPORTANT: Logger middleware scrubs ?token= from logs
 */
ws.get("/ws", async (c) => {
	// Check for WebSocket upgrade
	const upgradeHeader = c.req.header("Upgrade");
	if (upgradeHeader !== "websocket") {
		return c.json(
			{
				success: false,
				error: { code: "BAD_REQUEST", message: "Expected WebSocket upgrade" },
			},
			400,
		);
	}

	// Get token from query parameter
	const token = c.req.query("token");
	if (!token) {
		return c.json(
			{
				success: false,
				error: { code: "UNAUTHORIZED", message: "Missing token parameter" },
			},
			401,
		);
	}

	// Verify JWT
	let payload: { sub: string; tenant_id: string };
	try {
		payload = await verifyJWT(token, c.env.JWT_SECRET);
	} catch {
		return c.json(
			{
				success: false,
				error: { code: "UNAUTHORIZED", message: "Invalid or expired token" },
			},
			401,
		);
	}

	// Create WebSocket pair
	const webSocketPair = new WebSocketPair();
	const [client, server] = [webSocketPair[0], webSocketPair[1]];

	// Accept the WebSocket
	server.accept();

	// Send connection confirmation
	const connectionMessage: WSMessage = {
		type: "connection",
		timestamp: new Date().toISOString(),
		data: {
			status: "connected",
			user_id: payload.sub,
			tenant_id: payload.tenant_id,
		},
	};
	server.send(JSON.stringify(connectionMessage));

	// Handle incoming messages
	server.addEventListener("message", async (event) => {
		try {
			const message = JSON.parse(event.data as string) as { type: string; data?: Record<string, unknown> };

			// Handle different message types
			switch (message.type) {
				case "ping":
					server.send(JSON.stringify({ type: "pong", timestamp: new Date().toISOString() }));
					break;

				case "subscribe":
					// Client wants to subscribe to specific events
					// In a full implementation, we'd track subscriptions
					server.send(
						JSON.stringify({
							type: "subscribed",
							timestamp: new Date().toISOString(),
							data: { channel: message.data?.channel },
						}),
					);
					break;

				default:
					server.send(
						JSON.stringify({
							type: "error",
							timestamp: new Date().toISOString(),
							data: { message: `Unknown message type: ${message.type}` },
						}),
					);
			}
		} catch (_err) {
			server.send(
				JSON.stringify({
					type: "error",
					timestamp: new Date().toISOString(),
					data: { message: "Invalid message format" },
				}),
			);
		}
	});

	// Handle close
	server.addEventListener("close", () => {
		// Clean up any subscriptions
	});

	// Handle errors
	server.addEventListener("error", () => {
		// Log and clean up
	});

	// Return the WebSocket response
	return new Response(null, {
		status: 101,
		webSocket: client,
	});
});

/**
 * Helper function to broadcast messages to connected clients
 * This would be called from other parts of the system
 */
export function createWSMessage(
	type:
		| "agent_status_changed"
		| "message_count_updated"
		| "llm_call_completed"
		| "workflow_run_updated"
		| "memory_updated"
		| "budget_alert"
		| "user_presence",
	data: Record<string, unknown>,
): WSMessage {
	return {
		type,
		timestamp: new Date().toISOString(),
		data,
	};
}

export { ws };
