-- Issues #77 e #79. O cadastro pessoal do candidato estava em três lugares ao mesmo tempo:
-- `candidates`, colunas próprias em `interviews` e campos soltos no parecer
-- (`interview_assessment_values`). Duas entrevistas da mesma pessoa criavam duas cópias que
-- divergiam em silêncio, e nada dizia qual valia.
--
-- Fonte única: `candidates`. A entrevista aponta para o candidato (`candidate_id`, migração
-- 20260914210000) e lê de lá; o parecer guarda avaliação, não identidade.

-- 1. O que existe só no parecer vai para o cadastro, quando o cadastro não tem o dado.
--    Usa o valor do parecer mais recente daquele candidato.
with valor_do_parecer as (
  select distinct on (i.candidate_id, v.field)
         i.candidate_id,
         v.field,
         btrim(v.value) as value
    from public.interview_assessment_values v
    join public.interview_assessments a on a.id = v.assessment_id
    join public.interviews i on i.id = a.interview_id
   where i.candidate_id is not null
     and btrim(coalesce(v.value, '')) <> ''
   order by i.candidate_id, v.field, i.created_at desc
),
agregado as (
  select candidate_id,
         max(value) filter (where field = 'birth_date') as birth_date,
         max(value) filter (where field = 'cpf') as cpf,
         max(value) filter (where field = 'address') as address,
         max(value) filter (where field = 'marital_status') as marital_status,
         max(value) filter (where field = 'birthplace') as birthplace,
         max(value) filter (where field = 'gender_identity') as gender_identity,
         max(value) filter (where field = 'sexual_orientation') as sexual_orientation,
         max(value) filter (where field = 'race_declaration') as race_declaration,
         max(value) filter (where field = 'salary_expectation') as salary_expectation,
         max(value) filter (where field = 'languages') as languages,
         max(value) filter (where field = 'uniform_size') as uniform_size,
         max(value) filter (where field = 'boot_size') as boot_size,
         max(value) filter (where field = 'professional_summary') as professional_summary,
         max(value) filter (where field = 'experience_summary') as experience_summary,
         max(value) filter (where field = 'secondary_phone') as secondary_phone,
         max(value) filter (where field = 'secondary_email') as secondary_email,
         max(value) filter (where field = 'emergency_contact_name') as emergency_contact_name,
         max(value) filter (where field = 'emergency_contact_phone') as emergency_contact_phone,
         max(value) filter (where field = 'has_cnh') as has_cnh,
         max(value) filter (where field = 'has_dependents') as has_dependents,
         max(value) filter (where field = 'dependents_count') as dependents_count,
         max(value) filter (where field = 'dependents_notes') as dependents_notes
    from valor_do_parecer
   group by candidate_id
)
update public.candidates c
   set
       birth_date             = coalesce(c.birth_date, nullif(a.birth_date, '')::date),
       cpf                    = coalesce(c.cpf, a.cpf),
       address                = coalesce(c.address, a.address),
       marital_status         = coalesce(c.marital_status, a.marital_status),
       birthplace             = coalesce(c.birthplace, a.birthplace),
       gender_identity        = coalesce(c.gender_identity, a.gender_identity),
       sexual_orientation     = coalesce(c.sexual_orientation, a.sexual_orientation),
       race_declaration       = coalesce(c.race_declaration, a.race_declaration),
       salary_expectation     = coalesce(c.salary_expectation, a.salary_expectation),
       languages              = coalesce(c.languages, a.languages),
       uniform_size           = coalesce(c.uniform_size, a.uniform_size),
       boot_size              = coalesce(c.boot_size, a.boot_size),
       professional_summary   = coalesce(c.professional_summary, a.professional_summary),
       experience_summary     = coalesce(c.experience_summary, a.experience_summary),
       secondary_phone        = coalesce(c.secondary_phone, a.secondary_phone),
       secondary_email        = coalesce(c.secondary_email, a.secondary_email),
       emergency_contact_name = coalesce(c.emergency_contact_name, a.emergency_contact_name),
       emergency_contact_phone = coalesce(c.emergency_contact_phone, a.emergency_contact_phone),
       has_cnh                = coalesce(c.has_cnh, nullif(a.has_cnh, '')::boolean),
       has_dependents         = coalesce(c.has_dependents, nullif(a.has_dependents, '')::boolean),
       dependents_count       = coalesce(c.dependents_count, nullif(a.dependents_count, '')::integer),
       dependents_notes       = coalesce(c.dependents_notes, a.dependents_notes)
  from agregado a
 where a.candidate_id = c.id;

-- 2. O parecer para de guardar identidade. Fica o que é avaliação: notas, checklist,
--    senioridade, bandeira cultural, pontos fortes/fracos, formação, experiência, testes,
--    e os campos que a gravação do candidato ainda usa (worksite, selection_stage).
--    `technical`, `cultural_fit` e `tests_details` saem por serem o formato antigo do
--    parecer, hoje substituído pelas notas e sempre vazio em entrevista nova.
delete from public.interview_assessment_values
 where field in (
   'age', 'location', 'professional_summary', 'experience_summary',
   'technical', 'cultural_fit',
   'cnh', 'cnh_category', 'cnh_categories', 'has_cnh',
   'birth_date', 'cpf', 'gender', 'address', 'marital_status', 'birthplace',
   'salary_expectation', 'languages',
   'secondary_phone', 'secondary_email', 'emergency_contact_name', 'emergency_contact_phone',
   'has_dependents', 'dependents_count', 'dependents_notes',
   'uniform_size', 'boot_size',
   'gender_identity', 'sexual_orientation', 'race_declaration',
   'personal_info', 'additional_info', 'improvement_points'
 );

-- 3. As colunas de cadastro em `interviews` (todas vazias em produção nesta data) somem.
--    A tela lê o cadastro pelo `candidate_id`.
alter table public.interviews
  drop column if exists birth_date,
  drop column if exists cpf,
  drop column if exists marital_status,
  drop column if exists birthplace,
  drop column if exists gender,
  drop column if exists gender_identity,
  drop column if exists sexual_orientation,
  drop column if exists race_declaration,
  drop column if exists salary_expectation,
  drop column if exists has_cnh,
  drop column if exists cnh_category,
  drop column if exists languages,
  drop column if exists has_dependents,
  drop column if exists dependents_count,
  drop column if exists uniform_size,
  drop column if exists boot_size;

comment on table public.interviews is
  'Evento entrevista: quando, para qual vaga, situação, resultado e destino daquele dia (ADR 0010). O cadastro pessoal mora em candidates, apontado por candidate_id.';

-- 4. `worksite_type` era campo fantasma do parecer: sem tela para preencher, o padrão "all"
--    carimbava "Todas as Obras" em quem nunca declarou disponibilidade. A disponibilidade
--    real mora em `candidates.available_worksites`.
delete from public.interview_assessment_values where field = 'worksite_type';

update public.candidates
   set available_worksites = '{}'
 where available_worksites = array['Todas as Obras']
   and id in (
        select i.candidate_id
          from public.interviews i
         where i.candidate_id is not null
       );
