import { differenceInDays } from 'date-fns';

export type AlertLevel = 'ok' | 'warning' | 'critical';

export interface AlertStatus {
  level: AlertLevel;
  daysRemaining: number;
}

/**
 * Calcula o nível de alerta para uma data de vencimento.
 * @param expirationDate A data que irá vencer (ex: exame admissional, experiência, limite de férias)
 * @param warningDays Quantos dias antes do vencimento deve entrar em estado de 'warning'
 */
export function getExpirationAlert(expirationDate: Date | string, warningDays: number = 60): AlertStatus {
  const expiration = new Date(expirationDate);
  const today = new Date();
  const daysRemaining = differenceInDays(expiration, today);

  if (daysRemaining < 0) {
    return { level: 'critical', daysRemaining };
  }
  
  if (daysRemaining <= warningDays) {
    return { level: 'warning', daysRemaining };
  }
  
  return { level: 'ok', daysRemaining };
}
