"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import { Plus, Search, Pencil, Trash2, FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
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

  const handleSave = async () => {
    if (!editingRow.role_name || editingRow.salary === undefined) return;
    
    if (editingRow.id) {
      // Update
      await supabase.from("salary_table").update({
        role_code: editingRow.role_code,
        role_name: editingRow.role_name,
        level: editingRow.level,
        modality: editingRow.modality,
        salary: editingRow.salary,
        updated_at: new Date().toISOString()
      }).eq("id", editingRow.id);
    } else {
      // Insert
      await supabase.from("salary_table").insert({
        role_code: editingRow.role_code,
        role_name: editingRow.role_name,
        level: editingRow.level,
        modality: editingRow.modality,
        salary: editingRow.salary
      });
    }
    
    setIsModalOpen(false);
    fetchData();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir esta faixa salarial?")) return;
    await supabase.from("salary_table").delete().eq("id", id);
    fetchData();
  };

  const filteredData = data.filter(r => 
    r.role_name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (r.role_code && r.role_code.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Tabela Salarial</h1>
          <p className="text-muted-foreground text-sm">
            Gerencie os cargos, níveis e salários base para preenchimento automático das MPs.
          </p>
        </div>
        <Button onClick={() => {
          setEditingRow({ role_code: "", role_name: "", level: "Júnior", modality: "CLT", salary: 0 });
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
              <tr className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
                <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Código</th>
                <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Cargo</th>
                <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Nível</th>
                <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Modalidade</th>
                <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Salário</th>
                <th className="h-12 px-4 text-right align-middle font-medium text-muted-foreground">Ações</th>
              </tr>
            </thead>
            <tbody className="[&_tr:last-child]:border-0">
              {loading ? (
                <tr><td colSpan={6} className="p-4 text-center text-muted-foreground">Carregando...</td></tr>
              ) : filteredData.length === 0 ? (
                <tr><td colSpan={6} className="p-4 text-center text-muted-foreground">Nenhuma faixa salarial encontrada.</td></tr>
              ) : (
                filteredData.map((row) => (
                  <tr key={row.id} className="border-b transition-colors hover:bg-muted/50">
                    <td className="p-4 font-mono text-xs">{row.role_code || "-"}</td>
                    <td className="p-4 font-medium">{row.role_name}</td>
                    <td className="p-4">{row.level}</td>
                    <td className="p-4">{row.modality}</td>
                    <td className="p-4">{formatCurrency(row.salary)}</td>
                    <td className="p-4 text-right">
                      <Button variant="ghost" size="sm" onClick={() => { setEditingRow(row); setIsModalOpen(true); }}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-600" onClick={() => handleDelete(row.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingRow.id ? "Editar Faixa Salarial" : "Nova Faixa Salarial"}>
        <div className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Código do Cargo</Label>
              <Input 
                placeholder="Ex: ENG-01" 
                value={editingRow.role_code || ""} 
                onChange={(e) => setEditingRow({ ...editingRow, role_code: e.target.value })} 
              />
            </div>
            <div className="space-y-2">
              <Label>Nome do Cargo *</Label>
              <Input 
                placeholder="Ex: Engenheiro Civil" 
                value={editingRow.role_name || ""} 
                onChange={(e) => setEditingRow({ ...editingRow, role_name: e.target.value })} 
              />
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Nível</Label>
              <select 
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                value={editingRow.level || "Júnior"}
                onChange={(e) => setEditingRow({ ...editingRow, level: e.target.value })}
              >
                <option value="Trainee">Trainee</option>
                <option value="Júnior">Júnior</option>
                <option value="Pleno">Pleno</option>
                <option value="Sênior">Sênior</option>
                <option value="Especialista">Especialista</option>
                <option value="Coordenador">Coordenador</option>
                <option value="Gerente">Gerente</option>
                <option value="Diretor">Diretor</option>
                <option value="Único">Único</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label>Modalidade</Label>
              <select 
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                value={editingRow.modality || "CLT"}
                onChange={(e) => setEditingRow({ ...editingRow, modality: e.target.value })}
              >
                <option value="CLT">CLT</option>
                <option value="PJ">PJ</option>
                <option value="Estágio">Estágio</option>
                <option value="Autônomo">Autônomo</option>
              </select>
            </div>
          </div>
          
          <div className="space-y-2">
            <Label>Salário Base (R$) *</Label>
            <Input 
              type="number" 
              step="0.01" 
              value={editingRow.salary || 0} 
              onChange={(e) => setEditingRow({ ...editingRow, salary: Number(e.target.value) })} 
            />
          </div>
          
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => setIsModalOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={!editingRow.role_name || editingRow.salary === undefined}>Salvar</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
