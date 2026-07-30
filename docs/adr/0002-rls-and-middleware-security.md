# 2. Segurança RLS e Limitações do Next.js Export (Middleware)

Data: 2026-07-30

## Status

Aceito

## Contexto

Uma auditoria revelou dois problemas estruturais graves na nossa postura de segurança:

1. **Middleware Neutro (No-op)**: Como o Next.js está configurado para `output: "export"` (site estático no GitHub Pages), os *Middlewares* e *Route Handlers* dinâmicos (`GET`/`POST` que dependem de Request) não funcionam. O arquivo `middleware.ts` foi esvaziado, o que transferiu a responsabilidade de proteção de rotas exclusivamente para o client-side (via `useEffect` no layout do painel). Isso deixou rotas de API expostas.
2. **Políticas de RLS Quebradas / Permissivas**: Foi detectado um padrão repetitivo de vazamentos via Row Level Security (RLS). Algumas tabelas sensíveis (`employees`, relatórios financeiros) possuíam políticas antigas `USING (true)` que nunca foram revogadas. Como o PostgreSQL combina múltiplas políticas permissivas com um `OR`, as políticas restritivas novas nunca surtiram efeito, permitindo leitura e gravação não autorizadas por qualquer usuário autenticado (ou pior, acessos anônimos).

## Decisão

Para corrigir essas vulnerabilidades e prevenir que elas ocorram no futuro:

### 1. Extinção de Route Handlers (APIs)
* **Regra**: Em um ambiente de `output: "export"`, **não criaremos novos endpoints em `src/app/api/`**.
* **Estratégia**: Todas as interações com dados devem ocorrer diretamente entre o cliente (front-end estático) e o Supabase via o cliente Supabase do navegador (`@supabase/ssr` ou `@supabase/supabase-js`).
* **Proteção**: A segurança não deve estar na rota da API, mas sim nas regras de **Row Level Security (RLS)** do banco de dados e nas **RPCs (Remote Procedure Calls)**.

### 2. Padrão "Fail-Closed" Rigoroso para RLS
* **Regra**: Toda nova tabela deve possuir RLS ativada imediatamente (`ALTER TABLE ... ENABLE ROW LEVEL SECURITY`).
* **Auditoria de `USING (true)`**: Políticas curinga (como `FOR ALL TO authenticated USING (true)`) são estritamente **proibidas** em tabelas de produção sensíveis.
* **Sobrescrita de Políticas**: Ao alterar uma política de acesso, **sempre use `DROP POLICY IF EXISTS`** para remover a política antiga (especialmente as permissivas) antes de criar a nova. Não confie que o Supabase aplicará uma restrição se uma política mais branda ainda existir na mesma tabela.
* **Autenticação em RPCs**: Funções com `SECURITY DEFINER` que expõem dados sensíveis (ex: folha de pagamento) devem validar a permissão (`can_access()` ou validação equivalente com base em `auth.uid()`) internamente na função. 

## Consequências

- Será necessária uma re-escrita do módulo de configurações (`/api/settings`) para funcionar puramente client-side + Supabase com RLS.
- O tempo de desenvolvimento de migrations deve ser maior, pois o desenvolvedor precisa sempre checar o estado anterior da RLS da tabela (via psql ou visualizando as regras existentes).
- Redução substancial da superfície de ataque e eliminação de chamadas falsamente seguras a APIs que seriam ignoradas no build estático.
