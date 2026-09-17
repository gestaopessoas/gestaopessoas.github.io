export const LIMITED_STAGE_OPTIONS: string[];

export function normalizeStage(value: unknown): string;
export function sameStage(a: unknown, b: unknown): boolean;
export function isTerminalStage(stage: unknown): boolean;
export function isInterviewStage(stage: unknown): boolean;
export function stageNeedsWorkplace(stage: unknown): boolean;

export interface InterviewLike {
  created_at: string;
  stage?: string;
  candidate_future?: string | null;
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

export const PENDING_INTERVIEW_STATUSES: string[];

/** Candidatura (job_applications), na forma mínima que a lógica pura precisa. */
export interface ApplicationLike {
  id?: string;
  status?: string | null;
  created_at?: string | null;
  job_requests?: { position_title?: string | null; requested_role?: string | null } | null;
  job_openings?: { workplaces?: { name?: string | null } | null; workplace_name?: string | null } | null;
  outcome_reason?: string | null;
  outcome_details?: string | null;
}

export interface CandidateLike {
  city?: string | null;
}

export interface CandidateStatus {
  status: "Em Processo" | "Contratado" | "Banco de Talentos";
  etapa_atual: string | null;
  obra_atual: string | null;
  ultimo_chamado: string;
  candidatura_id: string | null;
  total_candidaturas: number;
  /** Motivo do desfecho, só quando a Candidatura de referência é Reprovado/Desistente. */
  motivo_saida: string | null;
  motivo_detalhe: string | null;
}

export function candidaturaAtual(applications?: ApplicationLike[] | null): ApplicationLike | null;

export function candidaturasAtivas(applications?: ApplicationLike[] | null): ApplicationLike[];

export function candidateStatusFromApplications(
  applications?: ApplicationLike[] | null,
  candidate?: CandidateLike | null
): CandidateStatus;

export interface AssessmentEducationLike {
  education?: string | null;
  academic_list?: { course?: string | null; degree?: string | null }[] | null;
}

export function latestEducationDegree(
  educations?: EducationLike[] | null,
  assessment?: AssessmentEducationLike | null
): string | null;

export type CandidateBucket =
  | "livre"
  | "entrevista"
  | "obras"
  | "proposta"
  | "documentacao"
  | "mp"
  | "contratacao"
  | "encerrado";

export const STAGE_BUCKETS: Record<string, string[]>;
export const BUCKET_ORDER: readonly [
  "livre",
  "entrevista",
  "obras",
  "proposta",
  "documentacao",
  "mp",
  "contratacao",
];
export const BUCKET_LABELS: Record<string, string>;

export function isHeadquarters(obra: string | null | undefined): boolean;

export function nextStageOptions(
  currentBucket: string,
  obra?: string | null,
  funilDaVaga?: readonly string[] | null
): string[];

export const DIAS_NA_ABA_CONTRATACAO: number;

export function candidateBucket(
  status: string | null | undefined,
  etapaAtual: string | null | undefined,
  contratadoEm?: string | null
): CandidateBucket;
