export type QuestionType = "scale" | "text" | "textarea" | "multiple_choice" | "yes_no";

export type Question = {
  id: string;
  type: QuestionType;
  label: string;
  required: boolean;
  options?: string[]; // multiple_choice only
};

export type EvaluationTemplate = {
  id: string;
  name: string;
  description: string | null;
  questions: Question[];
  created_at: string;
};

export type CycleType = "90" | "180" | "360" | "experiencia";

export type EvaluationCycle = {
  id: string;
  name: string;
  type: CycleType;
  starts_at: string;
  ends_at: string;
  status: "DRAFT" | "ACTIVE" | "FINISHED";
  template_id: string | null;
  created_at: string;
};

export type Relationship = "self" | "gestor" | "par" | "subordinado";

export type EvaluationRequest = {
  id: string;
  cycle_id: string;
  evaluatee_id: string;
  evaluator_id: string;
  relationship: Relationship;
  status: "PENDING" | "COMPLETED";
  created_at: string;
};

export type EvaluationResponse = {
  id: string;
  request_id: string;
  answers: Record<string, string | number>;
  status: "PENDING" | "SUBMITTED";
  submitted_at: string | null;
};

export const RELATIONSHIP_LABELS: Record<Relationship, string> = {
  self: "Autoavaliação",
  gestor: "Gestor",
  par: "Par",
  subordinado: "Subordinado",
};

export const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  scale: "Escala (1 a 5)",
  text: "Texto curto",
  textarea: "Texto longo",
  multiple_choice: "Múltipla escolha",
  yes_no: "Sim / Não",
};

export function newQuestionId() {
  return "q_" + Math.random().toString(36).slice(2, 10);
}
