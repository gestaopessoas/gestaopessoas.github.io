// Níveis salariais são ordinais romanos ("Nível I".."Nível V"): ordem alfabética
// põe IV antes de II. Aqui a ordem é a do número, com fallback estável para
// rótulos que não sejam romanos (issue #122).

const ROMANOS = { I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6, VII: 7, VIII: 8, IX: 9, X: 10 };

export function levelOrder(level) {
  const romano = String(level).trim().toUpperCase().replace(/^N[ÍI]VEL\s+/, "");
  return ROMANOS[romano] ?? Number.MAX_SAFE_INTEGER;
}

export function sortLevels(levels) {
  return [...levels].sort(
    (a, b) => levelOrder(a) - levelOrder(b) || String(a).localeCompare(String(b), "pt-BR", { numeric: true })
  );
}
