# 8. Estar no Arquivo Morto é ter caixa, não ter status inativo — e cada passagem tem a sua

Data: 2026-09-04

## Status

Aceito. Substitui a regra implícita anterior (uma caixa por pessoa, arquivo morto derivado
do status) que nunca chegou a ser registrada em ADR. Complementa o ADR 0007, que decidiu
manter tudo na tabela `employees`.

## Contexto

O modelo anterior assumia duas coisas que a realidade do RH não respeita:

**1. Um colaborador ocupa uma caixa só.** Havia até um índice único garantindo isso
(migration `20260821130000`). Mas a vida real é `admissão → demissão → admissão → demissão`,
e cada passagem gera o seu próprio maço de papel, que pode ir parar numa caixa diferente.
Com o índice único, registrar a caixa nova **apagava** o vínculo com a anterior: a passagem
antiga sumia do sistema, embora os papéis continuassem na caixa lá no arquivo.

**2. Quem está no arquivo morto está inativo.** A tela `/dashboard/arquivo-morto` listava
por `status IN ('Inativo','Desligado','Arquivo Morto')`. Só que quem sai de CLT e volta como
PJ tem o dossiê CLT arquivado **enquanto continua ativo na empresa**. Pelo modelo antigo,
esse dossiê era invisível: a pessoa não aparecia na tela do arquivo.

Os dois casos já estavam na base antes de qualquer decisão: **13 pessoas com status `Ativo`
ou `Afastado` têm caixa** — 12 CLT (readmissão) e 1 PJ. Foram registradas como
inconsistência de dado na issue #64. Não eram inconsistência: eram o modelo faltando.

Nota de vocabulário, porque o nome engana: `employee_archives` **não** é um arquivo de
dados, é o vínculo entre um dossiê e a caixa física. `physical_boxes` é a caixa.

## Decisão

**Um colaborador pode ter N caixas.** O índice único em `employee_id` foi removido.
`employee_archives` ganhou `label text` — o rótulo que o RH escreve na pasta
(`"CLT 2019-2022"`, `"PJ"`). Cada linha é um dossiê.

Sem índice único no lugar dele, nem em `(employee_id, box_id)`: duas passagens da mesma
pessoa podem legitimamente ir para a **mesma** caixa física. A duplicata acidental é evitada
na tela, que mostra a lista de caixas antes de deixar adicionar.

**Estar no arquivo morto é ter caixa OU ter status de saída**, expresso na view:

```sql
CREATE OR REPLACE VIEW public.arquivo_morto WITH (security_invoker = on) AS
  SELECT e.* FROM public.employees e
  WHERE e.status IN ('Inativo', 'Desligado', 'Arquivo Morto')
     OR EXISTS (SELECT 1 FROM public.employee_archives ea WHERE ea.employee_id = e.id);
```

A segunda condição é a que faz o caso CLT→PJ existir. A primeira é a que faz quem saiu e
ainda não foi encaixotado continuar aparecendo, no grupo "Sem Caixa" — é assim que o RH
descobre quem falta arquivar.

Três consequências diretas na tela:

- **A tela lista dossiês, não pessoas.** Quem tem duas caixas aparece nas duas.
- **Reativar não apaga mais as caixas.** Antes, reativar fazia
  `employee_archives.delete()` — apagava o histórico de arquivamento junto com o status.
  Agora só o status muda; o dossiê da passagem anterior continua onde está, que é
  exatamente o caso da readmissão.
- **O modal de caixas abre a qualquer momento**, por um botão na linha do colaborador, e
  não só quando ele acabou de virar inativo. Sem isso não havia como arquivar o dossiê de
  alguém que continua ativo.

`ARCHIVE_STATUSES` continua existindo, mas só para o critério de status. Quem precisa da
lista completa usa a view.

## Consequências

- Uma pessoa pode aparecer várias vezes na busca do arquivo morto. É o comportamento
  desejado, mas contraria a leitura ingênua de "quantos resultados a busca deu" — por isso
  o rótulo da tela passou a dizer "dossiê(s) encontrado(s)", não "colaborador(es)".
- Sem índice único, nada no banco impede registrar o mesmo dossiê duas vezes na mesma
  caixa. A proteção é só de tela. Se aparecer duplicata na prática, a resposta é um índice
  parcial ou uma checagem no `addArchiveBox`, não voltar o único original — que quebrava a
  readmissão.
- `label` é texto livre. Não dá para filtrar ou ordenar por período de forma confiável. Foi
  escolha deliberada: a caixa é física e o que o RH escreve na pasta é uma etiqueta. Se um
  dia precisar filtrar por data, aí vira coluna própria.
- As 13 pessoas da issue #64 deixam de ser inconsistência. O que sobra naquela issue é dado
  sujo de verdade: 132 desligados sem data e 7 datas impossíveis.
- Quem escrever tela nova precisa saber que existem três fontes agora: `colaboradores`
  (quadro atual), `arquivo_morto` (quem tem dossiê ou saiu) e `employees` (tudo, e toda
  escrita). Está em `docs/manutencao.md`.
- A migration não converte nada retroativamente: os 4.500 vínculos existentes viram um
  dossiê cada, sem `label`. Preencher etiqueta em registro antigo é trabalho manual do RH,
  e só vale a pena para quem tiver mais de uma passagem.
