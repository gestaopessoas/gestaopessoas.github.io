"use client";

import { createClient } from "@/utils/supabase/client";
import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";

function TermoObraContent() {
  const searchParams = useSearchParams();
  const workplaceId = searchParams.get("id");
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    if (!workplaceId) return;
    const load = async () => {
      const supabase = createClient();
      const [wp, emps] = await Promise.all([
        supabase.from("workplaces").select("*").eq("id", workplaceId).single(),
        supabase.from("employees").select("id, registration_number, name").eq("workplace_id", workplaceId).eq("status", "Ativo").order("name"),
      ]);
      setData({ workplace: wp.data, employees: emps.data || [] });
    };
    load();
  }, [workplaceId]);

  if (!workplaceId) return <div className="p-8 text-center text-red-500">ID não fornecido.</div>;
  if (!data) return <div className="p-8 text-center">Carregando lista...</div>;
  if (!data.workplace) return <div className="p-8 text-center text-red-500">Obra/Unidade não encontrada.</div>;

  return (
    <div className="bg-white text-black min-h-screen p-8 font-sans w-full max-w-full">
      <div className="flex justify-end mb-8 print:hidden">
        <button onClick={() => window.print()} className="bg-primary text-primary-foreground px-4 py-2 rounded-md font-semibold">
          Imprimir Lista
        </button>
      </div>

      <div className="w-full">
        <div className="text-center mb-6">
          <h1 className="text-xl font-bold uppercase">{data.workplace.name}</h1>
        </div>

        <table className="w-full border-collapse border border-black text-sm">
          <thead>
            <tr>
              <th className="border border-black p-2 text-center w-20">Código</th>
              <th className="border border-black p-2 text-left">Nome completo</th>
              <th className="border border-black p-2 text-center w-28">Data Entrega</th>
              <th className="border border-black p-2 text-center w-20">Jaqueta</th>
              <th className="border border-black p-2 text-center w-20">Blusão</th>
              <th className="border border-black p-2 text-center w-28">Valor a pagar</th>
              <th className="border border-black p-2 text-left w-64">Assinatura</th>
            </tr>
          </thead>
          <tbody>
            {data.employees.length === 0 ? (
              <tr>
                <td colSpan={7} className="border border-black p-4 text-center italic">Nenhum colaborador ativo encontrado nesta unidade.</td>
              </tr>
            ) : (
              data.employees.map((emp: any) => (
                <tr key={emp.id} className="h-10">
                  <td className="border border-black p-1 text-center font-mono text-xs">{emp.registration_number || ""}</td>
                  <td className="border border-black p-1 text-xs truncate max-w-xs">{emp.name}</td>
                  <td className="border border-black p-1"></td>
                  <td className="border border-black p-1"></td>
                  <td className="border border-black p-1"></td>
                  <td className="border border-black p-1"></td>
                  <td className="border border-black p-1"></td>
                </tr>
              ))
            )}
            {/* Linhas em branco adicionais no final para preenchimento manual */}
            {Array.from({ length: 15 }).map((_, i) => (
              <tr key={`blank-${i}`} className="h-10">
                <td className="border border-black p-1"></td>
                <td className="border border-black p-1"></td>
                <td className="border border-black p-1"></td>
                <td className="border border-black p-1"></td>
                <td className="border border-black p-1"></td>
                <td className="border border-black p-1"></td>
                <td className="border border-black p-1"></td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-8 flex justify-end">
          <p className="font-semibold text-sm">
            Data de Emissão: {new Date().toLocaleDateString('pt-BR')}
          </p>
        </div>
      </div>
    </div>
  );
}

export default function TermoObra() {
  return (
    <Suspense fallback={<div className="p-8 text-center">Carregando...</div>}>
      <TermoObraContent />
    </Suspense>
  );
}
