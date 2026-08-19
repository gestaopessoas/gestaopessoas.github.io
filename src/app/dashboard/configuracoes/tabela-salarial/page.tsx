"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { createClient } from "@/utils/supabase/client";
import { Plus, Search, Trash2, Edit3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatCurrency } from "@/lib/utils";
import { formatCurrencyInput, maskCurrencyInput, parseCurrencyInput } from "../../colaboradores/lib/employeeFormRules.mjs";
import { summarizeSalaryRoles, STANDARD_LEVELS, groupByRegimeAndLevel } from "./lib/salaryTableViewRules.mjs";

type SalaryRow = {
  id: string;
  role_code: string;
  role_name: string;
  level: string | null;
  modality: string;
  salary: number | null;
  uses_level: boolean;
  salary_experience: number | null;
  salary_after_probation: number | null;
};

type SalaryRoleSummary = {
  name: string;
  code: string;
  usesLevel: boolean;
  structureLabel: "Com nível" | "Sem nível";
  actionLabel: "Gerenciar níveis" | "Gerenciar salários";
  salariesByModality: Partial<Record<"CLT" | "PJ", {
    experience: number | null;
    afterProbation: number | null;
  }>>;
};

const modalities = ["CLT", "PJ"] as const;

function formatOptionalCurrency(value: number | null | undefined) {
  return value == null ? "—" : formatCurrency(value);
}

