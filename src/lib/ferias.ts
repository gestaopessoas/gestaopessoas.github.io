import { addMonths, differenceInDays } from 'date-fns';

export interface FeriasInfo {
  admissao: Date;
  diasDireito: number;
  diasGozados: number;
  saldo: number;
  inicioAquisitivo: Date;
  fimAquisitivo: Date;
  limiteConcessivo: Date;
  status: 'ok' | 'vence_em_breve' | 'vencida';
  diasParaVencer: number;
}

export function calcularFerias(
  admissaoDate: string | Date,
  diasGozadosHistorico: number = 0
): FeriasInfo {
  const admissao = new Date(admissaoDate);
  const hoje = new Date();

  // O período aquisitivo atual fecha a cada 12 meses.
  const mesesTrabalhados = (hoje.getFullYear() - admissao.getFullYear()) * 12 + (hoje.getMonth() - admissao.getMonth());
  let periodosCompletos = Math.floor(mesesTrabalhados / 12);
  
  // Ajuste fino se o dia atual for anterior ao dia de admissão no mês
  if (hoje.getDate() < admissao.getDate()) {
      periodosCompletos = Math.max(0, periodosCompletos - 1);
  }

  // Direito total acumulado
  const diasDireitoTotal = periodosCompletos * 30;
  const saldo = Math.max(0, diasDireitoTotal - diasGozadosHistorico);

  // O período aquisitivo mais recente que fechou
  const inicioAquisitivo = addMonths(admissao, (periodosCompletos > 0 ? periodosCompletos - 1 : 0) * 12);
  const fimAquisitivo = addMonths(inicioAquisitivo, 12);
  
  // Limite concessivo: a empresa tem 11 meses após o fim do período aquisitivo para conceder as férias
  const limiteConcessivo = addMonths(fimAquisitivo, 11);

  const diasParaVencer = differenceInDays(limiteConcessivo, hoje);

  let status: FeriasInfo['status'] = 'ok';
  if (saldo > 0) {
      if (diasParaVencer < 0) {
          status = 'vencida';
      } else if (diasParaVencer <= 60) {
          status = 'vence_em_breve';
      }
  }

  return {
    admissao,
    diasDireito: diasDireitoTotal,
    diasGozados: diasGozadosHistorico,
    saldo,
    inicioAquisitivo,
    fimAquisitivo,
    limiteConcessivo,
    status,
    diasParaVencer
  };
}
