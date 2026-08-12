import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { createClient } from "@/utils/supabase/client";
import { Trash2, TrendingUp, Package, Activity, Plus, Printer } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { getEmployeeBenefitLevelLabel, matchesEmployeeBenefit } from "../lib/benefitRules.mjs";
import { Select } from "./FormHelpers";

type RelatedRow = Record<string, string | number | boolean | null> & { id: string };

type BigFiveRow = {
  id: string;
  created_at: string;
  raw_answers: Record<string, number> | null;
  openness_score: number | null;
  conscientiousness_score: number | null;
  extraversion_score: number | null;
  agreeableness_score: number | null;
  neuroticism_score: number | null;
};

type UniformItem = { id: string; name: string; size: string | null; quantity_in_stock: number | null };

type UniformDeliveryRow = {
  id: string;
  quantity_delivered: number;
  delivered_at: string;
  notes: string | null;
  uniform_item_id: string;
  uniform_items: { name: string | null; size: string | null } | null;
};

type CompanyBenefit = { id: string; name: string; level_values?: Record<string, number> | null };

type DeleteTable = "employee_benefits" | "employee_epis" | "vacations" | "occupational_exams" | "employee_promotions";

function BfiBar({ label, score }: { label: string, score: number | null }) {
  const percent = (((score ?? 0) - 1) / 4) * 100;
  return (
    <div className="flex items-center gap-3">
      <span className="w-40 truncate text-xs sm:text-sm">{label}</span>
      <div className="flex-1 h-2 sm:h-3 bg-secondary rounded-full overflow-hidden">
        <div className="h-full bg-primary" style={{ width: `${Math.max(0, Math.min(100, percent))}%` }}></div>
      </div>
      <span className="w-8 text-right font-medium text-xs sm:text-sm">{score?.toFixed(1) || '-'}</span>
    </div>
  );
}

