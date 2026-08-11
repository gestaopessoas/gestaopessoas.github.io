export const UNLOCK_STAGES: string[];

export interface InterviewLike {
  created_at: string;
  stage?: string;
  workplace_name?: string | null;
  interviewer_name?: string | null;
}

export interface EducationLike {
  degree?: string | null;
  start_date?: string | null;
  end_date?: string | null;
}

export function latestInterview(interviews?: InterviewLike[] | null): InterviewLike | null;

export function isLockedByInterview(latest: InterviewLike | null): boolean;

export interface CandidateStatus {
  status: "Banco de Talentos" | "Em Processo" | "Contratado";
  etapa_atual: string | null;
  obra_atual: string | null;
  ultimo_chamado: string;
}

export function deriveCandidateStatus(interviews?: InterviewLike[] | null): CandidateStatus;

export interface CandidateLike {
  candidate_interviews?: InterviewLike[] | null;
  search_tags?: string[] | null;
  available_worksites?: string[] | null;
  city?: string | null;
}

export function resolveCandidateStatus(candidate?: CandidateLike | null): CandidateStatus;

export function latestEducationDegree(educations?: EducationLike[] | null): string | null;

export type CandidateBucket = "livre" | "entrevista" | "documentacao" | "contratacao" | "encerrado";

export const STAGE_BUCKETS: Record<string, string[]>;
export const BUCKET_ORDER: readonly ["livre", "entrevista", "documentacao", "contratacao"];
export const BUCKET_LABELS: Record<string, string>;

export function candidateBucket(
  status: string | null | undefined,
  etapaAtual: string | null | undefined
): CandidateBucket;
