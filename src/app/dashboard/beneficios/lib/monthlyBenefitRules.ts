export interface MonthlyBenefitPayload {
  employee_id: string;
  benefit_name: string;
  reference_month: string;
  value: number;
}

export const prepareMonthlyBenefitUpsert = (payload: MonthlyBenefitPayload) => {
  return {
    ...payload,
    updated_at: new Date().toISOString()
  };
};
