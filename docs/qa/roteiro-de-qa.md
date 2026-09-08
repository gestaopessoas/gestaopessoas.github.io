# Roteiro de QA — caçando falhas que não gritam

> Escrito depois da semana de 2026-09-04 a 08, em que 11 bugs foram encontrados.
> **Nenhum deles aparecia como erro na tela.** Esse é o fio que liga todos.

## O padrão

Bug que quebra a tela é fácil: alguém reclama no mesmo dia. O que este projeto vinha
acumulando é o outro tipo — o sistema responde `200`, a tela abre, os números aparecem, e
estão errados. Ou o dado some sem ninguém notar.

Três exemplos reais, todos vivendo há meses:

- O gráfico "Afastamentos por mês" consultava uma coluna inexistente. HTTP 400 em **todo**
  carregamento, engolido por um aviso amarelo genérico.
- O turnover mostrava 35,1%. O correto era 37,3% — o banco cortava a resposta em 1.000
  linhas e ninguém foi avisado.
- A data de desligamento era apagada pelo formulário. 396 vezes, segundo o histórico.

A pergunta que organiza este roteiro não é *"funciona?"*. É **"como isso falharia sem
avisar?"**

---

## As oito classes

### 1. Corte silencioso de 1.000 linhas

**Sintoma:** número menor que a realidade, sem erro nenhum.
**Real:** `max_rows = 1000` no PostgREST. `.limit(10000)` não traz 10.000 — traz 1.000.
Turnover, Analytics e mais quatro telas agregavam sobre 20% da base.

**Como caçar:** toda consulta que agrega precisa ou paginar, ou contar no banco (RPC), ou
provar que o conjunto filtrado é menor que 1.000. `auditoria_qa()` lista as tabelas acima
de 1.000 linhas — hoje são seis.

**Regra:** contagem sobre tabela grande vira RPC. Agregar no navegador é o cheiro.

### 2. Erro engolido pela interface

