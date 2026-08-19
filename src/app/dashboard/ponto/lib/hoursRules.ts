// Regras puras de horas: separam o cálculo de valor a pagar de hora extra
// (aplica percentual) do banco de horas (soma 1:1, sem percentual).
// Ver issue #36 - Corrigir aba ponto.

export interface TimeRecord {
  code: string;
  hours: number;
  minutes: number;
}

// Código de evento RHID -> percentual pago sobre a hora extra.
export const OVERTIME_RATE_BY_CODE: Record<string, number> = {
  "150": 0.5,
  "175": 0.75,
  "200": 1.0,
};

const DEBIT_CODES = new Set(["211", "212"]);

const rawMinutes = (r: TimeRecord): number => r.hours * 60 + r.minutes;

/**
 * Valor a pagar de hora extra: aplica o percentual do código sobre os minutos
 * trabalhados. Registros com código fora de OVERTIME_RATE_BY_CODE são ignorados.
 */
export const computeOvertimePay = (
  registros: TimeRecord[]
): { totalMinutes: number; payableMinutes: number } => {
  let totalMinutes = 0;
  let payableMinutes = 0;
  for (const r of registros) {
    const rate = OVERTIME_RATE_BY_CODE[r.code];
    if (rate === undefined) continue;
    const minutes = rawMinutes(r);
    totalMinutes += minutes;
    payableMinutes += minutes * rate;
  }
  return { totalMinutes, payableMinutes };
};

/**
 * Banco de horas: hora extra credita 1:1 (sem percentual, independente do
 * código 150/175/200); atrasos/faltas (211/212) debitam 1:1.
 */
export const computeHourBank = (
  registros: TimeRecord[]
): { positiveMinutes: number; negativeMinutes: number } => {
  let positiveMinutes = 0;
  let negativeMinutes = 0;
  for (const r of registros) {
    const minutes = rawMinutes(r);
    if (r.code in OVERTIME_RATE_BY_CODE) {
      positiveMinutes += minutes;
    } else if (DEBIT_CODES.has(r.code)) {
      negativeMinutes += minutes;
    }
  }
  return { positiveMinutes, negativeMinutes };
};
