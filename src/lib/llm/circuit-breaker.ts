/**
 * Circuit Breaker for LLM Providers
 * Tracks provider health and implements circuit breaker pattern
 *
 * States:
 * - closed: Normal operation, requests flow through
 * - open: Provider is failing, requests are rejected
 * - half_open: Testing if provider has recovered
 */

import type { CircuitBreakerState } from "../../types";

/**
 * Circuit breaker configuration
 */
export interface CircuitBreakerConfig {
	/** Number of failures before opening circuit */
	failureThreshold: number;
	/** Time in ms before attempting recovery */
	resetTimeout: number;
	/** Number of successes needed to close circuit */
	successThreshold: number;
	/** Time window for counting failures (ms) */
	failureWindow: number;
}

const DEFAULT_CONFIG: CircuitBreakerConfig = {
	failureThreshold: 5,
	resetTimeout: 60000, // 1 minute
	successThreshold: 3,
	failureWindow: 300000, // 5 minutes
};

/**
 * Provider circuit state
 */
interface ProviderCircuit {
	state: "closed" | "open" | "half_open";
	failures: number[];
	successes: number;
	lastFailure?: number;
	openedAt?: number;
	lastStateChange: number;
}

/**
 * Circuit Breaker Manager
 * Manages circuit state for multiple providers
 */
export class CircuitBreakerManager {
	private circuits: Map<string, ProviderCircuit>;
	private config: CircuitBreakerConfig;

	constructor(config?: Partial<CircuitBreakerConfig>) {
		this.circuits = new Map();
		this.config = { ...DEFAULT_CONFIG, ...config };
	}

	/**
	 * Check if a request can be made to a provider
	 */
	canRequest(providerId: string): boolean {
		const circuit = this.getCircuit(providerId);

		switch (circuit.state) {
			case "closed":
				return true;

			case "open": {
				// Check if reset timeout has passed
				const now = Date.now();
				if (circuit.openedAt && now - circuit.openedAt >= this.config.resetTimeout) {
					// Transition to half-open
					circuit.state = "half_open";
					circuit.successes = 0;
					circuit.lastStateChange = now;
					return true;
				}
				return false;
			}

			case "half_open":
				return true;

			default:
				return true;
		}
	}

	/**
	 * Record a successful request
	 */
	recordSuccess(providerId: string): void {
		const circuit = this.getCircuit(providerId);

		switch (circuit.state) {
			case "half_open":
				circuit.successes++;
				if (circuit.successes >= this.config.successThreshold) {
					// Close the circuit
					circuit.state = "closed";
					circuit.failures = [];
					circuit.openedAt = undefined;
					circuit.lastStateChange = Date.now();
				}
				break;

			case "closed": {
				// Clear old failures outside the window
				const now = Date.now();
				circuit.failures = circuit.failures.filter((f) => now - f < this.config.failureWindow);
				break;
			}
		}
	}

	/**
	 * Record a failed request
	 */
	recordFailure(providerId: string, _error?: Error): void {
		const circuit = this.getCircuit(providerId);
		const now = Date.now();

		switch (circuit.state) {
			case "closed": {
				// Add failure and clean old ones
				circuit.failures.push(now);
				circuit.failures = circuit.failures.filter((f) => now - f < this.config.failureWindow);
				circuit.lastFailure = now;

				// Check if threshold exceeded
				if (circuit.failures.length >= this.config.failureThreshold) {
					circuit.state = "open";
					circuit.openedAt = now;
					circuit.lastStateChange = now;
				}
				break;
			}

			case "half_open":
				// Any failure in half-open reopens the circuit
				circuit.state = "open";
				circuit.openedAt = now;
				circuit.successes = 0;
				circuit.lastStateChange = now;
				break;

			case "open":
				// Update last failure time
				circuit.lastFailure = now;
				break;
		}
	}

	/**
	 * Get circuit state for a provider
	 */
	getState(providerId: string): CircuitBreakerState {
		const circuit = this.getCircuit(providerId);

		// Calculate health score based on failure rate
		const failureRate = circuit.failures.length / this.config.failureThreshold;
		const healthScore = Math.max(0, 1 - failureRate);

		return {
			provider_id: providerId,
			state: circuit.state,
			failure_count: circuit.failures.length,
			last_state_change: new Date(circuit.lastStateChange).toISOString(),
			next_retry_at: circuit.openedAt ? new Date(circuit.openedAt + this.config.resetTimeout).toISOString() : null,
			health_score: healthScore,
		};
	}

	/**
	 * Get states for all providers
	 */
	getAllStates(): Map<string, CircuitBreakerState> {
		const states = new Map<string, CircuitBreakerState>();
		for (const [providerId] of this.circuits) {
			states.set(providerId, this.getState(providerId));
		}
		return states;
	}

	/**
	 * Force reset a circuit
	 */
	reset(providerId: string): void {
		this.circuits.set(providerId, {
			state: "closed",
			failures: [],
			successes: 0,
			lastStateChange: Date.now(),
		});
	}

	/**
	 * Force open a circuit (for maintenance)
	 */
	forceOpen(providerId: string): void {
		const circuit = this.getCircuit(providerId);
		const now = Date.now();
		circuit.state = "open";
		circuit.openedAt = now;
		circuit.lastStateChange = now;
	}

	/**
	 * Get or create circuit for provider
	 */
	private getCircuit(providerId: string): ProviderCircuit {
		let circuit = this.circuits.get(providerId);
		if (!circuit) {
			circuit = {
				state: "closed",
				failures: [],
				successes: 0,
				lastStateChange: Date.now(),
			};
			this.circuits.set(providerId, circuit);
		}
		return circuit;
	}

	/**
	 * Export circuit states as health map for router
	 */
	getHealthMap(): Map<string, boolean> {
		const health = new Map<string, boolean>();
		for (const [providerId, circuit] of this.circuits) {
			health.set(providerId, circuit.state !== "open");
		}
		return health;
	}
}

/**
 * Global circuit breaker instance (singleton per isolate)
 */
let globalCircuitBreaker: CircuitBreakerManager | undefined;

/**
 * Get the global circuit breaker instance
 */
export function getCircuitBreaker(config?: Partial<CircuitBreakerConfig>): CircuitBreakerManager {
	if (!globalCircuitBreaker) {
		globalCircuitBreaker = new CircuitBreakerManager(config);
	}
	return globalCircuitBreaker;
}
