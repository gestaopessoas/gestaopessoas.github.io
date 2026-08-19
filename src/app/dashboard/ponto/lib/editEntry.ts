import { computeHourBank, computeOvertimePay, type TimeRecord } from "./hoursRules.ts";

export interface PontoEntry {
  id: string;
  employee_id: string;
  log_date: string; // YYYY-MM-DD
  entry_1: string | null; // HH:MM or HH:MM:SS
  exit_1: string | null;
  entry_2: string | null;
  exit_2: string | null;
}

export interface PontoHistoryEntry {
  id: string; // UUID
  time_log_id: string;
  employee_id: string;
  author: string;
  field_changed: string;
  old_value: string | null;
  new_value: string | null;
  reason: string;
  created_at: string; // ISO String
}

export interface EditPontoResult {
  entryAtualizada: PontoEntry;
  historicoEntry: PontoHistoryEntry | null;
  timeRecords: TimeRecord[];
  hourBank: { positiveMinutes: number; negativeMinutes: number };
  overtimePay: { totalMinutes: number; payableMinutes: number };
}

// Para usar horasRules, precisamos traduzir os horários em "TimeRecords".
// Como o RHID gera TimeRecords (ex: 150, 211, etc.), nós simulamos esse comportamento 
// calculando o tempo total trabalhado contra a jornada esperada.
// Para simplificar "não duplica lógica", nós geramos um TimeRecord correspondente
// ao saldo do dia.
const calculateDailyTimeRecords = (entry: PontoEntry, expectedMinutes: number = 480): TimeRecord[] => {
  let totalWorked = 0;

  const parseTime = (t: string | null) => {
    if (!t) return 0;
    const [h, m] = t.split(":").map(Number);
    return (h || 0) * 60 + (m || 0);
  };

  const in1 = parseTime(entry.entry_1);
  const out1 = parseTime(entry.exit_1);
  const in2 = parseTime(entry.entry_2);
  const out2 = parseTime(entry.exit_2);

  if (out1 > in1) totalWorked += (out1 - in1);
  if (out2 > in2) totalWorked += (out2 - in2);

  const records: TimeRecord[] = [];
  const diff = totalWorked - expectedMinutes;

  if (diff > 0) {
    // Hora extra. Usando código 150 padrão para simplificar.
    // Em um sistema real, poderíamos detectar finais de semana para código 200.
    records.push({
      code: "150",
      hours: Math.floor(diff / 60),
      minutes: diff % 60
    });
  } else if (diff < 0) {
    // Faltas ou atrasos. Código 211.
    const deficit = Math.abs(diff);
    records.push({
      code: "211",
      hours: Math.floor(deficit / 60),
      minutes: deficit % 60
    });
  }

  return records;
};

export const editPontoEntry = (
  entryAtual: PontoEntry,
  campo: keyof PontoEntry,
  novoValor: string | null,
  autor: string,
  motivo: string,
  expectedMinutes: number = 480
): EditPontoResult => {
  const old_value = entryAtual[campo] as string | null;

  // Se o valor não mudou, não gera histórico redundante
  if (old_value === novoValor) {
    const timeRecords = calculateDailyTimeRecords(entryAtual, expectedMinutes);
    return {
      entryAtualizada: { ...entryAtual },
      historicoEntry: null,
      timeRecords,
      hourBank: computeHourBank(timeRecords),
      overtimePay: computeOvertimePay(timeRecords),
    };
  }

  const entryAtualizada = { ...entryAtual, [campo]: novoValor };

  const historicoEntry: PontoHistoryEntry = {
    id: crypto.randomUUID ? crypto.randomUUID() : "mock-uuid",
    time_log_id: entryAtualizada.id,
    employee_id: entryAtualizada.employee_id,
    author: autor,
    field_changed: campo as string,
    old_value: old_value || null,
    new_value: novoValor || null,
    reason: motivo,
    created_at: new Date().toISOString()
  };

  const timeRecords = calculateDailyTimeRecords(entryAtualizada, expectedMinutes);

  return {
    entryAtualizada,
    historicoEntry,
    timeRecords,
    hourBank: computeHourBank(timeRecords),
    overtimePay: computeOvertimePay(timeRecords),
  };
};
