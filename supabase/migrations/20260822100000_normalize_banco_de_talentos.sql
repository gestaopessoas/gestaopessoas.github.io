-- Issue #41: o modal do candidato gravava "Banco de talentos" (t minúsculo) e toda a
-- lógica (e o trigger check_active_workplace_lock) compara com "Banco de Talentos".
-- Normaliza o histórico para a grafia canônica.

update public.candidate_interviews
set stage = 'Banco de Talentos'
where lower(stage) = 'banco de talentos' and stage <> 'Banco de Talentos';

update public.candidate_interviews
set candidate_future = 'Banco de Talentos'
where lower(candidate_future) = 'banco de talentos' and candidate_future <> 'Banco de Talentos';
