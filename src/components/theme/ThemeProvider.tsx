"use client";

import { createContext, useCallback, useContext, useEffect, useSyncExternalStore } from "react";

export type Theme = "system" | "light" | "dark";

/** Compartilhado com o script anti-FOUC em app/layout.tsx — mudar aqui exige mudar lá. */
export const THEME_STORAGE_KEY = "acpo-theme";

const prefersDark = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches;

const isTheme = (value: unknown): value is Theme =>
  value === "light" || value === "dark" || value === "system";

// O tema escolhido mora no localStorage — uma store externa. Lê-lo por
// useSyncExternalStore dispensa o par useState+useEffect e é seguro na hidratação:
// no servidor o snapshot é "system", o mesmo que o HTML pré-renderizado assume.
const listeners = new Set<() => void>();

const readStoredTheme = (): Theme => {
  try {
    const raw = localStorage.getItem(THEME_STORAGE_KEY);
    if (isTheme(raw)) return raw;
  } catch {
    // storage bloqueado (modo privado) -> segue com "system"
  }
  return "system";
};

const subscribeToTheme = (onStoreChange: () => void) => {
  listeners.add(onStoreChange);
  // Outra aba trocando o tema também conta.
  window.addEventListener("storage", onStoreChange);
  return () => {
    listeners.delete(onStoreChange);
    window.removeEventListener("storage", onStoreChange);
  };
};

const writeStoredTheme = (theme: Theme) => {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // sem storage o tema vale só para esta sessão
  }
  listeners.forEach((listener) => listener());
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
  const theme = useSyncExternalStore(subscribeToTheme, readStoredTheme, () => "system" as Theme);
  const systemDark = useSyncExternalStore(
    (onStoreChange) => {
      const media = window.matchMedia("(prefers-color-scheme: dark)");
      media.addEventListener("change", onStoreChange);
      return () => media.removeEventListener("change", onStoreChange);
    },
    prefersDark,
    () => false
  );

  const resolvedTheme: "light" | "dark" =
    theme === "dark" || (theme === "system" && systemDark) ? "dark" : "light";

  /** Liga/desliga a classe `.dark` no <html>, que é o gatilho do @custom-variant do Tailwind. */
  useEffect(() => {
    document.documentElement.classList.toggle("dark", resolvedTheme === "dark");
    document.documentElement.style.colorScheme = resolvedTheme;
  }, [resolvedTheme]);

  const setTheme = useCallback((next: Theme) => {
    writeStoredTheme(next);
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
