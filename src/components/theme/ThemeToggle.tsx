"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme, type Theme } from "./ThemeProvider";

const CYCLE: Theme[] = ["light", "dark", "system"];

const LABEL: Record<Theme, string> = {
  light: "Tema claro",
  dark: "Tema escuro",
  system: "Acompanhando o sistema",
};

const ICON = { light: Sun, dark: Moon, system: Monitor };

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const Icon = ICON[theme];
  const next = CYCLE[(CYCLE.indexOf(theme) + 1) % CYCLE.length];

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(next)}
      title={`${LABEL[theme]} — clique para: ${LABEL[next]}`}
      aria-label={`${LABEL[theme]}. Alternar para ${LABEL[next]}`}
    >
      <Icon className="h-4 w-4" />
    </Button>
  );
}
