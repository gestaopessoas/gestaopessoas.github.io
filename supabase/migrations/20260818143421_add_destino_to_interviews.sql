-- Separa "Destino" (encaminhamento final: Contratado, Banco de Talentos, Descartado,
-- Desistente) do "Resultado" (avaliação da entrevista: N/C, Aprovado, Reprovado), que
-- antes acumulava os dois sentidos no mesmo campo.
ALTER TABLE "public"."interviews"
  ADD COLUMN IF NOT EXISTS "destination" "text";
