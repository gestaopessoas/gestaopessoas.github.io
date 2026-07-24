BEGIN;

-- Correção Nascimento: ANA FLAVIA MOURA CARAPINA 
UPDATE employees SET birthday = '1981-08-21', updated_at = NOW() WHERE id = 'baca2d0a-2a70-4bab-af86-71f6e2901cf0';

-- Correção Nascimento: RUBERLEI AVILA CABREIRA
UPDATE employees SET birthday = '1976-02-03', updated_at = NOW() WHERE id = '3f1096e2-788c-4b17-96b4-797fd24557a0';

-- Correção Nascimento: JOSE DIOGO DA SILVA NETO
UPDATE employees SET birthday = '1986-03-19', updated_at = NOW() WHERE id = '2eae64a1-59b3-42b2-81c6-b9270a80f17c';

-- Correção Nascimento: RONI DE SOUZA FONSECA
UPDATE employees SET birthday = '1965-01-11', updated_at = NOW() WHERE id = '9fe4f680-2bab-4444-9c15-618083665d96';

-- Correção Nascimento: GRAZIELA PEDROZO COUTINHO
UPDATE employees SET birthday = '1985-10-22', updated_at = NOW() WHERE id = '8c07f2bd-12d0-42da-bfb2-67e49538f02e';

-- Correção Nascimento: JAIRO LUIS LUGO MORGADO
UPDATE employees SET birthday = '2007-06-30', updated_at = NOW() WHERE id = '7514e6eb-da3f-43bc-8992-b7f10a861a54';

-- Correção Nascimento: PAMELA TEIXEIRA MORAES
UPDATE employees SET birthday = '1986-03-15', updated_at = NOW() WHERE id = 'a0ebb984-b297-4599-9602-6cf76cabbfd8';

COMMIT;
