"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { X, Filter } from "lucide-react";
import { Entity } from "./types";

export interface AdvancedFilters {
  gender: string;
  marital_status: string;
  department_id: string;
  role: string;
  unit: string;
  status: string;
  admission_start: string;
  admission_end: string;
}

interface FilterModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  departments: Entity[];
  advancedFilters: AdvancedFilters;
  setAdvancedFilters: React.Dispatch<React.SetStateAction<AdvancedFilters>>;
  page: number;
  setPage: (page: number) => void;
}

export function FilterModal({
  open,
  onOpenChange,
  departments,
  advancedFilters,
  setAdvancedFilters,
  page,
  setPage,
}: FilterModalProps) {
  const handleClear = () => {
    setAdvancedFilters({
      gender: "",
      marital_status: "",
      department_id: "",
      role: "",
      unit: "",
      status: "",
      admission_start: "",
      admission_end: "",
    });
    setPage(0);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="flex items-start justify-between">
          <div>
            <DialogTitle className="flex items-center gap-2">
              <Filter className="w-5 h-5" />
              Filtros Avancados
            </DialogTitle>
            <DialogDescription>
              Combine multiplos filtros para refinar a busca
            </DialogDescription>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onOpenChange(false)}
            className="h-8 w-8"
          >
            <X className="w-4 h-4" />
          </Button>
        </DialogHeader>

        <div className="p-4 overflow-y-auto space-y-4 flex-1">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Departamento</Label>
              <select
                value={advancedFilters.department_id}
                onChange={(e) =>
                  setAdvancedFilters((prev) => ({ ...prev, department_id: e.target.value }))
                }
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              >
                <option value="">Todos</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Situacao</Label>
              <select
                value={advancedFilters.status}
                onChange={(e) =>
                  setAdvancedFilters((prev) => ({ ...prev, status: e.target.value }))
                }
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              >
                <option value="">Todos (Exceto Desligados)</option>
                <option value="Ativo">Ativo</option>
                <option value="Ferias">Ferias</option>
                <option value="Afastado">Afastado</option>
                <option value="Inativo">Inativo</option>
                <option value="Desligado">Desligado</option>
                <option value="Arquivo Morto">Arquivo Morto</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Genero</Label>
              <select
                value={advancedFilters.gender}
                onChange={(e) =>
                  setAdvancedFilters((prev) => ({ ...prev, gender: e.target.value }))
                }
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              >
                <option value="">Todos</option>
                <option value="Masculino">Masculino</option>
                <option value="Feminino">Feminino</option>
                <option value="Outro">Outro</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Estado Civil</Label>
              <select
                value={advancedFilters.marital_status}
                onChange={(e) =>
                  setAdvancedFilters((prev) => ({ ...prev, marital_status: e.target.value }))
                }
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              >
                <option value="">Todos</option>
                <option value="Solteiro(a)">Solteiro(a)</option>
                <option value="Casado(a)">Casado(a)</option>
                <option value="Divorciado(a)">Divorciado(a)</option>
                <option value="Viuvo(a)">Viuvo(a)</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Cargo (Contem)</Label>
              <Input
                value={advancedFilters.role}
                onChange={(e) =>
                  setAdvancedFilters((prev) => ({ ...prev, role: e.target.value }))
                }
                placeholder="Ex: Engenheiro"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Unidade / Obra (Contem)</Label>
              <Input
                value={advancedFilters.unit}
                onChange={(e) =>
                  setAdvancedFilters((prev) => ({ ...prev, unit: e.target.value }))
                }
                placeholder="Ex: Matriz"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Data de Admissao (Inicio)</Label>
              <Input
                type="date"
                value={advancedFilters.admission_start}
                onChange={(e) =>
                  setAdvancedFilters((prev) => ({ ...prev, admission_start: e.target.value }))
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label>Data de Admissao (Fim)</Label>
              <Input
                type="date"
                value={advancedFilters.admission_end}
                onChange={(e) =>
                  setAdvancedFilters((prev) => ({ ...prev, admission_end: e.target.value }))
                }
              />
            </div>
          </div>
        </div>
        <DialogFooter className="border-t">
          <Button variant="ghost" onClick={handleClear}>
            Limpar Filtros
          </Button>
          <div className="flex gap-2 ml-auto">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button onClick={() => { setPage(0); onOpenChange(false); }}>
              Aplicar Filtros
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
