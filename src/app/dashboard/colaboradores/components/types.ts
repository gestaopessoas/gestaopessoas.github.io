export interface Entity {
  id: string;
  name: string;
  trading_name?: string | null;
  tax_rate_clt?: number;
  tax_rate_prolabore?: number;
}

export interface Department {
  id: string;
  name: string;
}

export interface Employee extends Record<string, string | null | any> {
  id: string;
  name: string;
  departments?: Entity | null;
  level?: string | null;
  companies?: Entity | null;
  cost_centers?: Entity | null;
  workplaces?: Entity | null;
}

export const emptyForm = {
  name: "", registration_number: "", profile_code: "", department_id: "", birthday: "", status: "Ativo", dismissed_at: "", role: "", level: "", phone: "",
  email_personal: "", email_corporate: "", contract_type: "", admission_date: "", shirt_size: "", boot_size: "",
  gender: "", cpf: "", rg: "", ctps: "", ctps_serie: "", pis: "", marital_status: "",
  cbo: "", aso_date: "", observation: "", company_id: "", cost_center_id: "", workplace_id: "",
  work_schedule_start_1: "", work_schedule_end_1: "", work_schedule_start_2: "", work_schedule_end_2: "", weekly_hours: "", work_days: "",
  base_salary: "", variable_salary: "", commission: ""
};

export type EmployeeForm = typeof emptyForm;

export const MONTHS = [
  "Janeiro", "Fevereiro", "Marco", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

export const pageSize = 1000;
export const fields = [
  "id", "name", "registration_number", "department_id", "birthday", "status", "dismissed_at", "role", "phone", "email_personal", "email_corporate", "contract_type", "admission_date", "shirt_size", "boot_size", "gender", "cpf", "rg", "ctps", "ctps_serie", "pis", "marital_status", "cbo", "aso_date", "observation", "level", "company_id", "cost_center_id", "workplace_id", "work_schedule_start_1", "work_schedule_end_1", "work_schedule_start_2", "work_schedule_end_2", "weekly_hours", "work_days", "base_salary", "variable_salary", "commission"
].join(", ");
