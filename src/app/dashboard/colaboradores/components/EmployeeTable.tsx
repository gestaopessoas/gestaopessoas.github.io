"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import type { Employee } from "./types";

/** Mostra apenas os 3 últimos dígitos do CPF; o valor completo fica no registro do colaborador. */
export const maskCpfForList = (cpf: unknown) => {
  const digits = String(cpf ?? "").replace(/\D/g, "");
  if (digits.length !== 11) return String(cpf ?? "-") || "-";
  return `***.***.${digits.slice(6, 9)}-**`;
};

export function DocumentsCell({ employee }: { employee: Employee }) {
  return (
    <td className="p-3">
      <div title="CPF parcialmente oculto — abra o registro para ver completo">CPF: {maskCpfForList(employee.cpf)}</div>
      <div className="text-xs text-muted-foreground">RG: {String(employee.rg ?? "-")}</div>
    </td>
  );
}

export function SearchBar({ value, onChange, children }: { value: string; onChange: (value: string) => void; children?: React.ReactNode }) {
  return (
    <div className="relative mb-4 flex max-w-md items-center gap-2">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
        <Input value={value} onChange={(event) => onChange(event.target.value)} placeholder="Buscar por nome, CPF, RG ou cargo" className="pl-9" />
      </div>
      {children}
    </div>
  );
}

export function EmployeeTable({ employees, loading, emptyMessage, renderRow }: {
  employees: Employee[];
  loading: boolean;
  emptyMessage: string;
  renderRow: (employee: Employee) => React.ReactNode;
}) {
  return (
    <div className="overflow-x-auto rounded-lg border bg-card">
      <table className="w-full text-sm">
        <thead className="border-b bg-muted/40 text-left">
          <tr>
            <th className="p-3">Colaborador</th>
            <th className="p-3">Documentos</th>
            <th className="p-3">Cargo e lotação</th>
            <th className="p-3">Status</th>
            <th className="p-3 text-right">Ações</th>
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">Carregando...</td></tr>
          ) : employees.length === 0 ? (
            <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">{emptyMessage}</td></tr>
          ) : (
            employees.map(renderRow)
          )}
        </tbody>
      </table>
    </div>
  );
}

export function Pagination({ page, total, pageSize, onPageChange, onPageSizeChange }: {
  page: number;
  total: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
}) {
  const lastPage = Math.max(1, Math.ceil(total / pageSize));
  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-4 text-sm text-muted-foreground">
      <div className="flex items-center gap-4">
        <span>Página {page + 1} de {lastPage}</span>
        {onPageSizeChange && (
          <div className="flex items-center gap-2">
            <label htmlFor="pageSize">Mostrar:</label>
            <select
              id="pageSize"
              className="h-8 rounded-md border border-input bg-background px-2 py-1 text-sm shadow-sm"
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>
        )}
      </div>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" disabled={page === 0} onClick={() => onPageChange(page - 1)}>Anterior</Button>
        <Button variant="outline" size="sm" disabled={(page + 1) * pageSize >= total} onClick={() => onPageChange(page + 1)}>Próxima</Button>
      </div>
    </div>
  );
}