**Sintoma:** a tela abre, mas um pedaço vem vazio. O `catch` virou um aviso genérico.
**Real:** `employee_history.new_value` não existe; `competencies` e `tests` nunca
existiram (issue #66); `job_applications.updated_at` idem, zerando uma tela inteira,
inclusive um custo em reais calculado sobre zero.

**Como caçar:** `e2e/varredura-telas.spec.ts` abre as 44 telas e falha em qualquer
resposta ≥ 400, erro de JavaScript, ou aviso de erro visível.

**Regra:** `catch` que só mostra "dados parciais" esconde bug. Ou trate o erro de verdade,
ou deixe estourar.

### 3. Destruição silenciosa de dado pela interface

**Sintoma:** um campo esvazia sozinho e ninguém liga o efeito à causa.
**Real:** o formulário zerava `dismissed_at` sempre que o status passava por um valor
ativo. Bastava mudar para "Ativo" e voltar antes de salvar.

**Como caçar:** o histórico responde. `employee_history` + `employee_history_value_entries`
guardam o par velho/novo de cada mudança:

```sql
SELECT count(*) FROM employee_history h
JOIN employee_history_value_entries o ON o.history_id = h.id AND o.value_side = 'old'
LEFT JOIN employee_history_value_entries n ON n.history_id = h.id AND n.value_side = 'new'
WHERE h.column_name = 'dismissed_at' AND o.value_text IS NOT NULL AND n.value_text IS NULL;
```

**Regra:** campo que a interface limpa sozinha é suspeito. Pergunte ao histórico com que
frequência isso acontece — 396 vezes não é acidente.

### 4. Cascata que desce mais de um nível

**Sintoma:** apagar um registro leva junto coisas que ninguém previu.
**Real:** a separação do arquivo morto copiou as tabelas **filhas** de `employees`, mas não
as **netas**. O `DELETE` levou 46.879 linhas de `employee_history_value_entries` e 121 de
`benefit_audit_log_entries`. Recuperadas do backup.

**Como caçar:** `auditoria_qa()` verifica que toda descendente em cascata de uma tabela
espelhada tem espelho. Achou três faltando em produção depois do estrago — vazias, mas
seriam o mesmo bug no dia em que ganhassem dado.

**Regra:** antes de qualquer `DELETE` em massa, mapear o grafo **inteiro** de cascata, não
um nível.

### 5. RLS que não veio junto

**Sintoma:** dado fica legível por quem não deveria. Nada falha.
**Real:** `CREATE TABLE ... (LIKE origem INCLUDING ALL)` **não copia política de RLS**. As
29 tabelas do arquivo nasceram sem controle de acesso. Já tinha acontecido antes com
`physical_boxes` (auditoria de 2026-07-30).

**Como caçar:** `auditoria_qa()` lista tabela sem RLS e tabela com RLS mas sem policy —
que nega tudo em silêncio, igualmente ruim.

**Regra:** tabela nova, RLS explícita na mesma migration. Nunca por herança.

### 6. Gatilho `INSTEAD OF` que perde os valores padrão

**Sintoma:** inserir pela view falha com "not-null violation", ou grava sem id.
**Real:** o gatilho recebe em `NEW` só o que o cliente mandou; os `DEFAULT` da tabela não
são aplicados. Criar colaborador e guardar dossiê ficaram quebrados por duas horas.

**Como caçar:** para toda view que aceita escrita, um teste que **insere de verdade** e
confere que o registro nasceu completo. Ver `e2e/_local-readmissao.spec.ts`.

**Regra:** view com escrita precisa de `COALESCE` explícito em toda coluna `NOT NULL` com
default.

### 7. Fuso horário em data

**Sintoma:** contagem por mês erra sistematicamente no dia 1º.
**Real:** `new Date('2026-08-01')` vira meia-noite **UTC**; lido em horário de Brasília,
volta para julho. Toda admissão do dia 1º caía no mês anterior.

**Como caçar:** agrupar por mês em SQL, ou ler o prefixo `YYYY-MM` da string. Nunca passar
uma coluna `date` por `new Date()` para depois chamar `getMonth()`.

### 8. Teste que não testa

**Sintoma:** a suíte está verde e o bug está lá.
**Real, os quatro:** `getByLabel` sem `htmlFor` (nunca achava o campo); teste clicando na
linha de "nenhum resultado"; teste que **gravava em produção** a cada execução; e teste
cobrando um formato que a view não devolve mais.

**Como caçar:** **mutação.** Reintroduza o bug de propósito e confirme que o teste fica
vermelho. Foi assim que provei que o teste de `dismissed_at` presta — dos três casos, dois
falharam e o terceiro continuou verde, exatamente como devia.

**Regra:** teste que nunca viu vermelho não é guarda, é decoração.

---

## O que roda sozinho hoje

| Guarda | O que pega |
|---|---|
| `e2e/varredura-telas.spec.ts` | 44 telas; qualquer 4xx/5xx, erro de JS ou aviso de erro |
| `e2e/auditoria-banco.spec.ts` | RLS, netas sem espelho, costura das views, órfãos no arquivo |
| `e2e/rotina-arquivamento.spec.ts` | agendamento vivo, sem erro, fila não parada |
| `e2e/notification-bell.spec.ts` | orçamento de egress da home |
| `e2e/turnover.spec.ts`, `metricas-recrutamento` | agregação no banco, sem baixar tabela |
| `e2e/view-colaboradores.spec.ts` | tela de operação não varre `employees` |
| `e2e/_local-desligamento.spec.ts` | ciclo desligar/reativar preserva a data |
| `e2e/_local-readmissao.spec.ts` | uma caixa por passagem; reativar não duplica |

```bash
npm run test:e2e         # tudo que é leitura, contra produção
npm run test:e2e:local   # os que gravam, contra o Supabase local
```

Os specs `_local-*` **só** rodam pelo `playwright.local.config.ts`. O config de produção os
ignora — antes dessa separação havia teste alterando dado de gente real.

---

## Antes de mexer no banco

1. **Backup, e conferido.** `supabase db dump` já saiu com código 0 e arquivo cortado no
   meio, perdendo quatro tabelas em silêncio. Confira que termina em `RESET ALL;` e compare
   a contagem tabela a tabela.
2. **Ensaie no Docker.** Restaure o backup num Postgres local e rode a migration lá antes.
   Foi o ensaio que pegou dois erros meus de semântica antes de irem para produção.
3. **Compare os indicadores antes e depois**, um a um, contra o banco intacto. Onze números
   das três RPCs. Se algum mudar sem você ter querido, pare.
4. **Mapeie a cascata inteira** se houver `DELETE`.
5. **Rode `auditoria_qa()`** depois.

## Antes de publicar

1. `npm run build`
2. `npx tsc --noEmit`
3. `node --test "src/**/*.test.mjs"`
4. `npm run test:e2e` — e leia a saída, não só o verde
5. Se mexeu no banco: `supabase db push --dry-run` primeiro

**Código e banco andam juntos.** A view `arquivo_morto` mudou de formato e o código antigo
recebia erro; entre aplicar a migration e publicar existe uma janela de alguns minutos com
tela quebrada.

---

## O que ainda não é automático

- **Corte de 1.000 linhas:** a auditoria lista as tabelas grandes, mas não cruza com as
  consultas do código. Uma consulta nova sem paginação passa despercebida.
- **Telas com parâmetro** (`historico?id=`, `termo-uniforme?id=`) ficam fora da varredura.
- **Fuso em data:** nenhum teste pega. Depende de revisão.
- **Permissões por perfil:** tudo roda como administrador. Um perfil restrito pode
  encontrar tela quebrada que ninguém vê.
