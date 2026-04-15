import type { Config } from "tailwindcss";
import typography from "@tailwindcss/typography";
import defaultTheme from "tailwindcss/defaultTheme";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  darkMode: "class",
  future: {
    hoverOnlyWhenSupported: true,
  },
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)", ...defaultTheme.fontFamily.sans],
        display: ["var(--font-display)", ...defaultTheme.fontFamily.sans],
      },
      fontSize: {
        /* Lumina Editorial type scale */
        "display-lg": ["3.5rem", { lineHeight: "1.1", letterSpacing: "-0.02em", fontWeight: "800" }],
        "display-md": ["2.75rem", { lineHeight: "1.15", letterSpacing: "-0.02em", fontWeight: "800" }],
        "headline-lg": ["2rem", { lineHeight: "1.2", letterSpacing: "-0.015em", fontWeight: "700" }],
        "headline-md": ["1.75rem", { lineHeight: "1.25", letterSpacing: "-0.01em", fontWeight: "700" }],
        "headline-sm": ["1.5rem", { lineHeight: "1.3", letterSpacing: "-0.01em", fontWeight: "600" }],
        "title-lg": ["1.375rem", { lineHeight: "1.4", fontWeight: "600" }],
        "title-md": ["1.125rem", { lineHeight: "1.45", fontWeight: "600" }],
        "title-sm": ["1rem", { lineHeight: "1.5", fontWeight: "600" }],
        "body-lg": ["1rem", { lineHeight: "1.6", fontWeight: "400" }],
        "body-md": ["0.875rem", { lineHeight: "1.6", fontWeight: "400" }],
        "body-sm": ["0.8125rem", { lineHeight: "1.5", fontWeight: "400" }],
        "label-lg": ["0.875rem", { lineHeight: "1.4", letterSpacing: "0.02em", fontWeight: "600" }],
        "label-md": ["0.75rem", { lineHeight: "1.4", letterSpacing: "0.04em", fontWeight: "600" }],
        "label-sm": ["0.6875rem", { lineHeight: "1.4", letterSpacing: "0.06em", fontWeight: "500" }],
      },
      colors: {
        /* ── Lumina Editorial — Primary Architecture ─────── */
        primary: {
          DEFAULT: "#3525cd",
          container: "#4f46e5",
          on: "#ffffff",
          "on-container": "#e0e0ff",
        },
        /* ── Secondary — Corporate Reliability ──────────── */
        secondary: {
          DEFAULT: "#0051d5",
          container: "#316bf3",
          on: "#ffffff",
          "on-container": "#d6e4ff",
        },
        /* ── Tertiary — Muted Silver/Slate ──────────────── */
        tertiary: {
          DEFAULT: "#474948",
          container: "#5e6160",
          on: "#ffffff",
          "on-container": "#c6c9c8",
        },
        /* ── Surfaces — warm gallery-white canvas ────────── */
        surface: {
          DEFAULT:        "var(--ed-surface)",
          dim:            "var(--ed-surface-dim)",
          bright:         "var(--ed-surface-bright)",
          "container-lowest":  "var(--ed-surface-container-lowest)",
          "container-low":     "var(--ed-surface-container-low)",
          container:           "var(--ed-surface-container)",
          "container-high":    "var(--ed-surface-container-high)",
          "container-highest": "var(--ed-surface-container-highest)",
        },
        /* ── On-surface (ink-on-paper) ──────────────────── */
        "on-surface": {
          DEFAULT: "#1d1b1a",
          variant: "#49454f",
        },
        /* ── Outline ────────────────────────────────────── */
        outline: {
          DEFAULT: "#79747e",
          variant: "#cac4d0",
        },
        /* ── Legacy aliases (keeps existing category usage) */
        brand: {
          50:  "#eff6ff",
          100: "#dbeafe",
          200: "#bfdbfe",
          300: "#93c5fd",
          400: "#60a5fa",
          500: "#3b82f6",
          600: "#3525cd",
          700: "#4f46e5",
          800: "#1e40af",
          900: "#1e3a8a",
          950: "#172554",
        },
        accent: {
          50:  "#fff7ed",
          100: "#ffedd5",
          200: "#fed7aa",
          300: "#fdba74",
          400: "#fb923c",
          500: "#f97316",
          600: "#ea580c",
          700: "#c2410c",
          800: "#9a3412",
          900: "#7c2d12",
        },
        category: {
          news: { light: '#eef0ff', DEFAULT: '#3525cd', dark: '#4f46e5' },
          bourses: { light: '#fffbeb', DEFAULT: '#d97706', dark: '#b45309' },
          calendar: { light: '#fff7ed', DEFAULT: '#ea580c', dark: '#c2410c' },
          universities: { light: '#eef2ff', DEFAULT: '#4f46e5', dark: '#4338ca' },
          resources: { light: '#f5f3ff', DEFAULT: '#7c3aed', dark: '#6d28d9' },
          success: { light: '#ecfdf5', DEFAULT: '#059669', dark: '#047857' },
          history: { light: '#fef2f2', DEFAULT: '#9f1239', dark: '#881337' },
          haiti: { light: '#fef2f2', DEFAULT: '#dc2626', dark: '#b91c1c' },
        },
        ink: {
          DEFAULT: '#1d1b1a',
          light: '#49454f',
        },
      },
      boxShadow: {
        /* ── Lumina Editorial — Ambient Shadows ──────────── */
        soft: "0 1px 2px 0 rgba(29, 27, 26, 0.03)",
        ambient: "0 20px 40px rgba(29, 27, 26, 0.05)",
        "ambient-lg": "0 28px 56px rgba(29, 27, 26, 0.07)",
        lift: "0 4px 24px -4px rgba(29, 27, 26, 0.06), 0 2px 8px -2px rgba(29, 27, 26, 0.03)",
        "lift-dark": "0 4px 24px -4px rgb(0 0 0 / 0.3), 0 2px 8px -2px rgb(0 0 0 / 0.2)",
        card: "0 1px 3px 0 rgba(29, 27, 26, 0.03)",
        "card-hover": "0 12px 32px -8px rgba(29, 27, 26, 0.08), 0 4px 12px -4px rgba(29, 27, 26, 0.03)",
        "card-dark": "0 1px 2px 0 rgb(0 0 0 / 0.15)",
        "card-dark-hover": "0 12px 32px -8px rgb(0 0 0 / 0.35)",
        float: "0 20px 40px rgba(29, 27, 26, 0.05)",
        glow: "0 0 32px rgb(53 37 205 / 0.12)",
        "glow-warm": "0 0 32px rgb(234 88 12 / 0.12)",
        nav: "0 1px 0 0 rgba(29, 27, 26, 0.04)",
        "inner-glow": "inset 0 1px 0 0 rgb(255 255 255 / 0.05)",
        premium: '0 1px 3px 0 rgba(29, 27, 26, 0.04), 0 1px 2px -1px rgba(29, 27, 26, 0.03)',
        'premium-hover': '0 10px 25px -5px rgba(29, 27, 26, 0.07), 0 8px 10px -6px rgba(29, 27, 26, 0.03)',
        'premium-dark': '0 1px 3px 0 rgb(0 0 0 / 0.2)',
        'premium-dark-hover': '0 10px 25px -5px rgb(0 0 0 / 0.4)',
      },
      borderRadius: {
        'sm': '0.25rem',
        'md': '0.375rem',
        'lg': '0.5rem',
        'xl': '0.75rem',
        '2xl': '1rem',
        '3xl': '1.5rem',
        "4xl": "2rem",
      },
      spacing: {
        "section": "5rem",
        "section-sm": "3rem",
        "editorial-gap": "3rem",    /* 48px between news items */
        "editorial-gap-lg": "4rem", /* 64px between news items */
      },
      backgroundImage: {
        /* Lumina signature silk gradient */
        "silk": "linear-gradient(135deg, #3525cd, #4f46e5)",
        "silk-hover": "linear-gradient(135deg, #2c1fb8, #4338ca)",
      },
      keyframes: {
        "fade-in": {
          "0%": { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in-scale": {
          "0%": { opacity: "0", transform: "scale(0.96)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        "slide-down": {
          "0%": { opacity: "0", transform: "translateY(-12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "slide-up": {
          "0%": { opacity: "0", transform: "translateY(20px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        "slide-underline": {
          "0%": { transform: "scaleX(0)" },
          "100%": { transform: "scaleX(1)" },
        },
        "pulse-soft": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.7" },
        },
        "spin-slow": {
          "0%": { transform: "rotate(0deg)" },
          "100%": { transform: "rotate(360deg)" },
        },
        ticker: {
          "0%": { transform: "translateX(0)" },
          "100%": { transform: "translateX(-50%)" },
        },
        'count-up': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'hover-lift': {
          '0%': { transform: 'translateY(0)' },
          '100%': { transform: 'translateY(-2px)' },
        },
      },
      animation: {
        "fade-in": "fade-in 0.5s cubic-bezier(0.16,1,0.3,1) forwards",
        "fade-in-scale": "fade-in-scale 0.4s cubic-bezier(0.16,1,0.3,1) forwards",
        "slide-down": "slide-down 0.4s cubic-bezier(0.16,1,0.3,1) forwards",
        "slide-up": "slide-up 0.5s cubic-bezier(0.16,1,0.3,1) forwards",
        shimmer: "shimmer 2s linear infinite",
        "slide-underline": "slide-underline 0.3s cubic-bezier(0.16,1,0.3,1) forwards",
        "pulse-soft": "pulse-soft 2s ease-in-out infinite",
        "spin-slow": "spin-slow 8s linear infinite",
        ticker: "ticker 30s linear infinite",
        'count-up': 'count-up 0.4s cubic-bezier(0.16,1,0.3,1) forwards',
      },
    },
  },
  plugins: [typography],
};
export default config;
