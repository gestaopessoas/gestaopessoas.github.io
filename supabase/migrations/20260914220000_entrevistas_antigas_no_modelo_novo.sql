-- Traz os registros antigos de `interviews` para o modelo novo:
--   1. entrevista sem candidato cadastrado ganha o cadastro e o vínculo;
--   2. entrevista sem data recebe o dia em que foi cadastrada (aproximação assumida com o
--      usuário: melhor um dia aproximado do que histórico sem data nenhuma).

-- 1. Candidato que só existia dentro da entrevista.
insert into public.candidates (full_name, first_name, last_name, email, phone, role_interest, search_tags)
select distinct on (lower(btrim(i.email)))
       btrim(i.candidate_name),
       split_part(btrim(i.candidate_name), ' ', 1),
       nullif(btrim(substr(btrim(i.candidate_name), strpos(btrim(i.candidate_name), ' ') + 1)), ''),
       lower(btrim(i.email)),
       i.phone,
       i.role,
       array['Importado de Entrevistas']
  from public.interviews i
 where i.candidate_id is null
   and btrim(coalesce(i.candidate_name, '')) <> ''
   and btrim(coalesce(i.email, '')) <> ''
   and not exists (
        select 1 from public.candidates c
         where lower(btrim(c.email)) = lower(btrim(i.email))
       )
 order by lower(btrim(i.email)), i.created_at;

-- 2. Vínculo, agora que o candidato existe.
update public.interviews i
   set candidate_id = c.id
  from public.candidates c
 where i.candidate_id is null
   and btrim(coalesce(i.email, '')) <> ''
   and lower(btrim(c.email)) = lower(btrim(i.email));

-- 3. Entrevista sem data fica com o dia do cadastro — a agenda e o histórico precisam de
--    uma data, e `created_at` é o único registro confiável de quando aquilo aconteceu.
update public.interviews
   set interview_date = (created_at at time zone 'America/Sao_Paulo')::date
 where interview_date is null;
