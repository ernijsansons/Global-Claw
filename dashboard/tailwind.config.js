/** @type {import('tailwindcss').Config} */
export default {
	content: ["./src/**/*.{html,js,svelte,ts}"],
	darkMode: "class",
	theme: {
		extend: {
			colors: {
				// Neural Cartography Design System
				"gc-bg-root": "#0A0A0F",
				"gc-bg-surface": "#12121A",
				"gc-bg-elevated": "#1A1A26",
				"gc-border-subtle": "#1F1F2E",
				"gc-border-focus": "#3B82F6",
				"gc-text-primary": "#F0F0F5",
				"gc-text-secondary": "#8B8BA3",
				"gc-text-muted": "#4A4A6A",
				"gc-accent-blue": "#3B82F6",
				"gc-accent-emerald": "#10B981",
				"gc-accent-amber": "#F59E0B",
				"gc-accent-rose": "#EF4444",
				"gc-accent-violet": "#8B5CF6",
				"gc-accent-cyan": "#06B6D4",
			},
			fontFamily: {
				sans: ["InstrumentSans", "system-ui", "sans-serif"],
				mono: ["GeistMono", "monospace"],
				serif: ["YoungSerif", "serif"],
			},
			borderRadius: {
				gc: "12px",
			},
			spacing: {
				gc: "24px",
				"gc-compact": "20px",
			},
		},
	},
	plugins: [],
};
