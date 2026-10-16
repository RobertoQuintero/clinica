"use client";

import { createContext, useContext, useEffect, ReactNode } from "react";
import { useIsClient } from "@/hooks/useIsClient";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useStorageValue } from "@/hooks/useStorageValue";

type Theme = "light" | "dark";

interface ThemeContextValue {
  theme: Theme;
  toggle: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: "light",
  toggle: () => {},
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [savedTheme, setSavedTheme] = useStorageValue("local", "theme", null);
  const prefersDark = useMediaQuery("(prefers-color-scheme: dark)");
  const systemTheme: Theme = prefersDark ? "dark" : "light";
  const theme: Theme = savedTheme === "dark" || savedTheme === "light" ? savedTheme : systemTheme;
  const isClient = useIsClient();

  // Durante la hidratación `theme` todavía es el del servidor ("light"); se espera al valor real
  // para no quitar la clase que ya puso el script inline de app/layout.tsx.
  useEffect(() => {
    if (!isClient) return;
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [isClient, theme]);

  const toggle = () => {
    setSavedTheme((current) => {
      const currentTheme = current === "dark" || current === "light" ? current : systemTheme;
      return currentTheme === "dark" ? "light" : "dark";
    });
  };

  return (
    <ThemeContext.Provider value={{ theme, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
