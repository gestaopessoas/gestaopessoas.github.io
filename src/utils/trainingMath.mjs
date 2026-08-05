/**
 * Módulo de precisão matemática para cálculos de satisfação e aproveitamento em Treinamentos.
 * Blindado contra NaN, null e tipos inválidos.
 */

/**
 * Calcula a percepção de aproveitamento ponderada:
 * - 40% Avaliação de Conteúdo/Aplicabilidade
 * - 30% Suporte da Gestão de Pessoas
 * - 30% Engajamento no Feedback Pós-Treinamento
 * @param {number|null|undefined} contentScore (0-10)
 * @param {number|null|undefined} managementScore (0-10)
 * @param {number|null|undefined} engagementScore (0-10)
 * @returns {number} Nota ponderada entre 0 e 10 com 2 casas decimais precisas.
 */
export function calculateWeightedUtilization(contentScore, managementScore, engagementScore) {
  const c = (contentScore == null || isNaN(Number(contentScore))) ? 0 : Number(contentScore);
  const m = (managementScore == null || isNaN(Number(managementScore))) ? 0 : Number(managementScore);
  const e = (engagementScore == null || isNaN(Number(engagementScore))) ? 0 : Number(engagementScore);

  // Se todos os valores forem zero ou inválidos, retorna 0
  if (c === 0 && m === 0 && e === 0) return 0.00;

  // Cálculo ponderado estrito: (C * 0.40) + (M * 0.30) + (E * 0.30)
  const result = (c * 0.40) + (m * 0.30) + (e * 0.30);
  return Number(result.toFixed(2));
}

/**
 * Normaliza e calcula a média aritmética limpa de um array de notas,
 * removendo entradas inválidas ou nulas sem corromper a média.
 * @param {Array<number|string>} scores 
 * @returns {number}
 */
export function calculateCleanAverage(scores) {
  if (!Array.isArray(scores) || scores.length === 0) return 0.00;
  
  const validScores = scores
    .filter(s => s !== null && s !== undefined && String(s).trim() !== '')
    .map(s => Number(s))
    .filter(s => !isNaN(s) && s >= 0 && s <= 10);
    
  if (validScores.length === 0) return 0.00;
  
  const sum = validScores.reduce((acc, val) => acc + val, 0);
  return Number((sum / validScores.length).toFixed(2));
}
