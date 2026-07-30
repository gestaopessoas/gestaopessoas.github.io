"use client";

import { useState, useEffect, useMemo } from "react";
import { createClient } from "@/utils/supabase/client";
import { Plus, Search, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatCurrency } from "@/lib/utils";

type SalaryRow = {
  id: string;
  role_code: string;
  role_name: string;
  level: string;
  modality: string;
  salary: number;
};

export default function SalaryTablePage() {
  const [data, setData] = useState<SalaryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<string>("");
  const [roleVariants, setRoleVariants] = useState<SalaryRow[]>([]);
  const [editingRow, setEditingRow] = useState<Partial<SalaryRow>>({
    role_code: "",
    role_name: "",
    level: "Júnior",
    modality: "CLT",
    salary: 0
  });

  const supabase = createClient();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    const { data: rows, error } = await supabase
      .from("salary_table")
      .select("*")
      .order("role_name", { ascending: true });
    
    if (!error && rows) {
      setData(rows as SalaryRow[]);
    }
    setLoading(false);
  };

  const uniqueRoles = useMemo(() => {
    const roles = Array.from(new Set(data.map(r => r.role_name)));
    return roles.map(name => ({
      name,
      code: data.find(r => r.role_name === name)?.role_code || "-"
    })).filter(r => 
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
    if (!editingRow.role_name || editingRow.salary === undefined) return;
    
    const supabase = createClient();
    
    if (editingRow.id) {
      // Update existing variant
      const { error } = await supabase.from("salary_table").update({
        role_code: editingRow.role_code,
        role_name: editingRow.role_name,
        level: editingRow.level,
        modality: editingRow.modality,
        salary: editingRow.salary,
        updated_at: new Date().toISOString()
      }).eq("id", editingRow.id);

      if (!error) {
        fetchData();
        if (editingRole) {
          loadRoleVariants(editingRole);
        }
      }
    } else {
      // Insert new variant - only if role exists, otherwise create it
      const { data: existingRoles } = await supabase
        .from("salary_table")
        .select("role_name")
        .eq("role_name", editingRow.role_name)
        .maybeSingle();

      if (existingRoles) {
        // Role exists, add variant
        await supabase.from("salary_table").insert({
          role_code: editingRow.role_code,
          role_name: editingRow.role_name,
          level: editingRow.level,
          modality: editingRow.modality,
          salary: editingRow.salary
        });
        fetchData();
        if (editingRole) {
          loadRoleVariants(editingRole);
        }
      } else {
        // Create new role with variant
        await supabase.from("salary_table").insert({
          role_code: editingRow.role_code,
          role_name: editingRow.role_name,
          level: editingRow.level,
          modality: editingRow.modality,
          salary: editingRow.salary
        });
        fetchData();
        if (editingRole) {
          loadRoleVariants(editingRole);
        }
      }
    }
    
    // Reset form
    setEditingRow({ 
      role_code: "", 
      role_name: "", 
      level: "Júnior", 
      modality: "CLT", 
      salary: 0
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
    await supabase.from("salary_table").delete().eq("id", id);
    fetchData();
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
            Gerencie os cargos e seus níveis/modalidades.
          </p>
        </div>
        <Button onClick={() => {
          setEditingRow({ role_code: "", role_name: "", level: "Júnior", modality: "CLT", salary: 0 });
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
                <th className="h-12 px-4 text-right align-middle font-medium text-muted-foreground">Ações</th>
              </tr>
            </thead>
            <tbody className="[&_tr:last-child]:border-0">
              {loading ? (
                <tr><td colSpan={3} className="p-4 text-center text-muted-foreground">Carregando...</td></tr>
              ) : uniqueRoles.length === 0 ? (
                <tr><td colSpan={3} className="p-4 text-center text-muted-foreground">Nenhum cargo encontrado.</td></tr>
              ) : (
                uniqueRoles.map((role) => (
                  <tr key={role.name} className="border-b transition-colors hover:bg-muted/50">
                    <td className="p-4 font-mono text-xs">{role.code}</td>
                    <td className="p-4 font-medium">{role.name}</td>
                    <td className="p-4 text-right">
                      <Button variant="outline" size="sm" onClick={() => loadRoleVariants(role.name)}>
                        Gerenciar Níveis
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
            <div className="space-y-4">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2">Nível</th>
                    <th className="text-left py-2">Modality</th>
                    <th className="text-left py-2">Salário</th>
                    <th className="text-right py-2">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {roleVariants.map(v => (
                    <tr key={v.id} className="border-b">
                      <td className="py-2">{v.level}</td>
                      <td className="py-2">{v.modality}</td>
                      <td className="py-2">{formatCurrency(v.salary)}</td>
                      <td className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => { setEditingRow(v); setEditingRole(""); }}>Editar</Button>
                        <Button variant="ghost" size="sm" className="text-red-500" onClick={() => handleDelete(v.id)}><Trash2 className="h-4 w-4"/></Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <Button onClick={() => setEditingRow({ role_name: editingRole, level: "Júnior", modality: "CLT", salary: 0, role_code: roleVariants[0].role_code })}>Adicionar Nível</Button>
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
                  <Label>Nível</Label>
                  <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={editingRow.level || "Júnior"} onChange={(e) => setEditingRow({ ...editingRow, level: e.target.value })}>
                    <option value="Júnior">Júnior</option>
                    <option value="Pleno">Pleno</option>
                    <option value="Sênior">Sênior</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Modalidade</Label>
                  <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={editingRow.modality || "CLT"} onChange={(e) => setEditingRow({ ...editingRow, modality: e.target.value })}>
                    <option value="CLT">CLT</option>
                    <option value="PJ">PJ</option>
                  </select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Salário Base (R$) *</Label>
                <Input type="number" value={editingRow.salary || 0} onChange={(e) => setEditingRow({ ...editingRow, salary: Number(e.target.value) })} />
              </div>
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
