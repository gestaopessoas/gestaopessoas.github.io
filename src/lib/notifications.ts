// Formato do resumo devolvido pela RPC `get_notification_summary`.
//
// Os cálculos que antes viviam aqui (generateTrialNotifications e cia.) foram
// portados para SQL em supabase/migrations/20260904100000_create_notification_summary_rpc.sql.
// Motivo: o cálculo client-side exigia baixar a tabela employees inteira a cada
// ciclo do sino — ~700 MB/dia de egress. Ao mexer nas regras, mexa na migration.

export type TrialNotification = {
  id: string;
  name: string;
  daysRemaining: number;
  isWarning: boolean;
};

export type RgsNotification = {
  id: string;
  name: string;
  type: string;
  daysPending: number;
};

export type MonthlyBenefitNotification = {
  id: string;
  name: string;
  benefits: string[];
};

export type PendingProfileNotification = {
  id: string;
  name: string;
  missingFields: string[];
};

export type UserPreferences = {
  trial: boolean;
  rgs: boolean;
  benefits: boolean;
  profile: boolean;
};

// `count` é a contagem exata da seção; `items` traz só os primeiros
// `p_item_limit` registros (o badge usa count, a lista usa items).
type Section<T> = { count: number; items: T[] };

export type NotificationSummary = {
  reference_month: string;
  pending_leads: number;
  profiles: Section<PendingProfileNotification>;
  trial: Section<TrialNotification>;
  rgs: Section<RgsNotification>;
  benefits: { inclusions: number; cuts: number };
  monthly: Section<MonthlyBenefitNotification>;
};

const emptySection = <T,>(): Section<T> => ({ count: 0, items: [] });

export const EMPTY_NOTIFICATION_SUMMARY: NotificationSummary = {
  reference_month: "",
  pending_leads: 0,
  profiles: emptySection(),
  trial: emptySection(),
  rgs: emptySection(),
  benefits: { inclusions: 0, cuts: 0 },
  monthly: emptySection(),
};
