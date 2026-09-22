# 12. O Onboarding encerra pela tela, não por agendador

Data: 2026-09-22

## Status

Aceito.

## Contexto

O checklist de Onboarding tem que encerrar sozinho aos 90 dias — por completude antes
disso, e por prazo quando os 90 dias vencem com tarefa aberta (`onboarding_encerrar_vencidos()`,
`supabase/migrations/20260922140400_o_onboarding_encerra_aos_90_dias.sql`). É esse
encerramento que tira o Colaborador da lista de Ativos: sem ele, a lista só cresce, que é
um dos cinco problemas originais que o redesenho de Onboarding existe para resolver
(`docs/superpowers/specs/2026-09-22-onboarding-design.md`).

O obstáculo é que este site não tem onde rodar um agendador. `next.config.ts` usa
`output: "export"`: é build estático, publicado sem servidor Next, sem API route e sem
processo próprio para um `cron` disparar. A Fase 1 (este branch) não pode contar com nada
rodando em segundo plano.

A Fase 2, ainda não construída, vai trazer um workflow n8n agendado diariamente, com a
service role key, para os três avisos por e-mail (abertura, cobrança, pré-encerramento —
seção "Automação (n8n)" da spec). Esse workflow é o lugar natural para também disparar o
encerramento por prazo, uma vez que exista.

## Decisão

`onboarding_encerrar_vencidos()` é chamada pela própria tela de Onboarding, ao abrir — não
por um agendador. A função é idempotente (`UPDATE ... WHERE closed_at IS NULL AND
started_at <= current_date - 90`, ver comentário na migration) e segura para chamar
repetidamente: rodar de novo não reabre nem remexe em quem já fechou.

Isso torna o gatilho do encerramento — "quando" ele roda — trocável sem tocar na regra em
si — "o que" ele faz. A Fase 2 troca a tela pelo n8n chamando exatamente esta mesma função,
agora pela service role key em vez de pela sessão do usuário: `onboarding_encerrar_vencidos()`
já lida com isso (`IF auth.uid() IS NOT NULL AND NOT can_access(...)`, a checagem só barra
autenticado sem permissão, não a ausência de sessão). Trocar o gatilho de trigger para
agendador é troca de fiação, não redesenho da lógica de corte.

## Alternativas consideradas

**Não fazer nada até a Fase 2 existir.** Rejeitada: deixaria a lista de Ativos crescendo
sem limite durante todo o intervalo entre esta fase e a Fase 2 (que ainda nem tem data) —
exatamente um dos cinco problemas originais que todo este redesenho existe para resolver.
Entregar Onboarding sem encerramento automático seria entregar metade do valor da Fase 1.

**pg_cron dentro do próprio Postgres**, no mesmo padrão de
`arquivo.rotina_arquivamento()` (`supabase/migrations/20260908170000_rotina_de_arquivamento.sql`).
Tecnicamente possível — a extensão já está habilitada neste banco — mas rejeitada para
este caso: o encerramento por prazo tem efeito visível na tela de quem está com sessão
aberta (a linha sai da aba Ativos), e não há vantagem em uma segunda via de disparo
(cron + tela) para a mesma função quando a tela sozinha já cobre o caso de uso da Fase 1.
Nenhum outro app ou serviço depende do encerramento acontecer fora do horário de uso do
RH nesta fase — diferente do arquivamento, que precisa rodar mesmo com o sistema fechado
para não misturar quadro atual com desligados por dias seguidos.

**Endpoint HTTP dedicado (API route) chamado por um serviço externo.** Rejeitada porque o
site é estático — criar uma API route quebraria `output: "export"` e exigiria hospedagem
com servidor, mudança de infraestrutura fora do escopo de fechar um checklist de RH.

## Consequências

- O efeito prático da Fase 1 é que o corte só é percebido quando alguém abre a tela de
  Onboarding — dado atrasado, não dado errado, como já documentado no comentário da
  migration. Aceitável porque a tela é de uso diário do RH.
- A Fase 2 troca o gatilho sem tocar em `onboarding_encerrar_vencidos()`: o workflow n8n
  chama a mesma RPC, agendado, e o comportamento de idempotência que a Fase 1 já exige da
  função é o que torna essa troca segura.
- Se o n8n da Fase 2 for desativado por engano, o efeito é o mesmo risco aceito documentado
  na spec para os avisos por e-mail: nada no app denuncia. A tela continuar chamando a
  função como reforço não é redundância descartável — é a rede que evita a lista crescer
  sem limite caso o agendador da Fase 2 falhe silenciosamente.
