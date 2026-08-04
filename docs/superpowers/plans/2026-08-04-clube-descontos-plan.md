# Clube de Descontos & Parceiros ACPO Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar o portal público de vantagens `/clube-descontos` com captação de leads, gestão admin no painel `/dashboard/parceiros` e notificações instantâneas no sininho do painel.

**Architecture:** Duas tabelas no Supabase (`discount_partners` e `partner_leads`) com políticas RLS granulares, tela pública no Next.js App Router com filtro reativo client-side, CRUD de gestão no Dashboard e integração de contagem de leads pendentes em `NotificationBell.tsx`.

**Tech Stack:** Next.js (App Router), React, Tailwind CSS, lucide-react, Supabase JS, PostgreSQL SQL Migrations.

## Global Constraints

- Siga estritamente a filosofia Ponytail / Lazy Senior Dev: zero dependências extras, código simples, legível e seguro.
- Utilize as convenções do design system existente em `src/components/layout/` e `src/app/dashboard/`.
- Mantenha a integridade dos tipos em TypeScript sem uso arbitrário de `any` onde tipos concretos estiverem disponíveis.

---

### Task 1: SQL Migration & Verification Script (Supabase DB)

**Files:**
- Create: `supabase/migrations/20260804160000_create_discount_partners_and_leads.sql`
- Create: `test-clube-descontos-db.mjs`

**Interfaces:**
- Produces: Tabelas `discount_partners` e `partner_leads` no Supabase para consumo nas Tasks 2, 3 e 4.

- [ ] **Step 1: Escrever o script de verificação do banco (Failing Test)**

Escreva no arquivo `test-clube-descontos-db.mjs`:

```javascript
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://bnwwdseczwrmmuvallml.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJud3dkc2VjendybW11dmFsbG1sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM0NDIxMDcsImV4cCI6MjA5OTAxODEwN30.46hTU6b8xgpsoASZu0K7cEi_FfA3ZBt8e417mfrda7k';
const supabase = createClient(supabaseUrl, supabaseKey);

async function verifyTables() {
  console.log('=== Verificando tabelas do Clube de Descontos ===\n');
  
  const { data: partners, error: errPartners } = await supabase
    .from('discount_partners')
    .select('id, name, discount_badge, status')
    .limit(1);
    
  if (errPartners) {
    console.error('❌ Falha na tabela discount_partners:', errPartners.message);
    process.exit(1);
  }
  console.log('✅ Tabela discount_partners acessível:', partners);

  const { data: leads, error: errLeads } = await supabase
    .from('partner_leads')
    .select('id, name, email, status')
    .limit(1);
    
  if (errLeads) {
    console.error('❌ Falha na tabela partner_leads:', errLeads.message);
    process.exit(1);
  }
  console.log('✅ Tabela partner_leads acessível:', leads);
}

verifyTables().catch(err => {
  console.error('Erro de execução:', err);
  process.exit(1);
});
```

- [ ] **Step 2: Rodar o teste para comprovar falha inicial (Tabela não existente ou RLS ausente)**

Run: `node test-clube-descontos-db.mjs`  
Expected: Falha informando que as tabelas `discount_partners` e/ou `partner_leads` não foram encontradas.

- [ ] **Step 3: Escrever a migração SQL declarativa**

Crie o arquivo `supabase/migrations/20260804160000_create_discount_partners_and_leads.sql`:

```sql
-- Create table for official discount partners shown to employees
CREATE TABLE IF NOT EXISTS public.discount_partners (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'Serviços',
    discount_badge TEXT NOT NULL,
    description TEXT,
    how_to_use TEXT NOT NULL,
    contact_info TEXT,
    status TEXT NOT NULL DEFAULT 'Ativo',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Create table for prospective partner leads (from public modal)
CREATE TABLE IF NOT EXISTS public.partner_leads (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    email TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'Pendente',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on both tables
ALTER TABLE public.discount_partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_leads ENABLE ROW LEVEL SECURITY;

-- Policies for discount_partners
DROP POLICY IF EXISTS "Allow public read on active discount_partners" ON public.discount_partners;
CREATE POLICY "Allow public read on active discount_partners" 
ON public.discount_partners FOR SELECT 
USING (status = 'Ativo' OR auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Allow authenticated users to manage discount_partners" ON public.discount_partners;
CREATE POLICY "Allow authenticated users to manage discount_partners" 
ON public.discount_partners FOR ALL 
USING (auth.role() = 'authenticated')
WITH CHECK (auth.role() = 'authenticated');

-- Policies for partner_leads
DROP POLICY IF EXISTS "Allow public insert on partner_leads" ON public.partner_leads;
CREATE POLICY "Allow public insert on partner_leads" 
ON public.partner_leads FOR INSERT 
WITH CHECK (true);

DROP POLICY IF EXISTS "Allow authenticated read and update on partner_leads" ON public.partner_leads;
CREATE POLICY "Allow authenticated read and update on partner_leads" 
ON public.partner_leads FOR ALL 
USING (auth.role() = 'authenticated')
WITH CHECK (auth.role() = 'authenticated');
```

