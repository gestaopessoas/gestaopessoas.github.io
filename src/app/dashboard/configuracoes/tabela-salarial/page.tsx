"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { Field } from "@/components/ui/field";
import { createClient } from "@/utils/supabase/client";
import { Plus, Search, Trash2, Edit3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatCurrency } from "@/lib/utils";
import { formatCurrencyInput, maskCurrencyInput, parseCurrencyInput } from "../../colaboradores/lib/employeeFormRules.mjs";
import { summarizeSalaryRoles, groupByRegimeAndLevel, levelsInUse, STANDARD_LEVELS, NO_SENIORITY_KEY } from "./lib/salaryTableViewRules.mjs";
import { buscarTudo } from "@/lib/paginacao";

const SENIORITY_LEVELS = ["Júnior", "Pleno", "Sênior"];

// A coluna `seniority` nem sempre guarda Júnior/Pleno/Sênior: no ESTAGIÁRIO ela guarda a
// escolaridade (Ensino Médio / Técnico / Superior), que é a dimensão que cruza com os
// níveis. Sem juntar o que o cargo já usa, editar uma linha dessas apagaria o valor —
// o <select> não teria a opção e cairia em "Sem senioridade".
function senioridadesDoCargo(variantes: SalaryRow[]) {
  const usadas = variantes.map((v) => (v.seniority ?? "").trim()).filter(Boolean);
  return [...new Set([...SENIORITY_LEVELS, ...usadas])];
}

type SalaryRow = {
  id: string;
  role_code: string;
  role_name: string;
  level: string | null;
  seniority: string | null;
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
  // Vem de `diagnosticarCargo`: quanto o cargo paga e o que ha de errado na faixa.
  linhas: number;
  faixa: { min: number; max: number } | null;
  conflitos: number;
  duplicadas: number;
};

// Uma linha da tela = um cargo, tenha faixa ou nao. `semFaixa` distingue os dois.
type LinhaDaTela = Omit<SalaryRoleSummary, "structureLabel" | "actionLabel"> & {
  semFaixa: boolean;
  structureLabel: string;
  actionLabel: string;
};

