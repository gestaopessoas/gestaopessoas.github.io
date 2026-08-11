"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

export type Theme = "system" | "light" | "dark";

/** Compartilhado com o script anti-FOUC em app/layout.tsx — mudar aqui exige mudar lá. */
export const THEME_STORAGE_KEY = "acpo-theme";

const prefersDark = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches;

/** Liga/desliga a classe `.dark` no <html>, que é o gatilho do @custom-variant do Tailwind. */
const applyTheme = (theme: Theme): "light" | "dark" => {
  const resolved = theme === "dark" || (theme === "system" && prefersDark()) ? "dark" : "light";
  document.documentElement.classList.toggle("dark", resolved === "dark");
  document.documentElement.style.colorScheme = resolved;
  return resolved;
};

type ThemeContextValue = {
  theme: Theme;
  resolvedTheme: "light" | "dark";
  setTheme: (theme: Theme) => void;
};

const ThemeContext = createContext<ThemeContextValue>({
  theme: "system",
  resolvedTheme: "light",
  setTheme: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("system");
  const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark">("light");

  // Reidrata a partir do storage. O script inline já pintou a tela certa antes daqui.
  useEffect(() => {
    let stored: Theme = "system";
    try {
      const raw = localStorage.getItem(THEME_STORAGE_KEY);
      if (raw === "light" || raw === "dark" || raw === "system") stored = raw;
    } catch {
      // storage bloqueado (modo privado) -> segue com "system"
    }
    setThemeState(stored);
    setResolvedTheme(applyTheme(stored));
  }, []);

  // Em "system", acompanhar a troca de tema do SO em tempo real.
  useEffect(() => {
    if (theme !== "system") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => setResolvedTheme(applyTheme("system"));
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [theme]);

  const setTheme = useCallback((next: Theme) => {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // sem storage o tema vale só para esta sessão
    }
    setThemeState(next);
    setResolvedTheme(applyTheme(next));
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
