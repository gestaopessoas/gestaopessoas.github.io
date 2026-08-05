"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/utils/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { 
  BadgePercent, 
  Users, 
  Plus, 
  Pencil, 
  Trash2, 
  CheckCircle2, 
  XCircle, 
  Search, 
  ExternalLink, 
  Tag, 
  Sparkles,
  Gift
} from "lucide-react";
import { DiscountPartner, PartnerLead } from "@/types/benefits";

type Partner = DiscountPartner;

// Fallback de demonstração para quando a tabela ainda está sendo provisionada em produção
const FALLBACK_PARTNERS: Partner[] = [
  {
    id: "d1111111-1111-4111-8111-111111111111",
    name: "Smart Fit & Gyms",
    category: "Saúde & Bem-Estar",
    discount_rules: "Desconto de até 30% nas mensalidades do plano Black para colaboradores e dependentes.",
    promocodes: ["SMARTHR30", "FITBS2026"],
    logo_url: "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=150&q=80",
    is_active: true,
    created_at: new Date().toISOString()
  },
  {
    id: "d2222222-2222-4222-8222-222222222222",
    name: "Faculdade Descomplica",
    category: "Educação",
    discount_rules: "Bolsa de 45% em cursos de Pós-Graduação e MBA EaD para todo o quadro da Clínica BS.",
    promocodes: ["DESCOMPLICABS45", "POS2026BS"],
    logo_url: "https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&w=150&q=80",
    is_active: true,
    created_at: new Date().toISOString()
  },
  {
    id: "d3333333-3333-4333-8333-333333333333",
    name: "Restaurante Sabor & Prosa",
    category: "Alimentação",
    discount_rules: "15% de desconto no buffet executivo presencial apresentando o crachá ou voucher online.",
    promocodes: ["SABORBS15"],
    logo_url: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=150&q=80",
    is_active: false,
    created_at: new Date().toISOString()
  }
];

const FALLBACK_LEADS: (PartnerLead & { partner_name?: string; employee_name?: string })[] = [
  {
    id: "lead-demo-1",
    partner_id: "d1111111-1111-4111-8111-111111111111",
    employee_id: "emp-demo-101",
    status: "resgatado",
    created_at: new Date(Date.now() - 3600000).toISOString(),
    partner_name: "Smart Fit & Gyms",
    employee_name: "Ana Carolina Santos"
  },
  {
    id: "lead-demo-2",
    partner_id: "d2222222-2222-4222-8222-222222222222",
    employee_id: "emp-demo-102",
    status: "atendido",
    created_at: new Date(Date.now() - 86400000).toISOString(),
    partner_name: "Faculdade Descomplica",
    employee_name: "Rafael Oliveira Souza"
  }
];

const CATEGORIES = [
  "Saúde & Bem-Estar",
  "Educação",
  "Alimentação",
  "Lazer & Cultura",
  "Serviços & Varejo"
];

const emptyPartnerForm: Omit<Partner, "id" | "created_at" | "updated_at"> = {
  name: "",
  category: "Saúde & Bem-Estar",
  discount_rules: "",
  promocodes: [""],
  logo_url: "",
  is_active: true
};

