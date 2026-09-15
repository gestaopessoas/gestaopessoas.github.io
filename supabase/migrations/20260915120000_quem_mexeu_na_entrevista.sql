-- `candidate_interviews` grava quem escreveu a linha (set_candidate_interview_author), mas
-- `interviews` não gravava nada: mudar data, hora, vaga, situação ou parecer sobrescreve a
-- linha e só sobra o `updated_at`. Quando duas pessoas mexem na mesma entrevista, não há
-- como saber de quem foi a última palavra — e é justamente a entrevista que muda de mão
-- entre recrutador e gestor.
--
-- O autor vem por gatilho, e não pelo app, porque há mais de um caminho de escrita: a tela
-- de Entrevistas, o avanço de etapa da Central e as correções feitas direto no banco. Fora
-- da sessão de um usuário (psql, migração, job), auth.uid() é nulo e as colunas ficam nulas
-- — é o registro honesto de que não foi uma pessoa logada.
--
-- O parecer entra junto: ele é salvo por um upsert em `interview_assessments` a cada
-- gravação da ficha, então o gatilho ali marca quem mexeu na avaliação. As linhas de
-- `interview_assessment_values` são apagadas e reescritas em bloco a cada salvamento — não
-- vale carimbar autor em cada valor, o autor do parecer é um só e mora no registro pai.

alter table public.interviews
  add column if not exists updated_by_user_id uuid,
  add column if not exists updated_by_name text;

alter table public.interview_assessments
  add column if not exists updated_by_user_id uuid,
  add column if not exists updated_by_name text;

create or replace function public.set_interview_editor()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  new.updated_by_user_id := auth.uid();

  select name
    into new.updated_by_name
    from public.profiles
   where id = new.updated_by_user_id;

  return new;
end;
$$;

revoke all on function public.set_interview_editor() from public;

drop trigger if exists set_interview_editor on public.interviews;
create trigger set_interview_editor
before insert or update on public.interviews
for each row
execute function public.set_interview_editor();

drop trigger if exists set_interview_assessment_editor on public.interview_assessments;
create trigger set_interview_assessment_editor
before insert or update on public.interview_assessments
for each row
execute function public.set_interview_editor();

comment on column public.interviews.updated_by_name is
  'Quem gravou a última versão desta entrevista. Preenchido por gatilho; nulo quando a escrita não veio de um usuário logado.';
comment on column public.interview_assessments.updated_by_name is
  'Quem gravou a última versão deste parecer. Preenchido por gatilho; nulo quando a escrita não veio de um usuário logado.';
