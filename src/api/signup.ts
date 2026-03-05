/**
 * Signup API Routes
 * POST /api/signup - Triggers provisioning workflow
 *
 * This endpoint creates new tenants through the provisioning workflow.
 * It can be called directly (free trial) or from Stripe webhook (paid plans).
 */

import { Hono } from "hono";
import type { ApiResponse } from "../types";
import type { Env } from "../types/env";
import type { ProvisioningInput, ProvisioningOutput } from "../workflows/provisioning";

const signup = new Hono<{ Bindings: Env }>();

/**
 * Signup request body
 */
interface SignupBody {
	email: string;
	name?: string;
	plan?: "starter" | "pro" | "business" | "enterprise";
	referral_code?: string;
}

/**
 * POST /api/signup
 *
 * Create a new tenant account and trigger the provisioning workflow.
 *
 * Request body:
 * - email: string (required) - User's email address
 * - name: string (optional) - Tenant name
 * - plan: string (optional) - Plan tier (defaults to starter)
 * - referral_code: string (optional) - Partner referral code
 */
signup.post("/", async (c) => {
	const body = await c.req.json<SignupBody>();

	// Validate required fields
	if (!body.email) {
		return c.json(
			{
				success: false,
				error: {
					code: "VALIDATION_ERROR",
					message: "Email is required",
				},
			},
			400,
		);
	}

	// Validate email format
	const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
	if (!emailRegex.test(body.email)) {
		return c.json(
			{
				success: false,
				error: {
					code: "VALIDATION_ERROR",
					message: "Invalid email format",
				},
			},
			400,
		);
	}

	// Check if user already exists
	const existingUser = await c.env.DB.prepare("SELECT id FROM users WHERE email = ?")
		.bind(body.email.toLowerCase())
		.first();

	if (existingUser) {
		return c.json(
			{
				success: false,
				error: {
					code: "USER_EXISTS",
					message: "An account with this email already exists",
				},
			},
			409,
		);
	}

	// Validate plan if provided
	const validPlans = ["starter", "pro", "business", "enterprise"];
	const plan = body.plan ?? "starter";
	if (!validPlans.includes(plan)) {
		return c.json(
			{
				success: false,
				error: {
					code: "VALIDATION_ERROR",
					message: `Invalid plan. Must be one of: ${validPlans.join(", ")}`,
				},
			},
			400,
		);
	}

	// Validate referral code if provided
	if (body.referral_code) {
		const partner = await c.env.DB.prepare("SELECT id FROM partners WHERE referral_code = ? AND status = 'active'")
			.bind(body.referral_code)
			.first();

		if (!partner) {
			return c.json(
				{
					success: false,
					error: {
						code: "INVALID_REFERRAL",
						message: "Invalid or inactive referral code",
					},
				},
				400,
			);
		}
	}

	// Trigger provisioning workflow
	const workflowInput: ProvisioningInput = {
		email: body.email.toLowerCase(),
		name: body.name,
		plan: plan as ProvisioningInput["plan"],
		referral_code: body.referral_code,
	};

	try {
		// Create a new workflow instance
		const workflowId = crypto.randomUUID();
		const instance = await c.env.PROVISIONING_WORKFLOW.create({
			id: workflowId,
			params: workflowInput,
		});

		// Get the workflow status (it should start running immediately)
		const status = await instance.status();

		const response: ApiResponse<{
			workflow_id: string;
			status: string;
			message: string;
		}> = {
			success: true,
			data: {
				workflow_id: workflowId,
				status: status.status,
				message: "Account provisioning started. You will receive an email with your API key shortly.",
			},
		};

		return c.json(response, 202);
	} catch (err) {
		console.error("Failed to start provisioning workflow:", err);

		return c.json(
			{
				success: false,
				error: {
					code: "PROVISIONING_ERROR",
					message: "Failed to start account provisioning. Please try again later.",
				},
			},
			500,
		);
	}
});

/**
 * GET /api/signup/status/:workflowId
 *
 * Check the status of a provisioning workflow.
 */
signup.get("/status/:workflowId", async (c) => {
	const workflowId = c.req.param("workflowId");

	try {
		const instance = await c.env.PROVISIONING_WORKFLOW.get(workflowId);
		const status = await instance.status();

		// If completed, include the output
		let output: ProvisioningOutput | null = null;
		if (status.status === "complete" && status.output) {
			output = status.output as ProvisioningOutput;
		}

		const response: ApiResponse<{
			workflow_id: string;
			status: string;
			output?: {
				tenant_id: string;
				subdomain: string;
			};
			error?: string;
		}> = {
			success: true,
			data: {
				workflow_id: workflowId,
				status: status.status,
				output: output
					? {
							tenant_id: output.tenant_id,
							subdomain: output.subdomain,
							// Don't expose the full API key in status check
						}
					: undefined,
				error: status.error?.message,
			},
		};

		return c.json(response);
	} catch {
		return c.json(
			{
				success: false,
				error: {
					code: "NOT_FOUND",
					message: "Workflow not found",
				},
			},
			404,
		);
	}
});

export { signup };