export default function ParceirosAdminPage() {
  const supabase = createClient();
  const [partners, setPartners] = useState<Partner[]>([]);
  const [leads, setLeads] = useState<(PartnerLead & { partner_name?: string; employee_name?: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  // Estados de formulário modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyPartnerForm);
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    // Fetch parceiros
    const { data: pData, error: pErr } = await supabase
      .from("discount_partners")
      .select("*")
      .order("name", { ascending: true });

    // Fetch leads e funcionários para cruzar nomes
    const { data: lData, error: lErr } = await supabase
      .from("partner_leads")
      .select("*")
      .order("created_at", { ascending: false });

    const { data: emps } = await supabase
      .from("employees")
      .select("id, name");

    if (pErr || !pData || pData.length === 0) {
      setPartners(FALLBACK_PARTNERS);
    } else {
      setPartners(pData as Partner[]);
    }

    const effectivePartners = pErr || !pData || pData.length === 0 ? FALLBACK_PARTNERS : (pData as Partner[]);

    if (lErr || !lData || lData.length === 0) {
      setLeads(FALLBACK_LEADS);
    } else {
      const empsMap = new Map((emps || []).map((e: { id: string; name: string }) => [String(e.id), String(e.name)]));
      const partnersMap = new Map(effectivePartners.map(p => [String(p.id), String(p.name)]));

      const enrichedLeads = (lData as PartnerLead[]).map(lead => ({
        ...lead,
        partner_name: partnersMap.get(String(lead.partner_id)) || "Convênio Excluído",
        employee_name: empsMap.get(String(lead.employee_id)) || `Colaborador (${String(lead.employee_id).slice(0, 8)})`
      }));
      setLeads(enrichedLeads);
    }

    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Manipuladores do CRUD de Parceiros
  const handleOpenNewModal = () => {
    setEditingId(null);
    setForm(emptyPartnerForm);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (p: Partner) => {
    setEditingId(p.id);
    setForm({
      name: p.name,
      category: p.category,
      discount_rules: p.discount_rules,
      promocodes: p.promocodes && p.promocodes.length > 0 ? p.promocodes : [""],
      logo_url: p.logo_url || "",
      is_active: p.is_active
    });
    setIsModalOpen(true);
  };

  const handleSavePartner = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.discount_rules) {
      alert("Por favor, preencha pelo menos o nome e as regras do convênio.");
      return;
    }

    setSaving(true);
    const cleanedPromos = form.promocodes.map((s: string) => s.trim()).filter(Boolean);

    const payload = {
      name: form.name.trim(),
      category: form.category,
      discount_rules: form.discount_rules.trim(),
      promocodes: cleanedPromos,
      logo_url: form.logo_url?.trim() || "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=150&q=80",
      is_active: form.is_active,
      updated_at: new Date().toISOString()
    };

    try {
      if (editingId) {
        const { error } = await supabase.from("discount_partners").update(payload).eq("id", editingId);
        if (error && error.code !== "PGRST205") {
          console.warn("Retorno Supabase no update:", error.message);
        }
        setPartners(prev => prev.map(p => p.id === editingId ? { ...p, ...payload, id: editingId } : p));
      } else {
        const { data, error } = await supabase.from("discount_partners").insert(payload).select().single();
        if (error && error.code !== "PGRST205") {
          console.warn("Retorno Supabase no insert:", error.message);
        }
        const created: Partner = data || { ...payload, id: `d-${Date.now()}`, created_at: new Date().toISOString() };
        setPartners(prev => [created, ...prev]);
      }
      setIsModalOpen(false);
    } catch (err: unknown) {
      console.error(err);
    } finally {
      setSaving(false);
      await fetchData();
    }
  };

  const handleToggleActive = async (id: string, currentStatus: boolean) => {
    const nextStatus = !currentStatus;
    setPartners(prev => prev.map(p => p.id === id ? { ...p, is_active: nextStatus } : p));
    await supabase.from("discount_partners").update({ is_active: nextStatus }).eq("id", id);
  };

  const handleDeletePartner = async (id: string, name: string) => {
    if (!confirm(`Deseja realmente remover o parceiro "${name}" do catálogo oficial?`)) return;
    setPartners(prev => prev.filter(p => p.id !== id));
    await supabase.from("discount_partners").delete().eq("id", id);
  };

  // Manipuladores da fila de Resgates / Leads
  const handleUpdateLeadStatus = async (leadId: string, newStatus: string) => {
    setLeads(prev => prev.map(l => l.id === leadId ? { ...l, status: newStatus } : l));
    await supabase.from("partner_leads").update({ status: newStatus }).eq("id", leadId);
  };

  const filteredPartners = partners.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    p.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.discount_rules.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 flex items-center gap-2.5">
            <BadgePercent className="h-8 w-8 text-emerald-600" />
            <span>Gestão de Parceiros &amp; Clube de Descontos</span>
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Administre a vitrine ativa de convênios da Clínica BS, valide regras e monitore em tempo real os resgates solicitados pelos colaboradores.
          </p>
        </div>
        <div className="flex gap-2.5 shrink-0">
          <Button
            onClick={() => window.open("/clube-descontos", "_blank")}
            variant="outline"
            size="sm"
            className="gap-2 text-zinc-700 dark:text-zinc-300 font-semibold shadow-xs"
          >
            <ExternalLink className="h-4 w-4 text-zinc-500" />
            <span>Ver Portal Público</span>
          </Button>
          <Button
            onClick={handleOpenNewModal}
            size="sm"
            className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-sm"
          >
            <Plus className="h-4 w-4" />
            <span>Novo Parceiro</span>
          </Button>
        </div>
      </div>

      <Tabs defaultValue="vitrine" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2 mb-4">
          <TabsTrigger value="vitrine" className="flex gap-2 relative">
            <Gift className="w-4 h-4 text-emerald-500" />
            <span>Vitrine Ativa (Catálogo)</span>
            <span className="ml-1 rounded-full bg-emerald-500/10 text-emerald-600 px-2 py-0.5 text-[10px] font-bold">
              {partners.length}
            </span>
          </TabsTrigger>
          <TabsTrigger value="leads" className="flex gap-2 relative">
            <Users className="w-4 h-4 text-amber-500" />
            <span>Fila de Resgates &amp; Leads</span>
            {leads.length > 0 && (
              <span className="ml-1 rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-300 px-2 py-0.5 text-[10px] font-bold">
                {leads.filter(l => l.status === "resgatado").length || leads.length}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        {/* ABA 1: VITRINE DE PARCEIROS / CONVÊNIO (CRUD) */}
        <TabsContent value="vitrine" className="space-y-4">
          <Card className="border-zinc-200 dark:border-zinc-800 shadow-xs">
            <CardHeader className="pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <CardTitle>Catálogo Oficial de Vantagens</CardTitle>
                <CardDescription>
                  Configure categorias, percentuais de desconto e cupons de verificação liberados no portal do colaborador.
                </CardDescription>
              </div>
              <div className="relative w-full sm:w-72">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                <input
                  type="text"
                  placeholder="Buscar por marca, categoria..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-1.5 rounded-md border border-zinc-300 dark:border-zinc-700 bg-background text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <p className="text-sm text-muted-foreground py-6 text-center">Carregando catálogo do Supabase...</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-2">
                  {filteredPartners.map((p) => (
                    <div
                      key={p.id}
                      className={`flex flex-col justify-between rounded-xl border p-4 transition-all shadow-xs ${
                        p.is_active
                          ? "border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60"
                          : "border-dashed border-zinc-300 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/40 opacity-70"
                      }`}
                    >
                      <div>
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <div className="flex items-center gap-3">
                            <div className="h-12 w-12 rounded-lg bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 overflow-hidden shrink-0 flex items-center justify-center font-bold text-lg text-emerald-600">
                              {p.logo_url ? (
                                <img src={p.logo_url} alt={p.name} className="h-full w-full object-cover" />
                              ) : (
                                p.name.charAt(0)
                              )}
                            </div>
                            <div>
                              <h3 className="font-bold text-zinc-900 dark:text-white leading-snug">{p.name}</h3>
                              <span className="inline-flex items-center text-xs font-medium text-emerald-600 dark:text-emerald-400">
                                {p.category}
                              </span>
                            </div>
                          </div>
                          <span
                            onClick={() => handleToggleActive(p.id, p.is_active)}
                            className={`cursor-pointer inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase border transition-colors ${
                              p.is_active
                                ? "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800 hover:bg-emerald-200"
                                : "bg-zinc-200 text-zinc-600 border-zinc-300 dark:bg-zinc-800 dark:text-zinc-400 hover:bg-zinc-300"
                            }`}
                          >
                            {p.is_active ? <CheckCircle2 className="h-3 w-3 text-emerald-600" /> : <XCircle className="h-3 w-3" />}
                            {p.is_active ? "Ativo no Portal" : "Oculto / Inativo"}
                          </span>
                        </div>

                        <p className="text-xs text-zinc-600 dark:text-zinc-300 line-clamp-3 leading-relaxed mb-3">
                          {p.discount_rules}
                        </p>

                        {p.promocodes && p.promocodes.length > 0 && (
                          <div className="flex flex-wrap items-center gap-1.5 mb-4">
                            <Tag className="h-3 w-3 text-emerald-500 shrink-0 mr-0.5" />
                            {p.promocodes.map((code: string, i: number) => (
                              <span
                                key={i}
                                className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-zinc-100 dark:bg-zinc-800/80 border text-zinc-800 dark:text-zinc-200 border-zinc-200 dark:border-zinc-700"
                              >
                                {code}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-100 dark:border-zinc-800/80 mt-auto">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleOpenEditModal(p)}
                          className="h-8 px-3 text-xs font-semibold gap-1.5 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100"
                        >
                          <Pencil className="h-3 w-3 text-zinc-500" />
                          <span>Editar</span>
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDeletePartner(p.id, p.name)}
                          className="h-8 px-2.5 text-xs text-red-600 hover:bg-red-50 hover:text-red-700 border-red-200 dark:border-red-900/40 dark:hover:bg-red-950/30"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                  {filteredPartners.length === 0 && (
                    <div className="col-span-full py-12 text-center text-zinc-500 border border-dashed rounded-xl">
                      Nenhum parceiro encontrado no catálogo com o termo pesquisado.
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ABA 2: FILA DE RESGATES / LEADS (MONITORAMENTO) */}
        <TabsContent value="leads" className="space-y-4">
          <Card className="border-zinc-200 dark:border-zinc-800 shadow-xs">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Fila de Cupons &amp; Resgates dos Colaboradores</CardTitle>
                  <CardDescription>
                    Monitore quem solicitou cupons corporativos ou demonstrou interesse nos convênios em tempo real.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <p className="text-sm text-muted-foreground py-6 text-center">Carregando resgates...</p>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-muted/60 text-xs font-semibold uppercase text-muted-foreground">
                      <tr>
                        <th className="px-4 py-3">Data do Resgate</th>
                        <th className="px-4 py-3">Colaborador</th>
                        <th className="px-4 py-3">Parceiro / Convênio</th>
                        <th className="px-4 py-3">Status de Processamento</th>
                        <th className="px-4 py-3 text-right">Ação</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                      {leads.map((l) => (
                        <tr key={l.id || Math.random().toString()} className="hover:bg-muted/40 transition-colors">
                          <td className="px-4 py-3 tabular-nums text-xs text-zinc-500 dark:text-zinc-400 font-mono">
                            {format(new Date(l.created_at || new Date().toISOString()), "dd/MM/yyyy HH:mm")}
                          </td>
                          <td className="px-4 py-3 font-semibold text-zinc-900 dark:text-zinc-100">
                            {l.employee_name}
                          </td>
                          <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300 font-medium">
                            {l.partner_name}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wide border ${
                              l.status === "atendido"
                                ? "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/50 dark:text-emerald-300"
                                : "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/50 dark:text-amber-300"
                            }`}>
                              {l.status === "atendido" ? "Atendido / Liberado" : "Novo Resgate (Pendente)"}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            {l.status !== "atendido" ? (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleUpdateLeadStatus(l.id || "", "atendido")}
                                className="text-xs text-emerald-700 hover:bg-emerald-50 border-emerald-300 font-semibold gap-1"
                              >
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                <span>Marcar Atendido</span>
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleUpdateLeadStatus(l.id || "", "resgatado")}
                                className="text-xs text-zinc-500 hover:text-zinc-700 font-normal"
                              >
                                Reabrir
                              </Button>
                            )}
                          </td>
                        </tr>
                      ))}
                      {leads.length === 0 && (
                        <tr>
                          <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                            Nenhum resgate registrado na tabela &ldquo;partner_leads&rdquo; até o momento.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* MODAL DE CRIAÇÃO / EDIÇÃO DE PARCEIRO */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-2xl p-6 overflow-hidden">
            <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-4 mb-4">
              <h2 className="text-lg font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-emerald-600" />
                <span>{editingId ? "Editar Parceiro no Catálogo" : "Cadastrar Novo Parceiro & Convênio"}</span>
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSavePartner} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase text-zinc-600 dark:text-zinc-400 mb-1">
                  Nome do Convênio / Empresa *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Smart Fit & Gyms"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-background text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase text-zinc-600 dark:text-zinc-400 mb-1">
                    Categoria *
                  </label>
                  <select
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-background text-sm focus:ring-2 focus:ring-emerald-500"
                  >
                    {CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase text-zinc-600 dark:text-zinc-400 mb-1">
                    URL da Logo (Opcional)
                  </label>
                  <input
                    type="url"
                    placeholder="https://..."
                    value={form.logo_url || ""}
                    onChange={(e) => setForm({ ...form, logo_url: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-background text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-zinc-600 dark:text-zinc-400 mb-1">
                  Regras e Condições de Desconto *
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder="Descreva as porcentagens e regras. Ex: 30% de desconto mediante apresentação do crachá na recepção."
                  value={form.discount_rules}
                  onChange={(e) => setForm({ ...form, discount_rules: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-background text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-hidden resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-zinc-600 dark:text-zinc-400 mb-1">
                  Cupons ou Códigos Promocionais (Separados por vírgula)
                </label>
                <input
                  type="text"
                  placeholder="Ex: CLINICABS30, DESCONTO2026"
                  value={(form.promocodes || []).join(", ")}
                  onChange={(e) => setForm({ ...form, promocodes: e.target.value.split(",").map(c => c.trim()) })}
                  className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-background font-mono text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                />
                <p className="text-[11px] text-zinc-500 mt-1">
                  Estes códigos serão exibidos em destaque quando o funcionário abrir os detalhes na vitrine.
                </p>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="chk-active"
                  checked={form.is_active}
                  onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                  className="h-4 w-4 rounded-sm border-zinc-300 text-emerald-600 focus:ring-emerald-500"
                />
                <label htmlFor="chk-active" className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 cursor-pointer">
                  Publicar e deixar ativo no Portal do Colaborador
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-zinc-100 dark:border-zinc-800">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsModalOpen(false)}
                  className="text-sm font-semibold"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={saving}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold shadow-sm px-5"
                >
                  {saving ? "Salvando..." : editingId ? "Atualizar Parceiro" : "Cadastrar no Banco"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
