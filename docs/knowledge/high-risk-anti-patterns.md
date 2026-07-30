# Anti-Padrões de Risco Alto em Projetos React + Supabase

> **Objetivo:** Esta base de conhecimento serve como registro de aprendizado após a auditoria do projeto (julho de 2026). Todos os agentes e desenvolvedores devem checar estas regras para evitar falhas sistêmicas (de gravidade **Alta** e **Crítica**) em novos projetos.

## 1. Condições de Corrida por "Read-Modify-Write" Client-Side
**O Problema:** Em páginas como controle de uniformes e entrega de chaves de armários, o código buscava o valor do banco, fazia o cálculo no React (`qty = database_qty - input`) e mandava de volta pro Supabase (`UPDATE ... SET amount = qty`). Duas edições simultâneas (ex: cliques rápidos ou múltiplos usuários) resultam em uma "atualização perdida" (*lost update*).
**A Solução:** **Nunca calcule decrementos ou incrementos em memória.**
Sempre utilize atualizações atômicas diretamente pelo banco de dados:
* Opção A: `rpc('decrement_stock', { id, amount })`
* Opção B (PostgREST API recente): Operadores de mutação na própria querie (caso suportado) ou Triggers.

## 2. Validações de Negócio Limitadas ao React
**O Problema:** A trava de "vinculação exclusiva do candidato a uma obra" (Workplace Lock) existia apenas como um booleano derivado no componente `AddInterviewModal.tsx`. Um acesso direto à API REST ou requisições concorrentes poderiam cadastrar entrevistas ativas do mesmo candidato em duas obras diferentes ao mesmo tempo.
**A Solução:** **O Banco de Dados é a única fonte de verdade (Single Source of Truth).**
Qualquer regra de negócio que proteja a consistência dos dados precisa ser modelada como:
* Restrições `CHECK`
* Colunas `UNIQUE`
* Triggers de Validação (`BEFORE INSERT/UPDATE`) no PostgreSQL.
A UI deve apenas refletir essas validações de forma antecipada para UX, mas **jamais** ser a única barreira de proteção.

## 3. Falhas Parciais Não-Tratadas (Falta de Transações)
**O Problema:** A função `reactivate()` (que restabelece o vínculo de um funcionário no arquivo morto) disparava o comando para deletar a referência do arquivo, e depois atualizava o funcionário. Se o segundo comando falhasse por lentidão na rede, o funcionário ficava num estado "fantasma" (sem arquivo físico, mas também não estava ativado).
**A Solução:** Para gravações em mais de uma tabela dependente:
* **Transações SQL:** Crie uma *Stored Procedure (RPC)* no Supabase que realize todas as etapas dentro de um único bloco. Se houver erro, ocorrerá `ROLLBACK` total.
* Evitar ao máximo orquestrar lógicas multi-tabelas a partir do client se a atomicidade for necessária.

## 4. Uso Síncrono da API Assíncrona do Next 16 (`params`)
**O Problema:** Em roteamentos dinâmicos (`[id]`), o arquivo `page.tsx` utilizava `params.id` diretamente de forma síncrona. No Next 16+, `params` e `searchParams` são **Promises** em *Client Components* e devem ser resolvidos. Isso injetava `undefined` em runtime no Kanban.
**A Solução:** Sempre use a sintaxe assíncrona ou o unwrap do React para `params`:
```tsx
// Errado (Next <15):
export default function Page({ params }: { params: { id: string } }) {
  const id = params.id; // Gera erros e alertas no Next 16+
}

// Correto (Next 16+):
export default function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = React.use(params);
  // ...
}
```

## 5. Schema Drift (Vazamento de Colunas Manuais)
**O Problema:** Ao debugar a edição de obras, foi notado que colunas vitais (`coordinator`, `responsible_director`) eram chamadas pelo código mas nunca existiram no histórico das migrações (`supabase/migrations/*.sql`). Elas haviam sido criadas "na mão" no painel da Supabase. Qualquer ambiente novo que recriasse o banco via CI ou CLI estaria quebrado.
**A Solução:** **100% de infraestrutura como código.** Se você precisar testar uma coluna pelo Supabase Dashboard, crie a migration correspondente **imediatamente** e garanta que o código fonte sempre consiga reconstruir o schema do zero sem dependências externas.