export default function SalaryTablePage() {
  const [data, setData] = useState<SalaryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [saveError, setSaveError] = useState("");
  // Quanta gente está em cada cargo e quais cargos existem no cadastro. Sem isso a tela
  // mostrava só as faixas que existem — e um cargo SEM faixa simplesmente não aparecia,
  // que é justamente o caso que precisa de atenção (118 cargos, 104 pessoas).
  const [pessoasPorCargo, setPessoasPorCargo] = useState<Record<string, number>>({});
  const [cargosDoCadastro, setCargosDoCadastro] = useState<string[]>([]);
  // Cargo -> faixa de qual cargo ele usa. Pedreiro, encanador, carpinteiro, pintor e
  // ferreiro armador pagam pela faixa de OFICIAL (o estágio depois dos 90 dias).
  const [pagaComo, setPagaComo] = useState<Record<string, string>>({});
  // Diretoria e conselho não se remuneram por tabela. Não é faixa faltando, é decisão —
  // e cobrar isso na tela para sempre só ensina a ignorar o aviso.
  const [foraDaTabela, setForaDaTabela] = useState<Set<string>>(new Set());

  // Vínculo do cargo: por qual faixa ele paga, ou se fica fora da tabela. Era decisão
  // que só entrava por migration — agora entra pela tela.
  const [vinculoCargo, setVinculoCargo] = useState<string | null>(null);
  const [vinculoFaixa, setVinculoFaixa] = useState("");
  const [vinculoFora, setVinculoFora] = useState(false);
  const [vinculoErro, setVinculoErro] = useState("");
  const [salvandoVinculo, setSalvandoVinculo] = useState(false);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<string>("");
  const [roleVariants, setRoleVariants] = useState<SalaryRow[]>([]);
  const [editingRow, setEditingRow] = useState<Partial<SalaryRow>>({
    role_code: "",
    role_name: "",
    level: "Nível I",
    seniority: "",
    modality: "CLT",
    salary: 0, uses_level: true, salary_experience: null, salary_after_probation: null
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    // A propria tela da tabela salarial mostrava 1.000 de 2.464 linhas.
    const supabase = createClient();
    try {
      const rows = await buscarTudo<SalaryRow>((de, ate) =>
        supabase.from("salary_table").select("*").order("role_name", { ascending: true }).range(de, ate));
      setData(rows);
    } catch {
      // mantem o comportamento anterior: erro nao derruba a tela
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void fetchData(), 0);
    return () => window.clearTimeout(timer);
  }, [fetchData]);

  const carregarCargos = useCallback(async () => {
    const supabase = createClient();
    try {
      const linhas = await buscarTudo<{ title: string | null; salary_role: string | null; off_salary_table: boolean | null }>((de, ate) =>
        supabase.from("job_profiles").select("title, salary_role, off_salary_table").order("title").range(de, ate));
      setCargosDoCadastro([...new Set(linhas.map((l) => (l.title ?? "").trim()).filter(Boolean))]);
      const paga: Record<string, string> = {};
      const fora = new Set<string>();
      for (const l of linhas) {
        const titulo = (l.title ?? "").trim();
        const faixa = (l.salary_role ?? "").trim();
        if (titulo && faixa) paga[titulo] = faixa;
        if (titulo && l.off_salary_table) fora.add(titulo);
      }
      setPagaComo(paga);
      setForaDaTabela(fora);
    } catch {
      setCargosDoCadastro([]); setPagaComo({}); setForaDaTabela(new Set());
    }
  }, []);

  useEffect(() => {
    const supabase = createClient();

    void buscarTudo<{ role: string | null }>((de, ate) =>
      supabase.from("employees").select("role").not("role", "is", null).range(de, ate))
      .then((linhas) => {
        const contagem: Record<string, number> = {};
        for (const l of linhas) {
          const cargo = (l.role ?? "").trim();
          if (cargo) contagem[cargo] = (contagem[cargo] ?? 0) + 1;
        }
        setPessoasPorCargo(contagem);
      })
      .catch(() => setPessoasPorCargo({}));

    void carregarCargos();
  }, [carregarCargos]);

  const uniqueRoles = useMemo(() => {
    const roles = summarizeSalaryRoles(data) as SalaryRoleSummary[];
    return roles.filter(r =>
      r.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      (r.code && r.code.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  }, [data, searchTerm]);

  // A tela lista a UNIÃO: cargos que têm faixa + cargos do cadastro que não têm. Antes
  // só apareciam os que tinham, então "este cargo não paga nada" era invisível — e é a
  // informação mais acionável da tela.
  const linhasDaTela: LinhaDaTela[] = useMemo(() => {
    const comFaixa = new Set(uniqueRoles.map((r) => r.name));
    const semFaixa = cargosDoCadastro
      .filter((titulo) => !comFaixa.has(titulo))
      .filter((titulo) =>
        titulo.toLowerCase().includes(searchTerm.toLowerCase()))
      .map((titulo) => ({
        name: titulo,
        semFaixa: true,
        usesLevel: true,
        structureLabel: "—",
        actionLabel: "Cadastrar faixa",
        faixa: null as { min: number; max: number } | null,
        conflitos: 0,
        duplicadas: 0,
        linhas: 0,
        salariesByModality: {},
        code: "",
      }));

    return [...uniqueRoles.map((r) => ({ ...r, semFaixa: false })), ...semFaixa]
      .sort((a, b) => {
        // Problema primeiro: conflito de salário, depois cargo com gente e sem faixa.
        const peso = (x: typeof a) =>
          (x.conflitos > 0 ? 0
            : foraDaTabela.has(x.name) ? 3
            : x.semFaixa && (pessoasPorCargo[x.name] ?? 0) > 0 ? 1
            : x.semFaixa ? 2 : 3);
        const d = peso(a) - peso(b);
        if (d !== 0) return d;
        const gente = (pessoasPorCargo[b.name] ?? 0) - (pessoasPorCargo[a.name] ?? 0);
        return gente !== 0 ? gente : a.name.localeCompare(b.name, "pt-BR");
      });
  }, [uniqueRoles, cargosDoCadastro, pessoasPorCargo, searchTerm, foraDaTabela]);

  // Cargos que realmente têm valores cadastrados.
  const temFaixa = useMemo(
    () => new Set(uniqueRoles.filter((r) => (r.linhas ?? 0) > 0).map((r) => r.name)),
    [uniqueRoles]
  );

  const resumo = useMemo(() => {
    // Quem paga pela faixa de OUTRO cargo só está coberto se a faixa de lá existir.
    // Pedreiro aponta para OFICIAL, mas enquanto OFICIAL estiver sem valores as 50
    // pessoas continuam sem salário preenchido — contar como resolvido esconderia
    // justamente a maior lacuna da tabela.
    const semFaixa = linhasDaTela.filter(
      (r) => r.semFaixa && !temFaixa.has(pagaComo[r.name] ?? "") && !foraDaTabela.has(r.name));
    return {
      cargos: linhasDaTela.length,
      semFaixa: semFaixa.length,
      pessoasSemFaixa: semFaixa.reduce((t, r) => t + (pessoasPorCargo[r.name] ?? 0), 0),
      conflitos: linhasDaTela.reduce((t, r) => t + (r.conflitos ?? 0), 0),
      duplicadas: linhasDaTela.reduce((t, r) => t + (r.duplicadas ?? 0), 0),
    };
  }, [linhasDaTela, pessoasPorCargo, pagaComo, temFaixa, foraDaTabela]);

  const abrirVinculo = (cargo: string) => {
    setVinculoCargo(cargo);
    setVinculoFaixa(pagaComo[cargo] ?? "");
    setVinculoFora(foraDaTabela.has(cargo));
    setVinculoErro("");
  };

  const salvarVinculo = async () => {
    if (!vinculoCargo) return;
    if (vinculoFaixa && vinculoFaixa === vinculoCargo) {
      setVinculoErro("Um cargo não pode pagar pela própria faixa. Deixe em branco para usar a dele.");
      return;
    }
    setSalvandoVinculo(true);
    setVinculoErro("");
    const supabase = createClient();
    const valores = { salary_role: vinculoFaixa || null, off_salary_table: vinculoFora };
    // O cargo pode existir só na tabela salarial e não no catálogo — aí não há linha
    // para atualizar, e sem o `select` isso passaria como sucesso silencioso.
    const { data: alterados, error } = await supabase
      .from("job_profiles").update(valores).eq("title", vinculoCargo).select("id");

    let falha = error?.message ?? "";
    if (!falha && (alterados?.length ?? 0) === 0) {
      const { error: erroInsert } = await supabase.from("job_profiles").insert({
        title: vinculoCargo,
        profile_code: `AUTO-${vinculoCargo.slice(0, 20)}`,
        ...valores,
      });
      falha = erroInsert?.message ?? "";
    }
    setSalvandoVinculo(false);
    setVinculoErro(falha);
    if (!falha) {
      await carregarCargos();
      setVinculoCargo(null);
    }
  };

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
      seniority: editingRow.uses_level === false ? null : (editingRow.seniority || null),
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
            Todo cargo do cadastro aparece aqui — inclusive os que ainda não têm faixa.
          </p>
        </div>
        <Button onClick={() => {
          setEditingRow({ role_code: "", role_name: "", level: "Nível I", seniority: "", modality: "CLT", salary: 0, uses_level: true, salary_experience: null, salary_after_probation: null });
          setSaveError("");
          setEditingRole("");
          setIsModalOpen(true);
        }}>
          <Plus className="mr-2 h-4 w-4" /> Nova Faixa Salarial
        </Button>
      </div>

      {/* O que precisa de atenção, em números, antes da lista. Antes era preciso abrir
          cargo por cargo para descobrir que 118 não tinham faixa nenhuma. */}
      {!loading && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-md border bg-card p-4">
            <div className="text-2xl font-semibold tabular-nums">{resumo.cargos}</div>
            <div className="text-xs text-muted-foreground">cargos no cadastro</div>
          </div>
          <div className={`rounded-md border p-4 ${resumo.pessoasSemFaixa > 0 ? "border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30" : "bg-card"}`}>
            <div className="text-2xl font-semibold tabular-nums">{resumo.pessoasSemFaixa}</div>
            <div className="text-xs text-muted-foreground">
              colaboradores sem faixa salarial
              {resumo.semFaixa > 0 && <> · {resumo.semFaixa} cargos</>}
            </div>
          </div>
          <div className={`rounded-md border p-4 ${resumo.conflitos > 0 ? "border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950/30" : "bg-card"}`}>
            <div className="text-2xl font-semibold tabular-nums">{resumo.conflitos}</div>
            <div className="text-xs text-muted-foreground">
              faixas com dois salários para a mesma combinação
            </div>
          </div>
          <div className="rounded-md border bg-card p-4">
            <div className="text-2xl font-semibold tabular-nums">{resumo.duplicadas}</div>
            <div className="text-xs text-muted-foreground">linhas repetidas (mesmo valor)</div>
          </div>
        </div>
      )}

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
                {/* "Código" saiu: era AUTO-xxxxxx gerado por importação, não dizia nada
                    a ninguém. No lugar entra quanta GENTE depende da faixa — que é o
                    que decide se o cargo merece atenção. */}
                <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Cargo</th>
                <th className="h-12 px-4 text-right align-middle font-medium text-muted-foreground">Pessoas</th>
                <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Estrutura</th>
                <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Faixa</th>
                <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Situação</th>
                <th className="h-12 px-4 text-right align-middle font-medium text-muted-foreground">Ações</th>
              </tr>
            </thead>
            <tbody className="[&_tr:last-child]:border-0">
              {loading ? (
                <tr><td colSpan={6} className="p-4 text-center text-muted-foreground">Carregando...</td></tr>
              ) : linhasDaTela.length === 0 ? (
                <tr><td colSpan={6} className="p-4 text-center text-muted-foreground">Nenhum cargo encontrado.</td></tr>
              ) : (
                linhasDaTela.map((role) => {
                  const pessoas = pessoasPorCargo[role.name] ?? 0;
                  return (
                  <tr key={role.name} className={`border-b transition-colors hover:bg-muted/50 ${role.conflitos > 0 ? "bg-red-50/40 dark:bg-red-950/10" : ""}`}>
                    <td className="p-4 font-medium">{role.name}</td>
                    <td className="p-4 text-right tabular-nums">
                      {pessoas > 0
                        ? pessoas
                        : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="p-4">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${role.semFaixa ? "bg-muted text-muted-foreground" : role.usesLevel ? "bg-muted text-muted-foreground" : "bg-primary/10 text-primary"}`}>
                        {role.structureLabel}
                      </span>
                    </td>
                    {/* A faixa fica VISÍVEL na lista. Antes era preciso abrir o modal de
                        cada cargo para ver qualquer valor, e as duas colunas que existiam
                        aqui mostravam "Por nível" — ou seja, nada. */}
                    <td className="p-4 text-xs tabular-nums">
                      {role.faixa
                        ? (role.faixa.min === role.faixa.max
                            ? formatCurrency(role.faixa.min)
                            : <>{formatCurrency(role.faixa.min)} <span className="text-muted-foreground">até</span> {formatCurrency(role.faixa.max)}</>)
                        : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="p-4 text-xs">
                      <div className="flex flex-wrap gap-1">
                        {role.conflitos > 0 && (
                          <span
                            title="A mesma combinação de regime, nível e senioridade tem mais de um salário. O preenchimento automático escolhe um deles sem critério."
                            className="inline-flex rounded-full bg-red-100 px-2 py-0.5 font-medium text-red-800 dark:bg-red-950/60 dark:text-red-200"
                          >
                            {role.conflitos} conflito{role.conflitos > 1 ? "s" : ""} de salário
                          </span>
                        )}
                        {pagaComo[role.name] && (
                          <span
                            title={temFaixa.has(pagaComo[role.name])
                              ? `Este cargo nao tem faixa propria: usa a de ${pagaComo[role.name]}.`
                              : `Aponta para ${pagaComo[role.name]}, que ainda nao tem valores. Ate la, ${pessoas} colaborador(es) seguem sem salario preenchido.`}
                            className={`inline-flex rounded-full px-2 py-0.5 font-medium ${temFaixa.has(pagaComo[role.name]) ? "bg-primary/10 text-primary" : "bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-200"}`}
                          >
                            paga como {pagaComo[role.name]}
                            {!temFaixa.has(pagaComo[role.name]) && " — sem valores"}
                          </span>
                        )}
                        {foraDaTabela.has(role.name) && (
                          <span
                            title="Cargo que nao se remunera por tabela salarial. Fora da tabela por decisao, nao por falta de cadastro."
                            className="inline-flex rounded-full bg-muted px-2 py-0.5 font-medium text-muted-foreground"
                          >
                            fora da tabela
                          </span>
                        )}
                        {role.semFaixa && !pagaComo[role.name] && !foraDaTabela.has(role.name) && (
                          <span
                            title={pessoas > 0
                              ? `${pessoas} colaborador(es) neste cargo não têm salário preenchido automaticamente.`
                              : "Cargo cadastrado, mas ainda sem faixa salarial."}
                            className={`inline-flex rounded-full px-2 py-0.5 font-medium ${pessoas > 0 ? "bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-200" : "bg-muted text-muted-foreground"}`}
                          >
                            sem faixa
                          </span>
                        )}
                        {role.duplicadas > 0 && (
                          <span
                            title="Linhas repetidas com o mesmo valor. Não mudam salário, mas escondem as que conflitam."
                            className="inline-flex rounded-full bg-muted px-2 py-0.5 text-muted-foreground"
                          >
                            {role.duplicadas} repetida{role.duplicadas > 1 ? "s" : ""}
                          </span>
                        )}
                        {!role.semFaixa && !pagaComo[role.name] && !foraDaTabela.has(role.name) && role.conflitos === 0 && role.duplicadas === 0 && (
                          <span className="text-muted-foreground">ok</span>
                        )}
                      </div>
                    </td>
                    <td className="p-4 text-right">
                      <Button
                        variant={role.semFaixa && pessoas > 0 && !foraDaTabela.has(role.name) ? "default" : "outline"}
                        size="sm"
                        onClick={() => {
                          if (!role.semFaixa) { loadRoleVariants(role.name); return; }
                          // Cargo sem faixa abre o formulário já com o nome preenchido.
                          setEditingRow({
                            role_code: "", role_name: role.name, level: "Nível I", seniority: "",
                            modality: "CLT", salary: 0, uses_level: true,
                            salary_experience: null, salary_after_probation: null,
                          });
                          setSaveError("");
                          setEditingRole("");
                          setIsModalOpen(true);
                        }}
                      >
                        {role.actionLabel}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="ml-1"
                        title="Escolher por qual faixa este cargo paga, ou deixá-lo fora da tabela."
                        onClick={() => abrirVinculo(role.name)}
                      >
                        Vínculo
                      </Button>
                    </td>
                  </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={vinculoCargo !== null} onOpenChange={(aberto) => { if (!aberto) setVinculoCargo(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Vínculo de faixa: {vinculoCargo}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Um cargo pode ter faixa própria, pagar pela faixa de outro cargo (é o caso dos
              ofícios, que pagam como OFICIAL) ou ficar fora da tabela salarial, como a
              diretoria. Nada aqui altera salário já gravado em ficha de colaborador.
            </p>
            <Field label="Paga pela faixa de" labelClassName="">
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={vinculoFaixa}
                disabled={vinculoFora}
                onChange={(e) => setVinculoFaixa(e.target.value)}
              >
                <option value="">— usa a faixa do próprio cargo —</option>
                {[...temFaixa].sort((a, b) => a.localeCompare(b, "pt-BR"))
                  .filter((nome) => nome !== vinculoCargo)
                  .map((nome) => <option key={nome} value={nome}>{nome}</option>)}
              </select>
            </Field>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={vinculoFora}
                onChange={(e) => { setVinculoFora(e.target.checked); if (e.target.checked) setVinculoFaixa(""); }}
              />
              Fora da tabela salarial (não é faixa faltando, é decisão)
            </label>
            {vinculoErro && <p className="text-sm text-destructive">{vinculoErro}</p>}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setVinculoCargo(null)}>Cancelar</Button>
              <Button onClick={salvarVinculo} disabled={salvandoVinculo}>
                {salvandoVinculo ? "Salvando..." : "Salvar vínculo"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingRole ? `Níveis: ${editingRole}` : "Nova Faixa Salarial"}</DialogTitle>
          </DialogHeader>
          {editingRole ? (
            <div className="space-y-6">
              {(() => {
                const grouped = groupByRegimeAndLevel(roleVariants) as Record<string, Record<string, Record<string, SalaryRow>>>;
                const levels = levelsInUse(roleVariants) as string[];
                return ["CLT", "PJ"].map((modality) => {
                  const seniorityGroups = grouped[modality];
                  if (!seniorityGroups) return null;
                  const seniorityKeys = Object.keys(seniorityGroups);
                  if (seniorityKeys.length === 0) return null;
                  return (
                    <div key={modality} className="space-y-4">
                      <h3 className="font-medium text-center border-b pb-2">{modality}</h3>
                      {seniorityKeys.map((seniorityKey) => {
                        const levelsForSeniority = seniorityGroups[seniorityKey];
                        return (
                          <div key={seniorityKey} className="space-y-2">
                            {seniorityKey !== NO_SENIORITY_KEY && (
                              <h4 className="text-sm font-medium text-muted-foreground text-center">{seniorityKey}</h4>
                            )}
                            <div className="overflow-x-auto">
                              <table className="w-full text-sm text-center">
                                <thead>
                                  <tr>
                                    {levels.map(lvl => <th key={lvl} className="py-2 border-b whitespace-nowrap px-2">{lvl}</th>)}
                                  </tr>
                                </thead>
                                <tbody>
                                  <tr>
                                    {levels.map(lvl => {
                                      const row = levelsForSeniority[lvl];
                                      return (
                                        <td key={lvl} className="py-2 px-2">
                                          {row ? (
                                            <div className="flex flex-col items-center gap-1">
                                              <span className="whitespace-nowrap">{formatCurrency(row.salary || 0)}</span>
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
                      })}
                    </div>
                  );
                });
              })()}
              <Button onClick={() => setEditingRow({ role_name: editingRole, level: "Nível I", seniority: "", modality: "CLT", salary: 0, role_code: roleVariants[0]?.role_code || "", uses_level: true, salary_experience: null, salary_after_probation: null })}>Adicionar faixa</Button>
            </div>
          ) : (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <Field label="Código do Cargo" labelClassName="">
                  <Input value={editingRow.role_code || ""} onChange={(e) => setEditingRow({ ...editingRow, role_code: e.target.value })} />
                </Field>
                <Field label="Nome do Cargo *" labelClassName="">
                  <Input value={editingRow.role_name || ""} onChange={(e) => setEditingRow({ ...editingRow, role_name: e.target.value })} />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Estrutura do cargo" labelClassName="">
                  <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={editingRow.uses_level === false ? "sem-nivel" : "com-nivel"} onChange={(e) => setEditingRow({ ...editingRow, uses_level: e.target.value === "com-nivel" })}>
                    <option value="com-nivel">Com nível</option>
                    <option value="sem-nivel">Sem nível</option>
                  </select>
                </Field>
                {editingRow.uses_level !== false && (
                <>
                <Field label="Nível" labelClassName="">
                  <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={editingRow.level || "Nível I"} onChange={(e) => setEditingRow({ ...editingRow, level: e.target.value })}>
                    {STANDARD_LEVELS.map((lvl) => <option key={lvl} value={lvl}>{lvl}</option>)}
                  </select>
                </Field>
                <Field label="Senioridade" labelClassName="">
                  <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={editingRow.seniority || ""} onChange={(e) => setEditingRow({ ...editingRow, seniority: e.target.value })}>
                    <option value="">Sem senioridade</option>
                    {senioridadesDoCargo(roleVariants).map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </Field>
                </>
                )}
                <Field label="Modalidade" labelClassName="">
                  <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={editingRow.modality || "CLT"} onChange={(e) => setEditingRow({ ...editingRow, modality: e.target.value })}>
                    <option value="CLT">CLT</option>
                    <option value="PJ">PJ</option>
                  </select>
                </Field>
              </div>
              {editingRow.uses_level !== false ? <Field label="Salário Base (R$) *" labelClassName="">
                  <Input inputMode="numeric" value={formatCurrencyInput(editingRow.salary || 0)} onChange={(e) => setEditingRow({ ...editingRow, salary: parseCurrencyInput(maskCurrencyInput(e.target.value)) })} />
                </Field> : <div className="grid grid-cols-2 gap-4"><Field label="Salário experiência (R$) *" labelClassName="">
                  <Input inputMode="numeric" value={editingRow.salary_experience == null ? "" : formatCurrencyInput(editingRow.salary_experience)} onChange={(e) => setEditingRow({ ...editingRow, salary_experience: parseCurrencyInput(maskCurrencyInput(e.target.value)) })} />
                </Field><Field label="Salário após 90 dias (R$) *" labelClassName="">
                  <Input inputMode="numeric" value={editingRow.salary_after_probation == null ? "" : formatCurrencyInput(editingRow.salary_after_probation)} onChange={(e) => setEditingRow({ ...editingRow, salary_after_probation: parseCurrencyInput(maskCurrencyInput(e.target.value)) })} />
                </Field></div>}
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
