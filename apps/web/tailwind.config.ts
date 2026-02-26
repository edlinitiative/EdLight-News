import type { Config } from "tailwindcss";
import typography from "@tailwindcss/typography";
import defaultTheme from "tailwindcss/defaultTheme";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)", ...defaultTheme.fontFamily.sans],
        serif: ["var(--font-serif)", ...defaultTheme.fontFamily.serif],
      },
      colors: {
        brand: {
          50:  "#eef5ff",
          100: "#d9e8ff",
          200: "#bbdaff",
          300: "#8dc3ff",
          400: "#58a1ff",
          500: "#3381fc",
          600: "#1a5ff1",
          700: "#1549de",
          800: "#173db4",
          900: "#19378d",
          950: "#142356",
        },
        surface: {
          DEFAULT: "var(--surface)",
          raised: "var(--surface-raised)",
          overlay: "var(--surface-overlay)",
        },
      },
      borderRadius: {
        card: "14px",
      },
      boxShadow: {
        card: "0 1px 3px 0 rgb(0 0 0 / 0.04), 0 1px 2px -1px rgb(0 0 0 / 0.04)",
        "card-hover": "0 8px 25px -5px rgb(0 0 0 / 0.08), 0 4px 10px -6px rgb(0 0 0 / 0.04)",
        "card-dark": "0 1px 3px 0 rgb(0 0 0 / 0.3), 0 1px 2px -1px rgb(0 0 0 / 0.2)",
        "card-dark-hover": "0 8px 25px -5px rgb(0 0 0 / 0.4), 0 4px 10px -6px rgb(0 0 0 / 0.3)",
        glow: "0 0 20px rgb(59 130 246 / 0.15)",
      },
      keyframes: {
        "slide-underline": {
          "0%": { transform: "scaleX(0)" },
          "100%": { transform: "scaleX(1)" },
        },
        "fade-in": {
          "0%": { opacity: "0", transform: "translateY(6px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "slide-underline": "slide-underline 0.25s ease-out forwards",
        "fade-in": "fade-in 0.3s ease-out forwards",
      },
    },
  },
  plugins: [typography],
};
export default config;
