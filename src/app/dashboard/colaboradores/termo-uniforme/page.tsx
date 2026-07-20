"use client";

import { createClient } from "@/utils/supabase/client";
import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";

function TermoUniformeContent() {
  const searchParams = useSearchParams();
  const employeeId = searchParams.get("id");
  const itemsParam = searchParams.get("items");
  const typeParam = searchParams.get("type");
  const priceParam = searchParams.get("price");
  const installmentsParam = searchParams.get("installments");
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    if (!employeeId) return;
    const load = async () => {
      const supabase = createClient();
      const [emp, unis] = await Promise.all([
        supabase.from("employees").select("*").eq("id", employeeId).single(),
        supabase.from("employee_uniforms").select("*, uniform_items(name, size)").eq("employee_id", employeeId).order("delivered_at", { ascending: false }),
      ]);
      let filteredUnis = unis.data || [];
      if (itemsParam && itemsParam.trim() !== "") {
        const itemIds = itemsParam.split(',');
        filteredUnis = filteredUnis.filter(u => itemIds.includes(u.id));
      }
      setData({ employee: emp.data, uniforms: filteredUnis });
    };
    load();
  }, [employeeId]);

  if (!employeeId) return <div className="p-8 text-center text-red-500">ID não fornecido.</div>;
  if (!data) return <div className="p-8 text-center">Carregando termo...</div>;
  if (!data.employee) return <div className="p-8 text-center text-red-500">Colaborador não encontrado.</div>;

  const isPurchase = typeParam === "compra";
  const titleText = isPurchase ? "Termo de Recebimento de Uniforme e Autorização de Desconto" : "Termo de Recebimento de Uniformes e EPIs";

  return (
    <div className="bg-white text-black min-h-screen p-8 font-sans max-w-4xl mx-auto">
      <div className="flex justify-end mb-8 print:hidden">
        <button onClick={() => window.print()} className="bg-primary text-primary-foreground px-4 py-2 rounded-md font-semibold">
          Imprimir Termo
        </button>
      </div>

      <div className="border-2 border-black p-8">
        <div className="text-center mb-8 border-b-2 border-black pb-4">
          <h1 className="text-2xl font-bold uppercase tracking-wider">{titleText}</h1>
        </div>

        <div className="mb-6 leading-relaxed text-justify">
          <p>
            Eu, <strong>{data.employee.name}</strong>, portador(a) do cargo <strong>{data.employee.role || "_________________________"}</strong>,
            {isPurchase ? (
              <> declaro ter recebido da empresa as peças adicionais abaixo relacionadas, e <strong>autorizo o desconto em minha folha de pagamento</strong> do valor total de <strong>R$ {Number(priceParam || 0).toFixed(2).replace('.', ',')}</strong>, dividido em <strong>{installmentsParam || 1} parcela(s)</strong>, referente à aquisição destes itens para meu uso exclusivo no desempenho de minhas funções.</>
            ) : (
              <> declaro ter recebido da empresa os equipamentos e uniformes abaixo relacionados, em perfeito estado de conservação e funcionamento, para meu uso exclusivo no desempenho de minhas funções.</>
            )}
          </p>
        </div>

        <table className="w-full mb-8 border-collapse">
          <thead>
            <tr className="bg-gray-100">
              <th className="border border-black p-2 text-left">Quantidade</th>
              <th className="border border-black p-2 text-left">Descrição do Item</th>
              <th className="border border-black p-2 text-left">Tamanho</th>
              <th className="border border-black p-2 text-left">Data de Entrega</th>
            </tr>
          </thead>
          <tbody>
            {data.uniforms?.length === 0 ? (
              <tr>
                <td colSpan={4} className="border border-black p-4 text-center italic">Nenhum item registrado.</td>
              </tr>
            ) : (
              data.uniforms.map((u: any) => (
                <tr key={u.id}>
                  <td className="border border-black p-2">{u.quantity_delivered}</td>
                  <td className="border border-black p-2">{u.uniform_items?.name} {u.notes ? `(${u.notes})` : ''}</td>
                  <td className="border border-black p-2">{u.uniform_items?.size}</td>
                  <td className="border border-black p-2">{new Date(u.delivered_at).toLocaleDateString()}</td>
                </tr>
              ))
            )}
            {/* Blank lines for manual fill if needed */}
            <tr><td className="border border-black p-2 text-transparent">-</td><td className="border border-black p-2 text-transparent">-</td><td className="border border-black p-2 text-transparent">-</td><td className="border border-black p-2 text-transparent">-</td></tr>
            <tr><td className="border border-black p-2 text-transparent">-</td><td className="border border-black p-2 text-transparent">-</td><td className="border border-black p-2 text-transparent">-</td><td className="border border-black p-2 text-transparent">-</td></tr>
          </tbody>
        </table>

        <div className="mb-8 leading-relaxed text-sm text-justify">
          <p className="mb-2"><strong>Declaro também estar ciente de que:</strong></p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Os equipamentos fornecidos são de propriedade da empresa, sendo-me confiados apenas para uso em serviço.</li>
            <li>Devo zelar pela conservação e limpeza dos mesmos.</li>
            <li>Em caso de perda, extravio ou dano por uso inadequado, deverei arcar com os custos de reposição.</li>
            <li>Comprometo-me a devolver todos os itens no momento do meu desligamento da empresa, sob pena de desconto em rescisão.</li>
          </ul>
        </div>

        <div className="mt-16 flex flex-col items-center">
          <p className="mb-8 text-center">Pelotas, {new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
          <div className="w-96 border-t border-black mb-2"></div>
          <p className="font-semibold text-center">{data.employee.name}</p>
          <p className="text-sm text-center">Assinatura do Colaborador</p>
        </div>
      </div>
    </div>
  );
}

export default function TermoUniforme() {
  return (
    <Suspense fallback={<div className="p-8 text-center">Carregando...</div>}>
      <TermoUniformeContent />
    </Suspense>
  );
}
