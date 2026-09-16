-- Quem está logado no sistema não conseguia se candidatar pelo portal público.
--
-- O formulário de /carreiras grava em cinco tabelas. Quatro delas liberam INSERT
-- para `anon, authenticated`; `job_applications` ficou só com `anon`. Resultado:
-- para quem tem sessão aberta (recrutador conferindo o portal, colaborador se
-- candidatando a vaga interna), o candidato era criado e a candidatura falhava
-- com 42501 — sobrava ficha órfã em `candidates`, sem vínculo com a vaga, e a
-- tela só dizia "não foi possível vincular à vaga. Avise o RH".
--
-- Não afrouxa nada: a mesma inserção já é permitida a qualquer anônimo da
-- internet. Bastava deslogar para conseguir. Barrar o usuário logado não
-- protegia nada, só quebrava.

DROP POLICY IF EXISTS "Public can insert applications" ON public.job_applications;

CREATE POLICY "Public can insert applications"
  ON public.job_applications FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);
