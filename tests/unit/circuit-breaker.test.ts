/**
 * Circuit Breaker Tests
 * Phase 3: Provider health tracking and fallback
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CircuitBreakerManager, getCircuitBreaker } from "../../src/lib/llm/circuit-breaker";

describe("CircuitBreakerManager", () => {
	let circuitBreaker: CircuitBreakerManager;

	beforeEach(() => {
		vi.useFakeTimers();
		circuitBreaker = new CircuitBreakerManager({
			failureThreshold: 3,
			resetTimeout: 60000, // 1 minute
			successThreshold: 2,
			failureWindow: 300000, // 5 minutes
		});
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	describe("canRequest()", () => {
		it("should allow requests for new providers (closed state)", () => {
			expect(circuitBreaker.canRequest("provider-1")).toBe(true);
		});

		it("should allow requests in closed state", () => {
			// Record some failures but not enough to open
			circuitBreaker.recordFailure("provider-1");
			circuitBreaker.recordFailure("provider-1");

			expect(circuitBreaker.canRequest("provider-1")).toBe(true);
		});

		it("should deny requests when circuit is open", () => {
			// Record enough failures to open circuit
			circuitBreaker.recordFailure("provider-1");
			circuitBreaker.recordFailure("provider-1");
			circuitBreaker.recordFailure("provider-1");

			expect(circuitBreaker.canRequest("provider-1")).toBe(false);
		});

		it("should transition to half-open after reset timeout", () => {
			// Open the circuit
			circuitBreaker.recordFailure("provider-1");
			circuitBreaker.recordFailure("provider-1");
			circuitBreaker.recordFailure("provider-1");

			expect(circuitBreaker.canRequest("provider-1")).toBe(false);

			// Advance time past reset timeout
			vi.advanceTimersByTime(60001);

			// Should now allow request (half-open state)
			expect(circuitBreaker.canRequest("provider-1")).toBe(true);

			// State should be half-open
			const state = circuitBreaker.getState("provider-1");
			expect(state.state).toBe("half_open");
		});
	});

	describe("recordSuccess()", () => {
		it("should keep circuit closed after success", () => {
			circuitBreaker.recordSuccess("provider-1");

			const state = circuitBreaker.getState("provider-1");
			expect(state.state).toBe("closed");
		});

		it("should close circuit after enough successes in half-open state", () => {
			// Open the circuit
			circuitBreaker.recordFailure("provider-1");
			circuitBreaker.recordFailure("provider-1");
			circuitBreaker.recordFailure("provider-1");

			// Advance to half-open
			vi.advanceTimersByTime(60001);
			circuitBreaker.canRequest("provider-1"); // Triggers transition

			// Record successes
			circuitBreaker.recordSuccess("provider-1");
			expect(circuitBreaker.getState("provider-1").state).toBe("half_open");

			circuitBreaker.recordSuccess("provider-1");
			expect(circuitBreaker.getState("provider-1").state).toBe("closed");
		});

		it("should clear failure history when closing circuit", () => {
			// Open the circuit
			circuitBreaker.recordFailure("provider-1");
			circuitBreaker.recordFailure("provider-1");
			circuitBreaker.recordFailure("provider-1");

			// Advance to half-open and close
			vi.advanceTimersByTime(60001);
			circuitBreaker.canRequest("provider-1");
			circuitBreaker.recordSuccess("provider-1");
			circuitBreaker.recordSuccess("provider-1");

			// Failure count should be reset
			const state = circuitBreaker.getState("provider-1");
			expect(state.failure_count).toBe(0);
		});
	});

	describe("recordFailure()", () => {
		it("should open circuit after threshold failures", () => {
			circuitBreaker.recordFailure("provider-1");
			expect(circuitBreaker.getState("provider-1").state).toBe("closed");

			circuitBreaker.recordFailure("provider-1");
			expect(circuitBreaker.getState("provider-1").state).toBe("closed");

			circuitBreaker.recordFailure("provider-1");
			expect(circuitBreaker.getState("provider-1").state).toBe("open");
		});

		it("should reopen circuit on failure in half-open state", () => {
			// Open the circuit
			circuitBreaker.recordFailure("provider-1");
			circuitBreaker.recordFailure("provider-1");
			circuitBreaker.recordFailure("provider-1");

			// Advance to half-open
			vi.advanceTimersByTime(60001);
			circuitBreaker.canRequest("provider-1");

			expect(circuitBreaker.getState("provider-1").state).toBe("half_open");

			// Record failure
			circuitBreaker.recordFailure("provider-1");

			expect(circuitBreaker.getState("provider-1").state).toBe("open");
		});

		it("should clear old failures outside window", () => {
			circuitBreaker.recordFailure("provider-1");
			circuitBreaker.recordFailure("provider-1");

			// Advance past failure window
			vi.advanceTimersByTime(300001);

			// Record one more failure - shouldn't open (old ones expired)
			circuitBreaker.recordFailure("provider-1");

			// Should still be closed (only 1 recent failure)
			expect(circuitBreaker.getState("provider-1").state).toBe("closed");
		});
	});

	describe("getState()", () => {
		it("should return state for provider", () => {
			const state = circuitBreaker.getState("provider-1");

			expect(state.provider_id).toBe("provider-1");
			expect(state.state).toBe("closed");
			expect(state.failure_count).toBe(0);
			expect(state.health_score).toBe(1.0);
		});

		it("should calculate health score based on failures", () => {
			circuitBreaker.recordFailure("provider-1");
			const state = circuitBreaker.getState("provider-1");

			// 1 failure out of 3 threshold = ~0.67 health
			expect(state.health_score).toBeCloseTo(0.67, 1);
		});

		it("should include next retry time when open", () => {
			circuitBreaker.recordFailure("provider-1");
			circuitBreaker.recordFailure("provider-1");
			circuitBreaker.recordFailure("provider-1");

			const state = circuitBreaker.getState("provider-1");

			expect(state.state).toBe("open");
			expect(state.next_retry_at).not.toBeNull();
		});
	});

	describe("getAllStates()", () => {
		it("should return states for all tracked providers", () => {
			circuitBreaker.recordSuccess("provider-1");
			circuitBreaker.recordFailure("provider-2");

			const states = circuitBreaker.getAllStates();

			expect(states.size).toBe(2);
			expect(states.has("provider-1")).toBe(true);
			expect(states.has("provider-2")).toBe(true);
		});
	});

	describe("reset()", () => {
		it("should reset provider to closed state", () => {
			// Open the circuit
			circuitBreaker.recordFailure("provider-1");
			circuitBreaker.recordFailure("provider-1");
			circuitBreaker.recordFailure("provider-1");

			expect(circuitBreaker.getState("provider-1").state).toBe("open");

			// Reset
			circuitBreaker.reset("provider-1");

			expect(circuitBreaker.getState("provider-1").state).toBe("closed");
			expect(circuitBreaker.canRequest("provider-1")).toBe(true);
		});
	});

	describe("forceOpen()", () => {
		it("should force circuit to open state", () => {
			circuitBreaker.forceOpen("provider-1");

			expect(circuitBreaker.getState("provider-1").state).toBe("open");
			expect(circuitBreaker.canRequest("provider-1")).toBe(false);
		});
	});

	describe("getHealthMap()", () => {
		it("should return health status for all providers", () => {
			circuitBreaker.recordSuccess("provider-1");
			circuitBreaker.recordFailure("provider-2");
			circuitBreaker.recordFailure("provider-2");
			circuitBreaker.recordFailure("provider-2");

			const healthMap = circuitBreaker.getHealthMap();

			expect(healthMap.get("provider-1")).toBe(true);
			expect(healthMap.get("provider-2")).toBe(false); // Open = unhealthy
		});
	});
});

describe("getCircuitBreaker()", () => {
	it("should return singleton instance", () => {
		const cb1 = getCircuitBreaker();
		const cb2 = getCircuitBreaker();

		expect(cb1).toBe(cb2);
	});

	it("should accept config on first call", () => {
		// Note: This test may be flaky if run after other tests
		// that already created the singleton
		const cb = getCircuitBreaker({ failureThreshold: 10 });
		expect(cb).toBeInstanceOf(CircuitBreakerManager);
	});
});
