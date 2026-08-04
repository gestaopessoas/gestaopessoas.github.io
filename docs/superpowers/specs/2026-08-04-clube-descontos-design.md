# Design Spec: Clube de Descontos & Parceiros ACPO

**Data:** 04/08/2026  
**Autor:** Antigravity (Gemini Advanced 3.1 Pro - Sênior Dev Mode)  
**Status:** Aguardando Revisão do Usuário  
**Abordagem:** Ponytail / Lean Architecture (Eficiência máxima, mínimo de dependências)  

## 1. Visão Geral e Objetivo
Criar um ecossistema completo para apresentação de vantagens corporativas aos colaboradores e captação de novos parceiros comerciais.  
O objetivo central é dar transparência e fácil acesso a todos os descontos que os colaboradores têm direito, ao mesmo tempo que oferece uma porta de entrada simplificada para estabelecimentos se candidatarem a se tornarem parceiros da ACPO (gerando notificações instantâneas no sininho da gestão para prospecção).

## 2. Arquitetura & Modelo de Dados (Supabase)

A solução apoia-se em 2 novas tabelas no Supabase com Políticas RLS (Row Level Security) devidamente blindadas:

### 2.1. Tabela `discount_partners`
Armazena o catálogo oficial de parceiros ativos e publicáveis para os colaboradores.
- `id`: UUID (Primary Key, default `gen_random_uuid()`)
- `name`: Text (Nome do parceiro/empresa, ex: "Academia Fitness", "Faculdade UniExemplo")
- `category`: Text (Opções: `Educação`, `Academia`, `Alimentação`, `Saúde`, `Lazer`, `Serviços`)
- `discount_badge`: Text (Ex: "20% OFF", "Matrícula Grátis", "R$ 50 de desconto")
- `description`: Text (Breve resumo dos benefícios aplicáveis)
- `how_to_use`: Text (Instrução precisa para resgate, ex: "Apresentar crachá da ACPO na recepção")
- `contact_info`: Text (Link do site do parceiro, endereço ou telefone/WhatsApp de atendimento)
- `status`: Text (Opções: `Ativo`, `Inativo` - Default `Ativo`)
- `created_at`: Timestamptz (Default `now()`)

**Políticas RLS:**
- *Select:* Leitura pública (`true`) para que os colaboradores vejam na página pública sem exigência de login complexo se estiverem na rota de acesso, ou leitura restrita à autenticação caso desejado (como é rota pública `/clube-descontos`, `FOR SELECT USING (true)` para `status = 'Ativo'`).
- *Insert / Update / Delete:* Apenas para usuários autenticados (Gestão/RH).

### 2.2. Tabela `partner_leads`
Armazena os contatos enviados via modal por possíveis fornecedores de desconto.
- `id`: UUID (Primary Key, default `gen_random_uuid()`)
- `name`: Text (Nome da pessoa e/ou empresa interessado em ser parceira)
- `phone`: Text (Telefone ou WhatsApp para retorno)
- `email`: Text (E-mail de contato)
- `status`: Text (Opções: `Pendente`, `Contatado`, `Aprovado`, `Arquivado` - Default `Pendente`)
- `created_at`: Timestamptz (Default `now()`)

**Políticas RLS:**
- *Insert:* Pública (`FOR INSERT WITH CHECK (true)`), permitindo que qualquer estabelecimento submeta o formulário sem autenticação na rota pública.
- *Select / Update:* Restrito aos gestores autenticados (`auth.role() = 'authenticated'`).

## 3. Experiência e Interface do Usuário (UI/UX)

### 3.1. Rota Pública: `/clube-descontos`
- **Componentes:**
  - **Hero & CTA Topo:** Título inspirador ("Clube de Vantagens ACPO: Descontos exclusivos para você e sua família") + Botão de ação em destaque: *"Seja um Parceiro ACPO"*.
  - **Barra de Busca Rápida e Filtros de Categoria:** Filtros reativos na memória (Client-side) com botões por categoria (Todas, Educação, Academia, Alimentação, Saúde, Lazer, Serviços) + Input de texto instantâneo.
  - **Grid de Cards de Vantagem:** Cards visuais construídos em Tailwind + ícones nativos `lucide-react` coerentes por categoria. Apresenta o badge de desconto em destaque, descrição e botão *"Como Utilizar"*.
  - **Modal "Como Utilizar":** Ao clicar, abre popup leve com o passo a passo exato de resgate (`how_to_use`) e contatos essenciais.
  - **Modal "Seja um Parceiro":** Acionado pelo botão do topo, contém formulário enxuto de 3 campos: Nome/Empresa, Telefone e E-mail. Grava diretamente em `partner_leads` e exibe mensagem de sucesso.

### 3.2. Painel Interno de Gestão: `/dashboard/parceiros`
- Acessível no menu lateral (Sidebar) do Dashboard.
- Dividido em 2 abas claras:
  1. **Aba "Fila de Candidatos (Leads)"**: Lista em ordem cronológica reversa os contatos captados. Permite com 1 clique alterar o status (ex: de `Pendente` para `Contatado`) ou transformar direto em um Parceiro Oficial na vitrine via modal pré-preenchido.
  2. **Aba "Vitrine de Parceiros"**: CRUD (Tabela com botões Adicionar Novo, Editar e Desativar/Ativar) para a equipe de Gestão atualizar ofertas em tempo real.

### 3.3. Notificações Integradas no Sininho (`NotificationBell.tsx`)
- Adição de consulta à tabela `partner_leads` filtrando `status = 'Pendente'`.
- Sempre que houver pelo menos 1 candidato pendente, o badge vermelho do sininho é atualizado e soma ao contador geral do topo.
- Na listagem suspensa do sininho, surge uma seção com ícone de parceria: *"🤝 Novos Parceiros - [N] contato(s) aguardando avaliação"*.
- O clique na notificação redireciona imediatamente para `/dashboard/parceiros?tab=leads`.
- Aproveita o intervalo existente de polling de 60s + inscrição de Realtime do Supabase no componente.

## 4. Estratégia de Verificação & Seguros de Qualidade
- **Migração Declarativa SQL:** Script autônomo (ex: `supabase/migrations/xxxx_clube_descontos.sql` e script `.mjs` executor) garantindo criação simultânea de tabelas e permissões RLS com zero erro humano.
- **Tratamento de Erros no Frontend:** Mensagens de feedback limpas via state/alerts para erros de rede na submissão de leads ou cadastros.
- **Testes Manuais Práticos:** Submissão de teste na rota `/clube-descontos`, conferência imediata da contagem do badge em `NotificationBell` e validação de aprovação em `/dashboard/parceiros`.
