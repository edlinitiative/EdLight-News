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
        serif: ["var(--font-serif)", ...defaultTheme.fontFamily.serif],
      },
      colors: {
        brand: {
          50:  "#eff6ff",
          100: "#dbeafe",
          200: "#bfdbfe",
          300: "#93c5fd",
          400: "#60a5fa",
          500: "#3b82f6",
          600: "#2563eb",
          700: "#1d4ed8",
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
        surface: {
          DEFAULT: "var(--surface)",
          raised: "var(--surface-raised)",
          overlay: "var(--surface-overlay)",
        },
        category: {
          news: { light: '#eff6ff', DEFAULT: '#2563eb', dark: '#1d4ed8' },
          bourses: { light: '#fffbeb', DEFAULT: '#d97706', dark: '#b45309' },
          calendar: { light: '#fff7ed', DEFAULT: '#ea580c', dark: '#c2410c' },
          universities: { light: '#eef2ff', DEFAULT: '#4f46e5', dark: '#4338ca' },
          resources: { light: '#f5f3ff', DEFAULT: '#7c3aed', dark: '#6d28d9' },
          success: { light: '#ecfdf5', DEFAULT: '#059669', dark: '#047857' },
          history: { light: '#fef2f2', DEFAULT: '#9f1239', dark: '#881337' },
          haiti: { light: '#fef2f2', DEFAULT: '#dc2626', dark: '#b91c1c' },
        },
        ink: {
          DEFAULT: '#0f172a',
          light: '#1e293b',
        },
      },
      boxShadow: {
        soft: "0 1px 2px 0 rgb(0 0 0 / 0.04)",
        lift: "0 4px 24px -4px rgb(0 0 0 / 0.08), 0 2px 8px -2px rgb(0 0 0 / 0.04)",
        "lift-dark": "0 4px 24px -4px rgb(0 0 0 / 0.3), 0 2px 8px -2px rgb(0 0 0 / 0.2)",
        card: "0 1px 2px 0 rgb(0 0 0 / 0.03)",
        "card-hover": "0 12px 32px -8px rgb(0 0 0 / 0.1), 0 4px 12px -4px rgb(0 0 0 / 0.04)",
        "card-dark": "0 1px 2px 0 rgb(0 0 0 / 0.15)",
        "card-dark-hover": "0 12px 32px -8px rgb(0 0 0 / 0.35)",
        float: "0 16px 48px -12px rgb(0 0 0 / 0.15), 0 4px 16px -4px rgb(0 0 0 / 0.06)",
        glow: "0 0 32px rgb(37 99 235 / 0.12)",
        "glow-warm": "0 0 32px rgb(234 88 12 / 0.12)",
        nav: "0 1px 0 0 rgb(0 0 0 / 0.04)",
        "inner-glow": "inset 0 1px 0 0 rgb(255 255 255 / 0.05)",
        premium: '0 1px 3px 0 rgb(0 0 0 / 0.04), 0 1px 2px -1px rgb(0 0 0 / 0.04)',
        'premium-hover': '0 10px 25px -5px rgb(0 0 0 / 0.08), 0 8px 10px -6px rgb(0 0 0 / 0.04)',
        'premium-dark': '0 1px 3px 0 rgb(0 0 0 / 0.2)',
        'premium-dark-hover': '0 10px 25px -5px rgb(0 0 0 / 0.4)',
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
        "4xl": "2rem",
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
