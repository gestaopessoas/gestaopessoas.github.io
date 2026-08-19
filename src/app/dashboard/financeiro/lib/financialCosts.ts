export type EmployeeBenefitStatus = {
  id: string;
  name: string;
  hasSeguroVida: boolean;
  hasAlmoco: boolean;
  status: string; // "Ativo", "Desligado", etc.
  dismissed_at?: string | null;
};

export const calculateFinancialCosts = (
  employees: EmployeeBenefitStatus[],
  unitCostSeguro: number,
  unitCostAlmoco: number
) => {
  let countSeguro = 0;
  let countAlmoco = 0;

  for (const emp of employees) {
    // "Colaborador desligado no meio do período conta o custo cheio do mês" -> we don't prorate.
    // If they have the benefit, we just count them.
    if (emp.hasSeguroVida) countSeguro++;
    if (emp.hasAlmoco) countAlmoco++;
  }

  return {
    seguroTotal: countSeguro * unitCostSeguro,
    almocoTotal: countAlmoco * unitCostAlmoco,
    seguroCount: countSeguro,
    almocoCount: countAlmoco
  };
};
