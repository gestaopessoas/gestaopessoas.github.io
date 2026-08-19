-- RLS já permitia INSERT anônimo em candidates ("Allow public insert to candidates"),
-- mas faltava o GRANT da role anon na tabela. Sem o GRANT, toda tentativa de
-- candidatura pública falhava com "permission denied for table candidates" (42501)
-- antes mesmo da policy de RLS ser avaliada.
GRANT SELECT, INSERT ON TABLE "public"."candidates" TO "anon";