- [ ] **Step 4: Aplicar migração e verificar sucesso do teste**

*(Obs: Se houver script local ou conexão remota Supabase, execute o SQL no banco. Após aplicado no banco do projeto, execute o script mjs novamente).*  
Run: `node test-clube-descontos-db.mjs`  
Expected: `✅ Tabela discount_partners acessível:` e `✅ Tabela partner_leads acessível:`.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260804160000_create_discount_partners_and_leads.sql test-clube-descontos-db.mjs
git commit -m "feat(db): create discount_partners and partner_leads tables with RLS"
```

---

### Task 2: Rota Pública `/clube-descontos`

**Files:**
- Create: `src/app/clube-descontos/page.tsx`

**Interfaces:**
- Consumes: Tabelas `discount_partners` e `partner_leads` (criadas na Task 1).

- [ ] **Step 1: Criar página do Clube de Descontos e Modal de Candidato**

Crie o arquivo `src/app/clube-descontos/page.tsx`:

```tsx
"use client";

import React, { useState, useEffect, useMemo } from "react";
import { createClient } from "@/utils/supabase/client";
import { Tag, Search, Handshake, CheckCircle2, X, ChevronRight, Sparkles, Building2, Phone, Mail, Award } from "lucide-react";
import Link from "next/link";

interface DiscountPartner {
  id: string;
  name: string;
  category: string;
  discount_badge: string;
  description: string;
  how_to_use: string;
  contact_info: string;
}

const CATEGORIES = ["Todas", "Educação", "Academia", "Alimentação", "Saúde", "Lazer", "Serviços"];

