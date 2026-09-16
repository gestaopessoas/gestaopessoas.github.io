-- Banco de Talentos virou consulta derivada (ADR 0006, fases 1-3): quem nao tem Candidatura
-- ativa e nao foi Contratado esta no banco. Ninguem le mais a marcacao em
-- `candidates.search_tags` — `banco-talentos/page.tsx` ate a filtra da exibicao.
--
-- Entao a marcacao para de ser escrita e sai do banco. `search_tags` continua existindo: e
-- campo de busca livre, so deixa de carregar Etapa, que e o que o ADR 0006 decidiu.
--
-- Limpar em massa aqui e seguro, diferente das outras tags de Etapa: esta era gravada pelo
-- gatilho abaixo e por duas telas, nunca digitada pelo recrutador.

DROP TRIGGER IF EXISTS candidatura_marca_banco_de_talentos ON public.job_applications;
DROP FUNCTION IF EXISTS public.candidatura_marca_banco_de_talentos();

UPDATE public.candidates c
   SET search_tags = ARRAY(
         SELECT t FROM unnest(c.search_tags) t
          WHERE lower(public.unaccent(t)) <> 'banco de talentos'
       )
 WHERE c.search_tags IS NOT NULL
   AND EXISTS (
     SELECT 1 FROM unnest(c.search_tags) t
      WHERE lower(public.unaccent(t)) = 'banco de talentos'
   );
