/**
 * Auth Store
 * Manages authentication state
 */

import { browser } from "$app/environment";
import { api } from "$lib/api";
import { derived, writable } from "svelte/store";

interface User {
	id: string;
	email: string;
	name?: string;
	tenant_id: string;
	role: string;
}

interface AuthState {
	user: User | null;
	loading: boolean;
	initialized: boolean;
}

function createAuthStore() {
	const { subscribe, set, update } = writable<AuthState>({
		user: null,
		loading: true,
		initialized: false,
	});

	return {
		subscribe,

		async init() {
			if (!browser) return;

			const token = api.getToken();
			if (token) {
				try {
					// Verify token is still valid by making an API call
					// For now, we'll just mark as initialized
					// In production, call /api/auth/me
					update((state) => ({ ...state, loading: false, initialized: true }));
				} catch {
					api.setToken(null);
					update((state) => ({ ...state, loading: false, initialized: true }));
				}
			} else {
				update((state) => ({ ...state, loading: false, initialized: true }));
			}
		},

		async login(email: string, password: string) {
			update((state) => ({ ...state, loading: true }));

			const response = await api.login(email, password);

			if (response.success && response.data) {
				api.setToken(response.data.token);
				update((state) => ({
					...state,
					user: response.data?.user as User,
					loading: false,
				}));
				return { success: true };
			}

			update((state) => ({ ...state, loading: false }));
			return { success: false, error: response.error?.message ?? "Login failed" };
		},

		logout() {
			api.setToken(null);
			set({ user: null, loading: false, initialized: true });
		},

		setUser(user: User) {
			update((state) => ({ ...state, user }));
		},
	};
}

export const auth = createAuthStore();

// Derived stores for convenience
export const isAuthenticated = derived(auth, ($auth) => !!$auth.user);
export const currentUser = derived(auth, ($auth) => $auth.user);
export const tenantId = derived(auth, ($auth) => $auth.user?.tenant_id);
