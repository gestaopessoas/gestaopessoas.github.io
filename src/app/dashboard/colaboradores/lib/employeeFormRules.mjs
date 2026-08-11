const normalizeForComparison = (value) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLocaleUpperCase("pt-BR");

export const canonicalizeOption = (value, options) => {
  const aliases = { ACTIVE: "ATIVO", INACTIVE: "INATIVO" };
  const normalizedValue = aliases[normalizeForComparison(value)] ?? normalizeForComparison(value);
  return options.find((option) => normalizeForComparison(option) === normalizedValue) ?? value;
};

const SEDE_SCHEDULE = {
  work_schedule_start_1: "07:45",
  work_schedule_end_1: "12:00",
  work_schedule_start_2: "13:15",
  work_schedule_end_2: "17:48",
  weekly_hours: "44",
  work_days: "Segunda a Sexta",
};

export const getScheduleForWorkplaceType = (type) => {
  const normalizedType = normalizeForComparison(type);

  if (normalizedType === "OBRA") {
    return {
      work_schedule_start_1: "07:30",
      work_schedule_end_1: "12:00",
      work_schedule_start_2: "13:15",
      work_schedule_end_2: "17:33",
      weekly_hours: "44",
      work_days: "Segunda a Sexta",
    };
  }

  if (normalizedType === "SEDE" || normalizedType.includes("PLANTAO")) {
    return { ...SEDE_SCHEDULE };
  }

  return null;
};

export const sanitizeRgInput = (value) => String(value ?? "").replace(/\D/g, "").slice(0, 15);

/** Valida os dois dígitos verificadores do CPF. Campo vazio é tratado como "não informado" pelo chamador. */
export const isValidCpf = (value) => {
  const digits = String(value ?? "").replace(/\D/g, "");
  if (digits.length !== 11 || /^(\d)\1{10}$/.test(digits)) return false;

  const checkDigit = (length) => {
    let sum = 0;
    for (let i = 0; i < length; i += 1) sum += Number(digits[i]) * (length + 1 - i);
    const remainder = (sum * 10) % 11;
    return remainder === 10 ? 0 : remainder;
  };

  return checkDigit(9) === Number(digits[9]) && checkDigit(10) === Number(digits[10]);
};

export const formatCurrencyInput = (value) =>
  Number(value ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const parseCurrencyInput = (value) => {
  const normalized = String(value ?? "").replace(/\./g, "").replace(",", ".").replace(/[^0-9.-]/g, "");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
};

export const maskCurrencyInput = (value) => {
  const digits = String(value ?? "").replace(/\D/g, "");
  return digits ? formatCurrencyInput(Number(digits) / 100) : "";
};

export const salaryChangeDue = (admissionDate, baseSalary, experienceSalary, afterProbationSalary, today = new Date()) => {
  if (!admissionDate || afterProbationSalary == null || Number(baseSalary) !== Number(experienceSalary)) return false;
  const start = new Date(`${admissionDate}T12:00:00`);
  const reference = typeof today === "string" ? new Date(`${today}T12:00:00`) : today;
  const days = Math.floor((reference.getTime() - start.getTime()) / 86_400_000);
  return days >= 83;
};

// Todo cargo pode entrar no piso da categoria ou ficar fora do enquadramento.
export const LEVEL_FALLBACK_OPTIONS = ["PISO", "Não Enquadrado"];

// Decide o que mostrar nos campos Senioridade e Nível a partir das faixas do cargo:
// - faixas com nível: trilha de senioridade normal, níveis filtrados pela senioridade;
// - faixas sem nível (Oficial, Meio-Oficial, Servente): não existe trilha de senioridade,
//   o colaborador entra no piso ou fica não enquadrado;
// - cargo sem faixa cadastrada: não esconde nada, para não perder dado de cargo novo.
export const levelFieldOptions = (roleSalaryEntries, seniorityAllowedLevels, allLevels) => {
  const entries = roleSalaryEntries ?? [];
  const leveled = entries.filter((rule) => rule.uses_level && rule.level).map((rule) => rule.level);

  if (entries.some((rule) => rule.uses_level)) {
    const filtered = seniorityAllowedLevels
      ? leveled.filter((level) => seniorityAllowedLevels.includes(level))
      : leveled;
    return {
      showSeniority: true,
      levelOptions: ["", ...(filtered.length ? filtered : leveled), ...LEVEL_FALLBACK_OPTIONS],
    };
  }

  if (entries.length > 0) {
    return { showSeniority: false, levelOptions: ["", ...LEVEL_FALLBACK_OPTIONS] };
  }

  return { showSeniority: true, levelOptions: [...allLevels, ...LEVEL_FALLBACK_OPTIONS] };
};

const CRITICAL_FIELDS = [
  "rg",
  "role",
  "profile_code",
  "level",
  "company_id",
  "workplace_id",
  "marital_status",
  "status",
];

export const criticalFieldsMatch = (expected, persisted) =>
  CRITICAL_FIELDS.every((field) => (expected[field] ?? null) === (persisted[field] ?? null));
