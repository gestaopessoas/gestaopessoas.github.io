-- issue #119: `candidates.city` de cadastro antigo guarda nome de Obra no lugar da cidade.
--
-- Uma candidata de Pelotas está com city = 'SEDE', e a ficha exibe "SEDE, RS, Rua Santa Cruz".
-- Cadastro novo pelo portal já grava a cidade certa, então isto é resíduo de importação — não
-- há bug de fluxo para corrigir junto.
--
-- Não se resolve sozinho: `enrich_claimed_candidate` (20260917090000) só preenche coluna
-- vazia, de propósito, para que saber o e-mail de alguém não dê o direito de reescrever o
-- cadastro dessa pessoa. Com `city` preenchida com lixo, o valor errado fica para sempre.
--
-- Limpar é melhor que adivinhar: o nome da Obra não diz qual é a cidade, e a coluna vazia é o
-- que deixa o próximo cadastro (ou o RH, na ficha) preencher a cidade de verdade. A Obra não
-- se perde — ela mora na Candidatura, em `job_openings.workplace_id`.
--
-- A comparação normaliza caixa e espaço porque o gatilho de `candidates` já grava city em
-- UPPER(TRIM()), mas `workplaces.name` não passa pelo mesmo gatilho.

update public.candidates as c
set city = null
from public.workplaces as w
where c.city is not null
  and upper(btrim(c.city)) = upper(btrim(w.name));