function EmployeePersonality({ employeeId }: { employeeId: string }) {
  const [history, setHistory] = useState<BigFiveRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedReport, setSelectedReport] = useState<BigFiveRow | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const { data } = await supabase.from("candidate_big_five_results").select("*").eq("employee_id", employeeId).order("created_at", { ascending: false });
    setHistory((data ?? []) as unknown as BigFiveRow[]);
    setLoading(false);
  }, [employeeId]);

  useEffect(() => {
    const run = async () => { await load(); };
    run();
  }, [load]);

  const generateLink = async () => {
    const supabase = createClient();
    const { data, error } = await supabase.from("candidate_big_five_results").insert({ employee_id: employeeId }).select("id").single();
    if (error) {
      alert("Erro ao gerar link: " + error.message);
      return;
    }
    const link = `${window.location.origin}/colaborador/teste-personalidade?session=${data.id}`;
    navigator.clipboard.writeText(link);
    alert("Link copiado para a área de transferência!\n\nEnvie este link para o colaborador preencher o teste de personalidade (BFI). O link é de uso único.");
    load();
  };

  return (
    <details className="rounded-md border p-3">
      <summary className="cursor-pointer font-medium flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-muted-foreground" /> Teste de Personalidade (BFI) ({history.length})
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-7 text-xs"
          onClick={(e) => { e.preventDefault(); generateLink(); }}
        >
          <Plus className="w-3 h-3 mr-1" /> Gerar Novo Link
        </Button>
      </summary>
      <div className="mt-3 space-y-4">
        {loading ? <div className="text-sm text-muted-foreground">Carregando...</div> : history.length === 0 ? <div className="text-sm italic text-muted-foreground">Nenhum teste registrado para este colaborador.</div> : history.map((row) => {
          const isCompleted = row.raw_answers && Object.keys(row.raw_answers).length > 0;
          return (
            <div key={row.id} className="rounded border bg-muted/20 p-4 text-sm">
              <div className="flex justify-between items-center mb-3">
                <span className="font-semibold">{new Date(row.created_at).toLocaleDateString('pt-BR')}</span>
                <span className={`px-2 py-1 text-xs rounded-full ${isCompleted ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300' : 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300'}`}>
                  {isCompleted ? 'Concluído' : 'Pendente'}
                </span>
              </div>
              {isCompleted ? (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <BfiBar label="Abertura (O)" score={row.openness_score} />
                    <BfiBar label="Conscienciosidade (C)" score={row.conscientiousness_score} />
                    <BfiBar label="Extroversão (E)" score={row.extraversion_score} />
                    <BfiBar label="Amabilidade (A)" score={row.agreeableness_score} />
                    <BfiBar label="Neuroticismo (N)" score={row.neuroticism_score} />
                  </div>
                  <Button type="button" variant="outline" size="sm" className="w-full" onClick={() => setSelectedReport(row)}>
                    Visualizar Relatório Detalhado
                  </Button>
                </div>
              ) : (
                <div className="text-xs text-muted-foreground flex items-center gap-2">
                  <span>O colaborador ainda não respondeu este teste.</span>
                  <Button type="button" variant="link" className="h-auto p-0 text-xs" onClick={() => {
                    const link = `${window.location.origin}/colaborador/teste-personalidade?session=${row.id}`;
                    navigator.clipboard.writeText(link);
                    alert("Link copiado!");
                  }}>Copiar link novamente</Button>
                </div>
              )}
            </div>
          );
        })}
      </div>
      
      <Dialog open={!!selectedReport} onOpenChange={(open) => !open && setSelectedReport(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto print-report-modal">
          <DialogHeader>
            <DialogTitle>Relatório Analítico de Perfil (Big Five)</DialogTitle>
          </DialogHeader>
          
          {selectedReport && (
            <>
              <div className="mb-2 bg-muted/20 p-4 rounded-md">
                <p className="text-sm text-muted-foreground mb-4">Teste realizado em: <strong>{new Date(selectedReport.created_at).toLocaleDateString('pt-BR')}</strong></p>
                <p className="text-sm leading-relaxed">Este relatório apresenta o mapeamento da personalidade do colaborador com base no modelo dos Cinco Grandes Fatores (Big Five). Os resultados refletem tendências comportamentais no ambiente de trabalho e não devem ser vistos como determinantes absolutos, mas como ferramentas de desenvolvimento e autoconhecimento.</p>
              </div>

              <div className="space-y-6 mt-4">
                <div>
                  <div className="flex justify-between items-end mb-1"><span className="font-semibold">Abertura à Experiência (O)</span><span className="font-bold text-primary">{(selectedReport.openness_score || 0).toFixed(1)} / 5.0</span></div>
                  <div className="w-full h-2 bg-secondary rounded-full overflow-hidden mb-2"><div className="h-full bg-primary" style={{ width: `${Math.max(0, Math.min(100, (((selectedReport.openness_score || 1) - 1) / 4) * 100))}%` }}></div></div>
                  <p className="text-sm text-muted-foreground leading-relaxed">Indica o grau de curiosidade, imaginação e preferência por novidades. Pessoas com pontuação alta costumam ser mais criativas e abertas a novas ideias. Pontuações baixas indicam preferência pela rotina e pelo que é familiar e tradicional.</p>
                </div>
                
                <div>
                  <div className="flex justify-between items-end mb-1"><span className="font-semibold">Conscienciosidade (C)</span><span className="font-bold text-primary">{(selectedReport.conscientiousness_score || 0).toFixed(1)} / 5.0</span></div>
                  <div className="w-full h-2 bg-secondary rounded-full overflow-hidden mb-2"><div className="h-full bg-primary" style={{ width: `${Math.max(0, Math.min(100, (((selectedReport.conscientiousness_score || 1) - 1) / 4) * 100))}%` }}></div></div>
                  <p className="text-sm text-muted-foreground leading-relaxed">Mede a organização, disciplina e foco em metas. Pontuações altas sugerem alguém metódico, confiável e orientado a resultados. Pontuações baixas indicam maior flexibilidade, espontaneidade e, às vezes, menor foco no planejamento.</p>
                </div>
                
                <div>
                  <div className="flex justify-between items-end mb-1"><span className="font-semibold">Extroversão (E)</span><span className="font-bold text-primary">{(selectedReport.extraversion_score || 0).toFixed(1)} / 5.0</span></div>
                  <div className="w-full h-2 bg-secondary rounded-full overflow-hidden mb-2"><div className="h-full bg-primary" style={{ width: `${Math.max(0, Math.min(100, (((selectedReport.extraversion_score || 1) - 1) / 4) * 100))}%` }}></div></div>
                  <p className="text-sm text-muted-foreground leading-relaxed">Reflete a energia, sociabilidade e busca por estímulos sociais. Quem pontua alto costuma ser comunicativo e ganha energia interagindo com outros. Quem pontua baixo (introvertidos) tende a ser mais reservado e foca em análises aprofundadas.</p>
                </div>
                
                <div>
                  <div className="flex justify-between items-end mb-1"><span className="font-semibold">Amabilidade (A)</span><span className="font-bold text-primary">{(selectedReport.agreeableness_score || 0).toFixed(1)} / 5.0</span></div>
                  <div className="w-full h-2 bg-secondary rounded-full overflow-hidden mb-2"><div className="h-full bg-primary" style={{ width: `${Math.max(0, Math.min(100, (((selectedReport.agreeableness_score || 1) - 1) / 4) * 100))}%` }}></div></div>
                  <p className="text-sm text-muted-foreground leading-relaxed">Avalia a tendência à cooperação, empatia e compaixão. Pontuações altas indicam pessoas amigáveis, colaborativas e que evitam conflitos. Pontuações baixas apontam para pessoas mais competitivas, críticas e questionadoras.</p>
                </div>
                
                <div>
                  <div className="flex justify-between items-end mb-1"><span className="font-semibold">Neuroticismo (N)</span><span className="font-bold text-primary">{(selectedReport.neuroticism_score || 0).toFixed(1)} / 5.0</span></div>
                  <div className="w-full h-2 bg-secondary rounded-full overflow-hidden mb-2"><div className="h-full bg-primary" style={{ width: `${Math.max(0, Math.min(100, (((selectedReport.neuroticism_score || 1) - 1) / 4) * 100))}%` }}></div></div>
                  <p className="text-sm text-muted-foreground leading-relaxed">Indica a sensibilidade ao estresse e a estabilidade emocional. Pontuações altas sugerem maior reatividade emocional, preocupação e ansiedade. Pontuações baixas indicam pessoas calmas, resilientes e emocionalmente estáveis sob pressão.</p>
                </div>
              </div>
              
              <DialogFooter className="mt-8 flex justify-end gap-3 print:hidden">
                <Button variant="outline" onClick={() => setSelectedReport(null)}>Fechar</Button>
                <Button onClick={() => window.print()}>Imprimir Relatório</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </details>
  );
}

function EmployeeUniforms({ employeeId }: { employeeId: string }) {
  const [items, setItems] = useState<UniformItem[]>([]);
  const [deliveries, setDeliveries] = useState<UniformDeliveryRow[]>([]);
  const [uniformId, setUniformId] = useState("");
  const [qty, setQty] = useState(1);
  const [notes, setNotes] = useState("");
  const [deductFromStock, setDeductFromStock] = useState(true);

  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [selectedDeliveries, setSelectedDeliveries] = useState<Set<string>>(new Set());
  const [isFirstPiece, setIsFirstPiece] = useState(true);
  const [applyCredit, setApplyCredit] = useState(false);
  const [installments, setInstallments] = useState(1);

  const [pendingRemove, setPendingRemove] = useState<{ id: string; name: string; uniformItemId: string; qtyDelivered: number } | null>(null);
  const [returnToStock, setReturnToStock] = useState(true);

  const getPrice = (name: string) => {
    const lower = name.toLowerCase();
    if (lower.includes("camisa social")) return 144;
    if (lower.includes("blusão") || lower.includes("blusao")) return 208;
    if (lower.includes("jaqueta")) return 226;
    if (lower.includes("polo")) return 76;
    return 0;
  };

  const calculateTotal = () => {
    let total = 0;
    let nonJacketTotal = 0;
    
    deliveries.filter(d => selectedDeliveries.has(d.id)).forEach(d => {
      const price = getPrice(d.uniform_items?.name || "");
      const itemTotal = price * d.quantity_delivered;
      total += itemTotal;
      if (!(d.uniform_items?.name || "").toLowerCase().includes("jaqueta")) {
        nonJacketTotal += itemTotal;
      }
    });

    if (applyCredit && nonJacketTotal > 0) {
      const discount = Math.min(150, nonJacketTotal);
      total -= discount;
    }
    
    return Math.max(0, total);
  };

  const toggleDelivery = (id: string) => {
    const next = new Set(selectedDeliveries);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedDeliveries(next);
  };

  const load = useCallback(async () => {
    const supabase = createClient();
    const [i, d] = await Promise.all([
      supabase.from("uniform_items").select("*").order("name"),
      supabase.from("employee_uniforms").select("*, uniform_items(name, size)").eq("employee_id", employeeId).order("delivered_at", { ascending: false }),
    ]);
    setItems((i.data ?? []) as unknown as UniformItem[]);
    setDeliveries((d.data ?? []) as unknown as UniformDeliveryRow[]);
    if (d.data) {
       setSelectedDeliveries(prev => {
          if (prev.size === 0 && d.data.length > 0) return new Set(d.data.map(x => x.id));
          return prev;
       });
    }
  }, [employeeId]);

  useEffect(() => {
    const run = async () => { await load(); };
    run();
  }, [load]);

  const add = async () => {
    if (!uniformId || qty < 1) return;
    const supabase = createClient();
    const { error } = await supabase.from("employee_uniforms").insert({
      employee_id: employeeId,
      uniform_item_id: uniformId,
      quantity_delivered: qty,
      notes: notes || null,
    });
    
    if (!error) {
       if (deductFromStock) {
         await supabase.rpc('increment_uniform_stock', { p_id: uniformId, p_qty: -qty });
       }
       setUniformId(""); setQty(1); setNotes(""); setDeductFromStock(true);
       load();
    }
  };

  const askRemove = (id: string, name: string, uniformItemId: string, qtyDelivered: number) => {
    setReturnToStock(true);
    setPendingRemove({ id, name, uniformItemId, qtyDelivered });
  };

  const confirmRemove = async () => {
    if (!pendingRemove) return;
    const { id, uniformItemId, qtyDelivered } = pendingRemove;
    const supabase = createClient();
    const { error } = await supabase.from("employee_uniforms").delete().eq("id", id);
    if (!error) {
       if (returnToStock) {
         await supabase.rpc('increment_uniform_stock', { p_id: uniformItemId, p_qty: qtyDelivered });
       }
       load();
    }
    setPendingRemove(null);
  };

  return (
    <details className="rounded-md border p-3">
      <summary className="cursor-pointer font-medium flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Package className="w-4 h-4 text-muted-foreground" /> Uniformes Entregues ({deliveries.length})
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-7 text-xs"
          onClick={(e) => { 
            e.preventDefault(); 
            if (selectedDeliveries.size === 0) {
              alert("Selecione pelo menos um item para imprimir.");
              return;
            }
            setIsPrintModalOpen(true); 
          }}
        >
          <Printer className="w-3 h-3 mr-1" /> Imprimir Termo
        </Button>
      </summary>
      <div className="mt-3 space-y-2">
        {deliveries.map((row) => (
          <div key={row.id} className="flex items-center justify-between rounded bg-muted/40 px-3 py-2 text-sm">
            <div className="flex items-center gap-3">
              <input type="checkbox" checked={selectedDeliveries.has(row.id)} onChange={() => toggleDelivery(row.id)} className="h-4 w-4 rounded border-input" title="Incluir no termo" />
              <span>{row.quantity_delivered}x {row.uniform_items?.name} ({row.uniform_items?.size}) &middot; {new Date(row.delivered_at).toLocaleDateString()} {row.notes ? '- ' + row.notes : ''}</span>
            </div>
            <Button type="button" size="icon" variant="ghost" onClick={() => askRemove(row.id, row.uniform_items?.name || "item", row.uniform_item_id, row.quantity_delivered)} aria-label="Excluir"><Trash2 className="h-4 w-4" /></Button>
          </div>
        ))}
        <div className="grid gap-2 md:flex md:flex-wrap items-center">
          <select value={uniformId} onChange={(e) => setUniformId(e.target.value)} className="h-10 rounded-md border bg-background px-3 text-sm flex-1">
            <option value="">Selecione a peça...</option>
            {items.map(i => <option key={i.id} value={i.id}>{i.name} (Tam: {i.size}) - Estq: {i.quantity_in_stock}</option>)}
          </select>
          <Input type="number" min="1" value={qty} onChange={(e) => setQty(Number(e.target.value))} placeholder="Qtd" className="w-20" />
          <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Anotações" className="flex-1" />
          
          <div className="flex items-center gap-2 px-2">
            <input 
              type="checkbox" 
              id="deductStock" 
              checked={deductFromStock} 
              onChange={(e) => setDeductFromStock(e.target.checked)} 
              className="h-4 w-4 rounded border-input" 
            />
            <Label htmlFor="deductStock" className="text-xs font-normal cursor-pointer whitespace-nowrap">
              Abater do estoque
            </Label>
          </div>

          <Button type="button" variant="outline" onClick={add}>Adicionar</Button>
        </div>
      </div>
      <Dialog open={isPrintModalOpen} onOpenChange={setIsPrintModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Configurar Termo de Uniforme</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex items-center space-x-2">
              <input type="checkbox" id="firstPiece" checked={isFirstPiece} onChange={(e) => setIsFirstPiece(e.target.checked)} className="h-4 w-4" />
              <Label htmlFor="firstPiece">Primeira Peça / Entrega Gratuita (Termo Padrão)</Label>
            </div>

            {!isFirstPiece && (
              <div className="pl-6 space-y-4 border-l-2 border-muted mt-2">
                <div className="text-sm text-muted-foreground mb-2">Configure os valores para o termo de compra. Peças sem valor mapeado não serão cobradas.</div>
                <div className="flex items-center space-x-2">
                  <input type="checkbox" id="applyCredit" checked={applyCredit} onChange={(e) => setApplyCredit(e.target.checked)} className="h-4 w-4" />
                  <Label htmlFor="applyCredit">Aplicar crédito de R$ 150,00 (Não aplicável à Jaqueta)</Label>
                </div>
                <div>
                  <Label>Parcelas para desconto em folha:</Label>
                  <select value={installments} onChange={(e) => setInstallments(Number(e.target.value))} className="h-9 w-full rounded-md border mt-1 px-3 text-sm">
                    <option value={1}>1x</option>
                    <option value={2}>2x</option>
                    <option value={3}>3x</option>
                  </select>
                </div>
                <div className="p-3 bg-muted rounded-md text-sm">
                  <strong>Valor Total a Descontar: </strong> R$ {calculateTotal().toFixed(2).replace('.', ',')}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsPrintModalOpen(false)}>Cancelar</Button>
            <Button onClick={() => {
              const itemsParam = Array.from(selectedDeliveries).join(',');
              const type = isFirstPiece ? 'padrao' : 'compra';
              const price = calculateTotal();
              window.open(`/dashboard/colaboradores/termo-uniforme?id=${employeeId}&items=${itemsParam}&type=${type}&price=${price}&installments=${installments}`, '_blank');
              setIsPrintModalOpen(false);
            }}>Gerar Termo</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!pendingRemove} onOpenChange={(open) => !open && setPendingRemove(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Excluir registro de uniforme?</DialogTitle>
            <DialogDescription>Remover {pendingRemove?.qtyDelivered}x {pendingRemove?.name}. Esta ação não pode ser desfeita.</DialogDescription>
          </DialogHeader>
          <div className="flex items-center space-x-2">
            <input type="checkbox" id="returnStock" checked={returnToStock} onChange={(e) => setReturnToStock(e.target.checked)} className="h-4 w-4" />
            <Label htmlFor="returnStock">Devolver {pendingRemove?.qtyDelivered} item(ns) ao estoque</Label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingRemove(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={() => void confirmRemove()}>Excluir</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </details>
  );
}

function Related({ title, icon: Icon, rows, render, onRemove, children }: { title: string; icon?: React.ElementType; rows: RelatedRow[]; render: (row: RelatedRow) => string; onRemove: (id: string) => void; children: React.ReactNode }) { return <details className="rounded-md border p-3"><summary className="cursor-pointer font-medium flex items-center gap-2">{Icon && <Icon className="w-4 h-4 text-muted-foreground" />} {title} ({rows.length})</summary><div className="mt-3 space-y-2">{rows.map((row) => <div key={row.id} className="flex items-center justify-between rounded bg-muted/40 px-3 py-2 text-sm"><span>{render(row)}</span><Button type="button" size="icon" variant="ghost" onClick={() => onRemove(row.id)} aria-label="Excluir"><Trash2 className="h-4 w-4" /></Button></div>)}<div className="grid gap-2 md:flex md:flex-wrap">{children}</div></div></details>; }

export function RelatedRecords({ employeeId }: { employeeId: string }) {
  const [companyBenefits, setCompanyBenefits] = useState<CompanyBenefit[]>([]);
  const [benefits, setBenefits] = useState<RelatedRow[]>([]);
  const [epis, setEpis] = useState<RelatedRow[]>([]);
  const [vacations, setVacations] = useState<RelatedRow[]>([]);
  const [exams, setExams] = useState<RelatedRow[]>([]);
  const [promotions, setPromotions] = useState<RelatedRow[]>([]);
  
  const [epi, setEpi] = useState({ epi_name: "", ca_number: "", received_date: "" });
  const [vacation, setVacation] = useState({ start_date: "", end_date: "" });
  const [exam, setExam] = useState({ exam_type: "Admissional", exam_name: "", exam_date: "" });
  const [promotion, setPromotion] = useState({ previous_role: "", new_role: "", previous_level: "", new_level: "", promotion_date: new Date().toISOString().split('T')[0] });

  // For benefit levels selection
  const [levelSelectBenefit, setLevelSelectBenefit] = useState<{ id: string, name: string, level_values: Record<string, number> } | null>(null);
  const [selectedLevelForBenefit, setSelectedLevelForBenefit] = useState<string>("");
  const [benefitError, setBenefitError] = useState("");

  const load = useCallback(async () => {
    const supabase = createClient();
    const [cb, b, e, v, x, p] = await Promise.all([
      supabase.from("company_benefits").select("*").order("name"),
      supabase.from("employee_benefits").select("*").eq("employee_id", employeeId).order("created_at"),
      supabase.from("employee_epis").select("*").eq("employee_id", employeeId).order("created_at"),
      supabase.from("vacations").select("*").eq("employee_id", employeeId).order("start_date", { ascending: false }),
      supabase.from("occupational_exams").select("*").eq("employee_id", employeeId).order("exam_date", { ascending: false }),
      supabase.from("employee_promotions").select("*").eq("employee_id", employeeId).order("promotion_date", { ascending: false }),
    ]);
    setCompanyBenefits((cb.data ?? []) as unknown as CompanyBenefit[]);
    setBenefits((b.data ?? []) as RelatedRow[]); 
    setEpis((e.data ?? []) as RelatedRow[]); 
    setVacations((v.data ?? []) as RelatedRow[]); 
    setExams((x.data ?? []) as RelatedRow[]);
    setPromotions((p.data ?? []) as RelatedRow[]);
  }, [employeeId]);

  useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer); }, [load]);

  const add = async (table: DeleteTable, payload: Record<string, string | null>) => {
    const { error } = await createClient().from(table).insert({ employee_id: employeeId, ...payload });
    if (error) {
      if (table === "employee_benefits") setBenefitError(`Não foi possível salvar o benefício: ${error.message}`);
      return false;
    }
    if (table === "employee_benefits") setBenefitError("");
    await load();
    return true;
  };
  const [pendingDelete, setPendingDelete] = useState<{ table: DeleteTable; id: string } | null>(null);
  const remove = (table: DeleteTable, id: string) => setPendingDelete({ table, id });

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    const { table, id } = pendingDelete;
    const { error } = await createClient().from(table).delete().eq("id", id);
    if (!error) void load();
    setPendingDelete(null);
  };

  return (
    <div className="mt-8 space-y-4 border-t pt-6">
      <h3 className="font-semibold text-lg text-foreground mb-4">Registros Vinculados</h3>
      
      {levelSelectBenefit && (
        <Dialog open={!!levelSelectBenefit} onOpenChange={(open) => { if (!open) setLevelSelectBenefit(null); }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Selecionar Nível - {levelSelectBenefit.name}</DialogTitle>
              <DialogDescription>Escolha o nível para vincular o valor correto ao colaborador.</DialogDescription>
            </DialogHeader>
            <div className="py-4 space-y-3">
              <Label>Nível do Benefício</Label>
              <select 
                value={selectedLevelForBenefit} 
                onChange={(e) => setSelectedLevelForBenefit(e.target.value)} 
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              >
                <option value="">Selecione...</option>
                {Object.keys(levelSelectBenefit.level_values).map(lvl => (
                  <option key={lvl} value={lvl}>Nível {lvl} - R$ {Number(levelSelectBenefit.level_values[lvl]).toFixed(2).replace('.', ',')}</option>
                ))}
              </select>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setLevelSelectBenefit(null)}>Cancelar</Button>
              <Button type="button" disabled={!selectedLevelForBenefit} onClick={async () => {
                if (selectedLevelForBenefit && levelSelectBenefit) {
                  const val = levelSelectBenefit.level_values[selectedLevelForBenefit];
                  const saved = await add("employee_benefits", {
                    benefit_name: `${levelSelectBenefit.name} - Nível ${selectedLevelForBenefit}`,
                    value: String(val)
                  });
                  if (saved) setLevelSelectBenefit(null);
                }
              }}>Confirmar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
      
      <details className="rounded-md border p-3" open>
        <summary className="cursor-pointer font-medium select-none">Benefícios ({benefits.length})</summary>
        {benefitError && <p role="alert" className="mt-3 rounded border border-destructive/30 bg-destructive/10 p-2 text-sm text-destructive">{benefitError}</p>}
        <div className="mt-4 grid grid-cols-2 md:grid-cols-3 gap-3">
          {companyBenefits.map(b => {
            const hasBenefit = benefits.find(eb => matchesEmployeeBenefit(eb.benefit_name, b.name));
            const benefitLevel = hasBenefit ? getEmployeeBenefitLevelLabel(hasBenefit.benefit_name, b.name) : null;
            return (
              <div key={b.id} className="flex flex-col gap-1">
                <Label className="flex items-center gap-2 cursor-pointer rounded border p-2 hover:bg-muted/50 transition-colors">
                  <input 
                    type="checkbox" 
                    checked={!!hasBenefit} 
                    onChange={(e) => {
                      if (e.target.checked) {
                        if (b.level_values && Object.keys(b.level_values).length > 0) {
                          setSelectedLevelForBenefit("");
                          setLevelSelectBenefit({ id: b.id, name: b.name, level_values: b.level_values });
                        } else {
                          add("employee_benefits", { benefit_name: b.name });
                        }
                      }
                      else if (hasBenefit) remove("employee_benefits", hasBenefit.id);
                    }}
                    className="w-4 h-4 text-primary"
                  /> 
                  {b.name}
                </Label>
                {benefitLevel && (
                  <span className="text-[10px] text-muted-foreground ml-7 bg-muted px-2 py-0.5 rounded-full w-fit">
                    {benefitLevel}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </details>
      
      <Related title="Histórico de Promoções" icon={TrendingUp} rows={promotions} render={(row) => `${new Date(row.promotion_date + "T12:00:00").toLocaleDateString('pt-BR')}: ${row.previous_role || '-'} (${row.previous_level || '-'}) ➔ ${row.new_role || '-'} (${row.new_level || '-'})`} onRemove={(id) => remove("employee_promotions", id)}>
        <Input value={promotion.previous_role} onChange={(e) => setPromotion({ ...promotion, previous_role: e.target.value })} placeholder="Cargo anterior" />
        <Input value={promotion.new_role} onChange={(e) => setPromotion({ ...promotion, new_role: e.target.value })} placeholder="Novo cargo" />
        <Input value={promotion.previous_level} onChange={(e) => setPromotion({ ...promotion, previous_level: e.target.value })} placeholder="Nível anterior" />
        <Input value={promotion.new_level} onChange={(e) => setPromotion({ ...promotion, new_level: e.target.value })} placeholder="Novo nível" />
        <Input type="date" value={promotion.promotion_date} onChange={(e) => setPromotion({ ...promotion, promotion_date: e.target.value })} />
        <Button type="button" variant="outline" onClick={() => { if (promotion.new_role && promotion.promotion_date) { void add("employee_promotions", promotion); setPromotion({ previous_role: "", new_role: "", previous_level: "", new_level: "", promotion_date: new Date().toISOString().split('T')[0] }); } }}>Adicionar</Button>
      </Related>

      <Related title="EPIs" rows={epis} render={(row) => `${row.epi_name} · CA ${row.ca_number || "-"} · ${row.received_date || "sem data"}`} onRemove={(id) => remove("employee_epis", id)}>
        <Input value={epi.epi_name} onChange={(e) => setEpi({ ...epi, epi_name: e.target.value })} placeholder="EPI" /><Input value={epi.ca_number} onChange={(e) => setEpi({ ...epi, ca_number: e.target.value })} placeholder="Número CA" /><Input type="date" value={epi.received_date} onChange={(e) => setEpi({ ...epi, received_date: e.target.value })} /><Button type="button" variant="outline" onClick={() => { if (epi.epi_name) { void add("employee_epis", { ...epi, received_date: epi.received_date || null, status: "Ativo" }); setEpi({ epi_name: "", ca_number: "", received_date: "" }); } }}>Adicionar</Button>
      </Related>
      
      <EmployeeUniforms employeeId={employeeId} />
      <EmployeePersonality employeeId={employeeId} />
      
      <Related title="Férias" rows={vacations} render={(row) => `${row.start_date} até ${row.end_date} · ${row.status || "Programada"}`} onRemove={(id) => remove("vacations", id)}>
        <Input type="date" value={vacation.start_date} onChange={(e) => setVacation({ ...vacation, start_date: e.target.value })} /><Input type="date" value={vacation.end_date} onChange={(e) => setVacation({ ...vacation, end_date: e.target.value })} /><Button type="button" variant="outline" onClick={() => { if (vacation.start_date && vacation.end_date) { void add("vacations", { ...vacation, status: "Programada" }); setVacation({ start_date: "", end_date: "" }); } }}>Adicionar</Button>
      </Related>
      
      <Related title="Exames ocupacionais" rows={exams} render={(row) => `${row.exam_type} · ${row.exam_name} · ${row.exam_date}`} onRemove={(id) => remove("occupational_exams", id)}>
        <Select value={exam.exam_type} onChange={(value) => setExam({ ...exam, exam_type: value })} options={["Admissional", "Periódico", "Retorno", "Mudança de risco", "Demissional"]} /><Input value={exam.exam_name} onChange={(e) => setExam({ ...exam, exam_name: e.target.value })} placeholder="Exame" /><Input type="date" value={exam.exam_date} onChange={(e) => setExam({ ...exam, exam_date: e.target.value })} /><Button type="button" variant="outline" onClick={() => { if (exam.exam_name && exam.exam_date) { void add("occupational_exams", { ...exam, status: "Realizado", result: "Pendente" }); setExam({ exam_type: "Admissional", exam_name: "", exam_date: "" }); } }}>Adicionar</Button>
      </Related>

      <Dialog open={!!pendingDelete} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Excluir registro?</DialogTitle>
            <DialogDescription>Esta ação não pode ser desfeita. O registro será removido permanentemente.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingDelete(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={() => void confirmDelete()}>Excluir</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