export default function SalaryTablePage() {
  const [data, setData] = useState<SalaryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [saveError, setSaveError] = useState("");
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<string>("");
  const [roleVariants, setRoleVariants] = useState<SalaryRow[]>([]);
  const [editingRow, setEditingRow] = useState<Partial<SalaryRow>>({
    role_code: "",
    role_name: "",
    level: "Júnior",
    modality: "CLT",
    salary: 0, uses_level: true, salary_experience: null, salary_after_probation: null
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    const { data: rows, error } = await createClient()
      .from("salary_table")
      .select("*")
      .order("role_name", { ascending: true });
    
    if (!error && rows) {
      setData(rows as SalaryRow[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void fetchData(), 0);
    return () => window.clearTimeout(timer);
  }, [fetchData]);

  const uniqueRoles = useMemo(() => {
    const roles = summarizeSalaryRoles(data) as SalaryRoleSummary[];
    return roles.filter(r =>
      r.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      (r.code && r.code.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  }, [data, searchTerm]);

  const loadRoleVariants = (roleName: string) => {
    const variants = data.filter(r => r.role_name === roleName);
    setRoleVariants(variants);
    setEditingRole(roleName);
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!editingRow.role_name || (editingRow.uses_level !== false && editingRow.salary === undefined) || (editingRow.uses_level === false && (editingRow.salary_experience == null || editingRow.salary_after_probation == null))) {
      setSaveError("Preencha todos os campos salariais obrigatórios.");
      return;
    }
    const supabase = createClient();
    const payload = {
      role_code: editingRow.role_code,
      role_name: editingRow.role_name,
      level: editingRow.uses_level === false ? null : editingRow.level,
      modality: editingRow.modality,
      salary: editingRow.uses_level === false ? null : editingRow.salary,
      uses_level: editingRow.uses_level !== false,
      salary_experience: editingRow.uses_level === false ? editingRow.salary_experience : null,
      salary_after_probation: editingRow.uses_level === false ? editingRow.salary_after_probation : null,
      updated_at: new Date().toISOString(),
    };
    const { error } = editingRow.id
      ? await supabase.from("salary_table").update(payload).eq("id", editingRow.id)
      : await supabase.from("salary_table").insert(payload);
    if (error) {
      setSaveError(`Não foi possível salvar a faixa salarial: ${error.message}`);
      return;
    }
    setSaveError("");
    await fetchData();
    // Reset form
    setEditingRow({ 
      role_code: "", 
      role_name: "", 
      level: "Júnior", 
      modality: "CLT", 
      salary: 0, uses_level: true, salary_experience: null, salary_after_probation: null
    });
    if (editingRole) {
      setIsModalOpen(true);
    } else {
      setIsModalOpen(false);
      setEditingRole("");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir esta faixa salarial?")) return;
    await createClient().from("salary_table").delete().eq("id", id);
    void fetchData();
    if (editingRole) {
      loadRoleVariants(editingRole);
    } else {
      setIsModalOpen(false);
    }
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Tabela Salarial</h1>
          <p className="text-muted-foreground text-sm">
            Consulte cargos com nível e salários de experiência ou pós-90 dias.
          </p>
        </div>
        <Button onClick={() => {
          setEditingRow({ role_code: "", role_name: "", level: "Júnior", modality: "CLT", salary: 0, uses_level: true, salary_experience: null, salary_after_probation: null });
          setSaveError("");
          setEditingRole("");
          setIsModalOpen(true);
        }}>
          <Plus className="mr-2 h-4 w-4" /> Nova Faixa Salarial
        </Button>
      </div>

      <div className="flex items-center w-full max-w-md space-x-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Buscar cargo ou código..." 
            className="pl-8" 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="rounded-md border bg-card">
        <div className="relative w-full overflow-auto">
          <table className="w-full caption-bottom text-sm">
            <thead className="[&_tr]:border-b">
              <tr className="border-b transition-colors hover:bg-muted/50">
                <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Código</th>
                <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Cargo</th>
                <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Estrutura</th>
                <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Experiência</th>
                <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Pós-90 dias</th>
                <th className="h-12 px-4 text-right align-middle font-medium text-muted-foreground">Ações</th>
              </tr>
            </thead>
            <tbody className="[&_tr:last-child]:border-0">
              {loading ? (
                <tr><td colSpan={6} className="p-4 text-center text-muted-foreground">Carregando...</td></tr>
              ) : uniqueRoles.length === 0 ? (
                <tr><td colSpan={6} className="p-4 text-center text-muted-foreground">Nenhum cargo encontrado.</td></tr>
              ) : (
                uniqueRoles.map((role) => (
                  <tr key={role.name} className="border-b transition-colors hover:bg-muted/50">
                    <td className="p-4 font-mono text-xs">{role.code}</td>
                    <td className="p-4 font-medium">{role.name}</td>
                    <td className="p-4">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${role.usesLevel ? "bg-muted text-muted-foreground" : "bg-primary/10 text-primary"}`}>
                        {role.structureLabel}
                      </span>
                    </td>
                    <td className="p-4 text-xs">
                      {role.usesLevel ? (
                        <span className="text-muted-foreground">Por nível</span>
                      ) : (
                        <div className="space-y-1">
                          {modalities.map(modality => (
                            <div key={modality} className="flex min-w-32 justify-between gap-3">
                              <span className="font-medium text-muted-foreground">{modality}</span>
                              <span>{formatOptionalCurrency(role.salariesByModality[modality]?.experience)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="p-4 text-xs">
                      {role.usesLevel ? (
                        <span className="text-muted-foreground">Por nível</span>
                      ) : (
                        <div className="space-y-1">
                          {modalities.map(modality => (
                            <div key={modality} className="flex min-w-32 justify-between gap-3">
                              <span className="font-medium text-muted-foreground">{modality}</span>
                              <span>{formatOptionalCurrency(role.salariesByModality[modality]?.afterProbation)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="p-4 text-right">
                      <Button variant="outline" size="sm" onClick={() => loadRoleVariants(role.name)}>
                        {role.actionLabel}
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingRole ? `Níveis: ${editingRole}` : "Nova Faixa Salarial"}</DialogTitle>
          </DialogHeader>
          {editingRole ? (
            <div className="space-y-6">
              {(() => {
                const grouped = groupByRegimeAndLevel(roleVariants) as Record<string, Record<string, SalaryRow>>;
                return ["CLT", "PJ"].map((modality) => {
                  const levels = grouped[modality];
                  if (!levels) return null;
                  return (
                    <div key={modality} className="space-y-2">
                      <h3 className="font-medium text-center border-b pb-2">{modality}</h3>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm text-center">
                          <thead>
                            <tr>
                              {STANDARD_LEVELS.map(lvl => <th key={lvl} className="py-2 border-b">{lvl}</th>)}
                            </tr>
                          </thead>
                          <tbody>
                            <tr>
                              {STANDARD_LEVELS.map(lvl => {
                                const row = levels[lvl];
                                return (
                                  <td key={lvl} className="py-2">
                                    {row ? (
                                      <div className="flex flex-col items-center gap-1">
                                        <span>{formatCurrency(row.salary || 0)}</span>
                                        <div className="flex gap-1">
                                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => { setEditingRow(row); setEditingRole(""); }}><Edit3 className="h-3 w-3"/></Button>
                                          <Button variant="ghost" size="icon" className="h-6 w-6 text-red-500" onClick={() => handleDelete(row.id)}><Trash2 className="h-3 w-3"/></Button>
                                        </div>
                                      </div>
                                    ) : (
                                      <span className="text-muted-foreground">—</span>
                                    )}
                                  </td>
                                );
                              })}
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                });
              })()}
              <Button onClick={() => setEditingRow({ role_name: editingRole, level: "Júnior", modality: "CLT", salary: 0, role_code: roleVariants[0]?.role_code || "", uses_level: true, salary_experience: null, salary_after_probation: null })}>Adicionar faixa</Button>
            </div>
          ) : (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Código do Cargo</Label>
                  <Input value={editingRow.role_code || ""} onChange={(e) => setEditingRow({ ...editingRow, role_code: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Nome do Cargo *</Label>
                  <Input value={editingRow.role_name || ""} onChange={(e) => setEditingRow({ ...editingRow, role_name: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Estrutura do cargo</Label>
                  <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={editingRow.uses_level === false ? "sem-nivel" : "com-nivel"} onChange={(e) => setEditingRow({ ...editingRow, uses_level: e.target.value === "com-nivel" })}>
                    <option value="com-nivel">Com nível</option>
                    <option value="sem-nivel">Sem nível</option>
                  </select>
                </div>
                {editingRow.uses_level !== false &&
                <div className="space-y-2">
                  <Label>Nível</Label>
                  <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={editingRow.level || "Júnior"} onChange={(e) => setEditingRow({ ...editingRow, level: e.target.value })}>
                    <option value="PISO">PISO</option>
                    <option value="Júnior">Júnior</option>
                    <option value="Pleno">Pleno</option>
                    <option value="Sênior">Sênior</option>
                  </select>
                </div>
                }
                <div className="space-y-2">
                  <Label>Modalidade</Label>
                  <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={editingRow.modality || "CLT"} onChange={(e) => setEditingRow({ ...editingRow, modality: e.target.value })}>
                    <option value="CLT">CLT</option>
                    <option value="PJ">PJ</option>
                  </select>
                </div>
              </div>
              {editingRow.uses_level !== false ? <div className="space-y-2">
                <Label>Salário Base (R$) *</Label>
                <Input inputMode="numeric" value={formatCurrencyInput(editingRow.salary || 0)} onChange={(e) => setEditingRow({ ...editingRow, salary: parseCurrencyInput(maskCurrencyInput(e.target.value)) })} />
              </div> : <div className="grid grid-cols-2 gap-4"><div className="space-y-2"><Label>Salário experiência (R$) *</Label><Input inputMode="numeric" value={editingRow.salary_experience == null ? "" : formatCurrencyInput(editingRow.salary_experience)} onChange={(e) => setEditingRow({ ...editingRow, salary_experience: parseCurrencyInput(maskCurrencyInput(e.target.value)) })} /></div><div className="space-y-2"><Label>Salário após 90 dias (R$) *</Label><Input inputMode="numeric" value={editingRow.salary_after_probation == null ? "" : formatCurrencyInput(editingRow.salary_after_probation)} onChange={(e) => setEditingRow({ ...editingRow, salary_after_probation: parseCurrencyInput(maskCurrencyInput(e.target.value)) })} /></div></div>}
              {saveError && <p role="alert" className="rounded border border-destructive/30 bg-destructive/10 p-2 text-sm text-destructive">{saveError}</p>}
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsModalOpen(false)}>Cancelar</Button>
                <Button onClick={handleSave}>Salvar</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
