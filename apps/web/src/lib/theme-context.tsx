"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from "react";

type Theme = "light" | "dark";

interface ThemeContextValue {
  theme: Theme;
  toggle: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: "light",
  toggle: () => {},
});

const STORAGE_KEY = "edlight_theme";

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>("light");

  // Hydrate from localStorage or system preference
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === "dark" || stored === "light") {
        setTheme(stored);
        return;
      }
      // Fall back to system preference
      if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
        setTheme("dark");
      }
    } catch {
      // SSR or localStorage unavailable
    }
  }, []);

  // Apply class to <html>
  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
  }, [theme]);

  const toggle = useCallback(() => {
    setTheme((prev) => {
      const next = prev === "light" ? "dark" : "light";
      try {
        localStorage.setItem(STORAGE_KEY, next);
      } catch {}
      return next;
    });
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
