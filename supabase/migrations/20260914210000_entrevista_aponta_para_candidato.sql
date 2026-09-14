-- `interviews` não tinha vínculo com `candidates`: a ligação era por e-mail (com o nome
-- como fallback). Quem entra sem e-mail recebia `nome@sememail.com`, então dois homônimos
-- sem e-mail viravam a mesma pessoa no upsert, e qualquer correção de e-mail quebrava o
-- histórico da entrevista.
--
-- A coluna abaixo passa a ser o vínculo de verdade. O e-mail continua sendo usado como
-- fallback na leitura enquanto houver linha antiga sem candidate_id.

alter table public.interviews
  add column if not exists candidate_id uuid references public.candidates(id) on delete set null;

create index if not exists interviews_candidate_id_idx
  on public.interviews (candidate_id);

-- Backfill 1: por e-mail (o mesmo critério que o app usava).
update public.interviews i
   set candidate_id = c.id
  from public.candidates c
 where i.candidate_id is null
   and i.email is not null
   and btrim(lower(i.email)) <> ''
   and btrim(lower(c.email)) = btrim(lower(i.email));

-- Backfill 2: pelo nome completo, só quando ele identifica um candidato único.
update public.interviews i
   set candidate_id = sub.id
  from (
        select btrim(lower(c.full_name)) as nome, min(c.id::text)::uuid as id
          from public.candidates c
         group by btrim(lower(c.full_name))
        having count(*) = 1
       ) sub
 where i.candidate_id is null
   and i.candidate_name is not null
   and btrim(lower(i.candidate_name)) = sub.nome;

-- Entrevista que não aconteceu também é registro: a data/hora marcada fica gravada.
comment on column public.interviews.interview_date is
  'Data marcada da entrevista. Permanece preenchida mesmo quando o candidato não compareceu.';
