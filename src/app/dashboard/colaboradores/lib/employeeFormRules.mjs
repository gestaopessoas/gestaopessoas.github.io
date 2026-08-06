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

const CRITICAL_FIELDS = [
  "rg",
  "role",
  "profile_code",
  "company_id",
  "workplace_id",
  "marital_status",
  "status",
];

export const criticalFieldsMatch = (expected, persisted) =>
  CRITICAL_FIELDS.every((field) => (expected[field] ?? null) === (persisted[field] ?? null));
