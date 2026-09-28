// Formatação/arredondamento de salário compartilhado entre VagaForm.tsx (dashboard) e
// solicitar-vaga/page.tsx (formulário público) -- ambos puxam da mesma `salary_table`,
// que guarda ponto flutuante cru (4310.604, 5027.8885056). Issue #160.

// Exibição só-leitura em BRL; o valor gravado continua o número cru vindo da tabela salarial.
export function formatBRL(value) {
  const numeric = Number(value);
  if (!value || !Number.isFinite(numeric)) return "";
  return numeric.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// A vaga grava só centavos, nunca a dízima da tabela salarial.
export function roundCents(value) {
  return Math.round(value * 100) / 100;
}
