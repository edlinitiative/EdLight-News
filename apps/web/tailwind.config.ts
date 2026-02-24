import type { Config } from "tailwindcss";
import typography from "@tailwindcss/typography";
import colors from "tailwindcss/colors";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Use Tailwind's built-in palette (no custom hex values)
        // so the app can consistently reference `brand-*` tokens.
        brand: colors.blue,
      },
    },
  },
  plugins: [typography],
};
export default config;
