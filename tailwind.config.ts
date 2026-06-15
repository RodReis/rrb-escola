import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        serif: ["var(--font-serif)", "ui-serif", "Georgia", "serif"]
      },
      colors: {
        ink: "rgb(var(--color-ink) / <alpha-value>)",
        paper: "rgb(var(--color-paper) / <alpha-value>)",
        line: "rgb(var(--color-line) / <alpha-value>)",
        moss: "rgb(var(--color-primary) / <alpha-value>)",
        clay: "rgb(var(--color-danger) / <alpha-value>)",
        gold: "rgb(var(--color-warning) / <alpha-value>)",
        brand: "rgb(var(--color-brand) / <alpha-value>)",
        accent: "rgb(var(--color-accent) / <alpha-value>)",
        surface: "rgb(var(--color-surface) / <alpha-value>)",
        muted: "rgb(var(--color-muted) / <alpha-value>)",
        success: "rgb(var(--color-success) / <alpha-value>)",
        warning: "rgb(var(--color-warning) / <alpha-value>)",
        danger: "rgb(var(--color-danger) / <alpha-value>)"
      },
      boxShadow: {
        soft: "var(--shadow-soft)",
        lift: "var(--shadow-lift)",
        pill: "0 1px 2px rgba(11, 27, 74, 0.06)",
        ring: "0 0 0 4px rgba(27, 79, 216, 0.10)"
      },
      borderRadius: {
        ui: "var(--radius-ui)",
        panel: "var(--radius-panel)",
        pill: "9999px"
      },
      letterSpacing: {
        kicker: "0.14em"
      },
      keyframes: {
        fadeInUp: {
          "0%": { opacity: "0", transform: "translateY(6px)" },
          "100%": { opacity: "1", transform: "translateY(0)" }
        }
      },
      animation: {
        "fade-in-up": "fadeInUp 0.35s ease-out both"
      }
    }
  },
  plugins: []
};

export default config;