export default function ClubeDescontosPage() {
  const [partners, setPartners] = useState<DiscountPartner[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState("Todas");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPartner, setSelectedPartner] = useState<DiscountPartner | null>(null);
  
  // Modal de candidatura (Lead)
  const [isLeadModalOpen, setIsLeadModalOpen] = useState(false);
  const [leadName, setLeadName] = useState("");
  const [leadPhone, setLeadPhone] = useState("");
  const [leadEmail, setLeadEmail] = useState("");
  const [leadSubmitting, setLeadSubmitting] = useState(false);
  const [leadSuccess, setLeadSuccess] = useState(false);
  const [leadError, setLeadError] = useState("");

  const supabase = createClient();

  useEffect(() => {
    async function fetchPartners() {
      setLoading(true);
      const { data, error } = await supabase
        .from("discount_partners")
        .select("id, name, category, discount_badge, description, how_to_use, contact_info")
        .eq("status", "Ativo")
        .order("name", { ascending: true });

      if (!error && data) {
        setPartners(data as DiscountPartner[]);
      }
      setLoading(false);
    }
    fetchPartners();
  }, [supabase]);

  const filteredPartners = useMemo(() => {
    return partners.filter(p => {
      const matchCat = selectedCategory === "Todas" || p.category === selectedCategory;
      const matchSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          p.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (p.description && p.description.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchCat && matchSearch;
    });
  }, [partners, selectedCategory, searchQuery]);

  async function handleLeadSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!leadName || !leadPhone || !leadEmail) {
      setLeadError("Por favor, preencha todos os campos.");
      return;
    }
    setLeadSubmitting(true);
    setLeadError("");
    
    const { error } = await supabase.from("partner_leads").insert([
      { name: leadName, phone: leadPhone, email: leadEmail, status: "Pendente" }
    ]);

    setLeadSubmitting(false);
    if (error) {
      setLeadError("Erro ao enviar contato. Tente novamente mais tarde.");
    } else {
      setLeadSuccess(true);
      setLeadName("");
      setLeadPhone("");
      setLeadEmail("");
    }
  }

  function getCategoryColor(category: string) {
    switch (category) {
      case "Educação": return "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/40 dark:text-blue-300";
      case "Academia": return "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-300";
      case "Alimentação": return "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/40 dark:text-amber-300";
      case "Saúde": return "bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-900/40 dark:text-rose-300";
      case "Lazer": return "bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/40 dark:text-purple-300";
      default: return "bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-800 dark:text-gray-300";
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header / Nav */}
      <header className="border-b bg-card py-4 px-6 md:px-12 flex justify-between items-center sticky top-0 z-30 shadow-sm">
        <div className="flex items-center gap-2 font-bold text-xl">
          <Sparkles className="h-6 w-6 text-primary" />
          <span>Clube de <span className="text-primary">Vantagens</span> ACPO</span>
        </div>
        <button 
          onClick={() => { setIsLeadModalOpen(true); setLeadSuccess(false); }}
          className="bg-primary text-primary-foreground font-semibold px-4 py-2 rounded-lg text-sm hover:opacity-90 transition-opacity flex items-center gap-2 shadow-md"
        >
          <Handshake className="h-4 w-4" />
          Seja um Parceiro
        </button>
      </header>

      {/* Hero Section */}
      <section className="bg-gradient-to-b from-card to-background py-16 px-6 text-center max-w-4xl mx-auto">
        <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight mb-4">
          Descontos exclusivos para você, colaborador ACPO!
        </h1>
        <p className="text-muted-foreground text-base md:text-lg mb-8">
          Aproveite acordos especiais em faculdades, academias, farmácias, restaurantes e muito mais. Escolha sua vantagem e saiba como utilizar em segundos.
        </p>

        {/* Busca e Filtros */}
        <div className="max-w-2xl mx-auto relative mb-6">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por parceiro ou categoria..."
            className="w-full pl-11 pr-4 py-3 rounded-xl border bg-card text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        <div className="flex flex-wrap justify-center gap-2">
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
                selectedCategory === cat
                  ? "bg-primary text-primary-foreground shadow-sm scale-105"
                  : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </section>

      {/* Grid de Parceiros */}
      <main className="max-w-6xl mx-auto px-6 pb-20">
        {loading ? (
          <div className="text-center py-20 text-muted-foreground animate-pulse">Carregando parceiros de desconto...</div>
        ) : filteredPartners.length === 0 ? (
          <div className="text-center py-20 bg-card border rounded-2xl max-w-md mx-auto p-8 shadow-sm">
            <Tag className="h-12 w-12 text-muted-foreground mx-auto mb-3 opacity-50" />
            <h3 className="font-bold text-lg mb-1">Nenhum parceiro encontrado</h3>
            <p className="text-muted-foreground text-sm">Não encontramos descontos para o filtro atual ou busca informada.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredPartners.map(partner => (
              <div 
                key={partner.id} 
                className="bg-card border rounded-2xl p-6 shadow-sm hover:shadow-md transition-all flex flex-col justify-between group cursor-pointer"
                onClick={() => setSelectedPartner(partner)}
              >
                <div>
                  <div className="flex justify-between items-start mb-3 gap-2">
                    <span className={`px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wider border ${getCategoryColor(partner.category)}`}>
                      {partner.category}
                    </span>
                    <span className="bg-primary/10 text-primary px-3 py-1 rounded-full text-xs font-extrabold flex items-center gap-1 shrink-0">
                      <Award className="h-3.5 w-3.5" />
                      {partner.discount_badge}
                    </span>
                  </div>
                  <h3 className="font-bold text-xl mb-2 text-foreground group-hover:text-primary transition-colors">{partner.name}</h3>
                  <p className="text-muted-foreground text-sm line-clamp-3 mb-6">{partner.description}</p>
                </div>
                
                <button 
                  className="w-full mt-auto py-2.5 px-4 bg-muted text-foreground hover:bg-primary hover:text-primary-foreground font-semibold rounded-xl text-sm transition-colors flex items-center justify-center gap-1"
                >
                  Como Utilizar
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Modal "Como Utilizar" */}
      {selectedPartner && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-card border rounded-2xl p-6 max-w-lg w-full shadow-2xl relative">
            <button 
              onClick={() => setSelectedPartner(null)}
              className="absolute right-4 top-4 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
            <div className="mb-4">
              <span className={`px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wider border ${getCategoryColor(selectedPartner.category)}`}>
                {selectedPartner.category}
              </span>
              <h2 className="text-2xl font-extrabold mt-2 text-foreground">{selectedPartner.name}</h2>
              <div className="inline-block mt-1 bg-primary/15 text-primary font-extrabold px-3 py-1 rounded-lg text-sm">
                Desconto: {selectedPartner.discount_badge}
              </div>
            </div>

            <div className="space-y-4 text-sm border-t pt-4">
              <div>
                <h4 className="font-bold text-muted-foreground uppercase text-xs tracking-wider mb-1">Como Resgatar / Regras</h4>
                <p className="text-foreground bg-muted p-3 rounded-xl leading-relaxed whitespace-pre-line font-medium">
                  {selectedPartner.how_to_use}
                </p>
              </div>

              {selectedPartner.contact_info && (
                <div>
                  <h4 className="font-bold text-muted-foreground uppercase text-xs tracking-wider mb-1">Contato / Local de Atendimento</h4>
                  <p className="text-foreground font-medium">{selectedPartner.contact_info}</p>
                </div>
              )}
            </div>

            <button 
              onClick={() => setSelectedPartner(null)}
              className="mt-6 w-full bg-primary text-primary-foreground py-3 rounded-xl font-bold text-sm hover:opacity-90 transition-opacity"
            >
              Entendido!
            </button>
          </div>
        </div>
      )}

      {/* Modal "Seja um Parceiro" (Lead Form) */}
      {isLeadModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-card border rounded-2xl p-6 max-w-md w-full shadow-2xl relative">
            <button 
              onClick={() => setIsLeadModalOpen(false)}
              className="absolute right-4 top-4 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="text-center mb-6">
              <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-3">
                <Handshake className="h-6 w-6 text-primary" />
              </div>
              <h2 className="text-xl font-extrabold text-foreground">Ofereça desconto aos colaboradores ACPO</h2>
              <p className="text-muted-foreground text-xs mt-1">
                Preencha o formulário abaixo e nossa equipe de Gestão & Pessoas entrará em contato para oficializar a parceria.
              </p>
            </div>

            {leadSuccess ? (
              <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 text-emerald-800 dark:text-emerald-300 p-6 rounded-xl text-center">
                <CheckCircle2 className="h-10 w-10 text-emerald-600 mx-auto mb-2" />
                <h4 className="font-bold text-base mb-1">Contato Enviado!</h4>
                <p className="text-xs text-emerald-700 dark:text-emerald-400 mb-4">
                  Obrigado por querer fazer parte do Clube de Vantagens! A equipe do Bruno Gonçalves no RH da ACPO foi notificada no sistema.
                </p>
                <button
                  onClick={() => setIsLeadModalOpen(false)}
                  className="w-full bg-emerald-600 text-white font-semibold py-2 rounded-lg text-sm hover:opacity-90"
                >
                  Fechar
                </button>
              </div>
            ) : (
              <form onSubmit={handleLeadSubmit} className="space-y-4">
                {leadError && (
                  <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 text-red-700 dark:text-red-300 text-xs p-3 rounded-lg">
                    {leadError}
                  </div>
                )}

                <div>
                  <label className="text-xs font-bold uppercase text-muted-foreground block mb-1">Nome / Empresa</label>
                  <div className="relative">
                    <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <input 
                      type="text"
                      required
                      value={leadName}
                      onChange={e => setLeadName(e.target.value)}
                      placeholder="Nome da sua clínica, escola, academia..."
                      className="w-full pl-9 pr-3 py-2.5 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold uppercase text-muted-foreground block mb-1">Telefone / WhatsApp</label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <input 
                      type="text"
                      required
                      value={leadPhone}
                      onChange={e => setLeadPhone(e.target.value)}
                      placeholder="(XX) 9XXXX-XXXX"
                      className="w-full pl-9 pr-3 py-2.5 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold uppercase text-muted-foreground block mb-1">E-mail para Retorno</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <input 
                      type="email"
                      required
                      value={leadEmail}
                      onChange={e => setLeadEmail(e.target.value)}
                      placeholder="seuemail@empresa.com.br"
                      className="w-full pl-9 pr-3 py-2.5 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={leadSubmitting}
                  className="w-full bg-primary text-primary-foreground font-bold py-3 rounded-xl text-sm hover:opacity-90 transition-opacity flex items-center justify-center gap-2 mt-2 disabled:opacity-50"
                >
                  {leadSubmitting ? "Enviando..." : "Enviar Candidatura"}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verificar sintaxe TypeScript e Build do arquivo (Verification)**

Run: `npx tsc --noEmit` (ou validação equivalente do projeto)  
Expected: Zero erros na sintaxe ou nos imports.

- [ ] **Step 3: Commit**

```bash
git add src/app/clube-descontos/page.tsx
git commit -m "feat(portal): implement public /clube-descontos page and lead submission modal"
```

---

### Task 3: Integração de Alerta de Parceiros no Sininho (`NotificationBell.tsx`)

**Files:**
- Modify: `src/components/layout/NotificationBell.tsx`

**Interfaces:**
- Consumes: Tabela `partner_leads` (filtrando `status = 'Pendente'`).
- Produces: Alerta interativo com link direto para `/dashboard/parceiros?tab=leads`.

- [ ] **Step 1: Adicionar state, fetch e renderização no Sininho**

Em `src/components/layout/NotificationBell.tsx`:
- Importe o ícone `Handshake` de `lucide-react` junto com os demais.
- Adicione o state `const [partnerLeads, setPartnerLeads] = useState<any[]>([]);`
- Na função `fetchNotifications`, adicione `supabase.from("partner_leads").select("id, name, email, phone").eq("status", "Pendente")` no `Promise.all` ou logo após.
- Atualize `setPartnerLeads(leadsData || []);`
- Some `partnerLeads.length` em `totalCount`.
- Adicione na lista de notificações do sino a seção "Novos Candidatos a Parceiros" (redirecionando ao clicar).

- [ ] **Step 2: Verificar validação TypeScript e zero regressões de layout**

Run: `npx tsc --noEmit`  
Expected: PASS com contagem do sino integrando parceiros pendentes de forma segura.

- [ ] **Step 3: Commit**

```bash
git add src/components/layout/NotificationBell.tsx
git commit -m "feat(notifications): add alert for pending partner leads in NotificationBell"
```

---

### Task 4: Painel de Gestão no Dashboard (`/dashboard/parceiros`)

**Files:**
- Modify: `src/components/layout/Sidebar.tsx:55-64`
- Create: `src/app/dashboard/parceiros/page.tsx`

**Interfaces:**
- Consumes: `discount_partners` e `partner_leads`.
- Produces: Módulo completo de administração das duas tabelas no Dashboard protegido.

- [ ] **Step 1: Adicionar item de navegação no menu lateral (`Sidebar.tsx`)**

Em `src/components/layout/Sidebar.tsx`, localize `name: "Facilities & Benefícios"` e insira na lista `items`:
```tsx
{ name: "Parceiros & Descontos", href: "/dashboard/parceiros", icon: Gift, module: "beneficios" },
```

- [ ] **Step 2: Criar página de Gestão de Parceiros no Dashboard**

Crie o arquivo `src/app/dashboard/parceiros/page.tsx` contendo:
- Leitura do parâmetro `?tab=` via URL ou state simples.
- **Aba 1 (Fila de Candidatos / Leads):** Tabela listando `partner_leads`. Botões rápidos para marcar como `Contatado`, `Arquivado`, ou abrir modal para Cadastrar na Vitrine importando os dados (`name`, `phone`, `email`).
- **Aba 2 (Vitrine Ativa):** CRUD visual de `discount_partners` com formulário limpo para criar ou editar ofertas (`name`, `category`, `discount_badge`, `how_to_use`, `contact_info`, `status`).

- [ ] **Step 3: Verificação de tipografia, builds e testes end-to-end do ciclo**

Run: `npx tsc --noEmit` e `node test-clube-descontos-db.mjs`  
Expected: PASS com integridade completa das tabelas e painéis sem dependências ou código desnecessário.

- [ ] **Step 4: Commit final**

```bash
git add src/components/layout/Sidebar.tsx src/app/dashboard/parceiros/page.tsx
git commit -m "feat(dashboard): add comprehensive partners management module in dashboard"
```
