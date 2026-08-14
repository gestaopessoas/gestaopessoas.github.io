export interface Entity {
  id: string;
  name: string;
  type?: string | null;
  trading_name?: string | null;
  tax_rate_clt?: number;
  tax_rate_prolabore?: number;
}

export interface Department {
  id: string;
  name: string;
}

/**
 * Linha de `employees` como as telas a consomem. O índice genérico existe porque
 * o formulário lê/escreve por nome de coluna (`employee[key]`); as colunas
 * declaradas abaixo vencem o índice e mantêm o tipo real onde ele importa.
 */
export interface Employee extends Record<string, unknown> {
  id: string;
  name: string;
  registration_number?: string | null;
  ficha?: string | null;
  profile_code?: string | null;
  department_id?: string | null;
  department?: string | null;
  sector_id?: string | null;
  birthday?: string | null;
  status?: string | null;
  dismissed_at?: string | null;
  role?: string | null;
  senioridade?: string | null;
  phone?: string | null;
  email_personal?: string | null;
  email_corporate?: string | null;
  contract_type?: string | null;
  admission_date?: string | null;
  shirt_size?: string | null;
  boot_size?: string | null;
  gender?: string | null;
  cpf?: string | null;
  rg?: string | null;
  ctps?: string | null;
  ctps_serie?: string | null;
  pis?: string | null;
  marital_status?: string | null;
  cbo?: string | null;
  aso_date?: string | null;
  observation?: string | null;
  unit?: string | null;
  company_id?: string | null;
  cost_center_id?: string | null;
  workplace_id?: string | null;
  work_schedule_start_1?: string | null;
  work_schedule_end_1?: string | null;
  work_schedule_start_2?: string | null;
  work_schedule_end_2?: string | null;
  weekly_hours?: string | number | null;
  work_days?: string | null;
  base_salary?: string | number | null;
  variable_salary?: string | number | null;
  commission?: string | number | null;
  departments?: Entity | null;
  sectors?: Entity | null;
  level?: string | null;
  companies?: Entity | null;
  cost_centers?: Entity | null;
  workplaces?: Entity | null;
}

export const emptyForm = {
  name: "", registration_number: "", ficha: "", profile_code: "", department_id: "", department: "", sector_id: "", birthday: "", status: "Ativo", dismissed_at: "", role: "", level: "", phone: "",
  email_personal: "", email_corporate: "", contract_type: "", admission_date: "", shirt_size: "", boot_size: "",
  gender: "", cpf: "", rg: "", ctps: "", ctps_serie: "", pis: "", marital_status: "",
  cbo: "", aso_date: "", observation: "", company_id: "", cost_center_id: "", workplace_id: "",
  work_schedule_start_1: "", work_schedule_end_1: "", work_schedule_start_2: "", work_schedule_end_2: "", weekly_hours: "", work_days: "",
  base_salary: "", variable_salary: "", commission: ""
};

export type EmployeeForm = typeof emptyForm;

export const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

export const pageSize = 1000;
export const fields = [
  "id", "name", "registration_number", "ficha", "department_id", "department", "sector_id", "birthday", "status", "dismissed_at", "role", "phone", "email_personal", "email_corporate", "contract_type", "admission_date", "shirt_size", "boot_size", "gender", "cpf", "rg", "ctps", "ctps_serie", "pis", "marital_status", "cbo", "aso_date", "observation", "level", "company_id", "cost_center_id", "workplace_id", "work_schedule_start_1", "work_schedule_end_1", "work_schedule_start_2", "work_schedule_end_2", "weekly_hours", "work_days", "base_salary", "variable_salary", "commission"
].join(", ");
