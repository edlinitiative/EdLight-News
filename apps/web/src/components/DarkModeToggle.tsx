"use client";

import { useTheme } from "@/lib/theme-context";
import { Moon, Sun } from "lucide-react";
import { motion } from "framer-motion";

export function DarkModeToggle() {
  const { theme, toggle } = useTheme();
  const isDark = theme === "dark";

  return (
    <button
      onClick={toggle}
      aria-label={isDark ? "Mode clair" : "Mode sombre"}
      className="group relative flex h-8 w-[52px] items-center rounded-full border border-gray-200 bg-gray-100 p-0.5 transition-colors hover:border-brand-300 hover:shadow-glow dark:border-slate-600 dark:bg-slate-700 dark:hover:border-brand-500/50"
    >
      {/* Track highlight */}
      <span
        className={[
          "absolute inset-0.5 rounded-full transition-colors duration-300",
          isDark ? "bg-slate-700" : "bg-gray-100",
        ].join(" ")}
      />

      {/* Sliding knob with spring physics */}
      <motion.span
        layout
        transition={{ type: "spring", stiffness: 500, damping: 30 }}
        className={[
          "relative z-10 flex h-6 w-6 items-center justify-center rounded-full shadow-md",
          isDark
            ? "bg-slate-900 ring-1 ring-brand-500/30"
            : "bg-white ring-1 ring-gray-200",
        ].join(" ")}
        style={{ x: isDark ? 22 : 0 }}
      >
        {isDark ? (
          <Moon className="h-3.5 w-3.5 text-brand-400" />
        ) : (
          <Sun className="h-3.5 w-3.5 text-gray-500" />
        )}
      </motion.span>
    </button>
  );
}
