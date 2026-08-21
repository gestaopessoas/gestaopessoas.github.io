/**
 * Lista canônica das chaves de módulo do sistema de permissões.
 *
 * É a mesma lista que a tela de Configurações usa para montar os switches de permissão
 * por perfil. Uma chave que não esteja aqui NÃO pode ser concedida a ninguém: `can_access`
 * só devolve true para nível >= 50 ou para uma linha existente em `profile_permissions`.
 * Por isso a Sidebar tipa o campo `module` com `ModuleKey` — assim uma tela gateada por
 * uma chave inexistente quebra no build, em vez de sumir do menu em silêncio.
 *
 * Ao adicionar uma chave nova numa policy de RLS, adicione aqui também.
 */
export const MODULES = [
  "colaboradores",
  "arquivo_morto",
  "mp",
  "vagas",
  "central_candidato",
  "entrevistas",
  "formularios",
  "recrutamento",
  "armarios",
  "uniformes",
  "ponto",
  "rgs",
  "ilhas",
  "admissao",
  "onboarding",
  "centros_de_custo",
  "departamentos",
  "cargos",
  "empresas",
  "obras",
  "beneficios",
  "treinamentos",
  "ferias",
  "holerites",
  "avaliacoes",
  "clima",
  "metas",
  "pdi",
  "competencias",
  "turnover",
  "analytics",
  "salarios",
  "configuracoes",
  "financeiro",
] as const;

export type ModuleKey = (typeof MODULES)[number];
