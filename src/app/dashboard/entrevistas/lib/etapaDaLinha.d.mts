export type EtapaNoTempo = { stage: string; created_at: string | null };

export type HistoricoPorCandidato = Record<string, EtapaNoTempo[]>;

export function etapaDaLinha(
  interview: { candidate_id?: string | null; created_at?: string | null; destination?: string | null },
  historicoPorCandidato: HistoricoPorCandidato
): string | null;

export function historicoPorCandidato(
  etapas: Array<{ candidate_id?: string | null; stage?: string | null; created_at?: string | null }> | null | undefined
): HistoricoPorCandidato;
