"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { DiscountPartner, BenefitCategory } from "@/types/benefits";
import { PartnerCard } from "@/components/benefits/PartnerCard";
import { RedeemModal } from "@/components/benefits/RedeemModal";
import { BecomePartnerModal } from "@/components/benefits/BecomePartnerModal";
import { createClient } from "@/utils/supabase/client";
import { Search, Sparkles, Filter, RefreshCw, Layers, Gift, ArrowRight } from "lucide-react";

const CATEGORIES: BenefitCategory[] = [
  "Todos",
  "Saúde",
  "Alimentação",
  "Educação",
  "Lazer",
  "Serviços"
];

export default function ClubeDescontosPage() {
  const [partners, setPartners] = useState<DiscountPartner[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [debouncedSearch, setDebouncedSearch] = useState<string>("");
  const [selectedCategory, setSelectedCategory] = useState<BenefitCategory>("Todos");
  const [selectedPartner, setSelectedPartner] = useState<DiscountPartner | null>(null);
  const [modalOpen, setModalOpen] = useState<boolean>(false);
  const [partnerModalOpen, setPartnerModalOpen] = useState<boolean>(false);
  const supabase = useMemo(() => createClient(), []);

  // Implementação de alta performance do Debounce no input de pesquisa (300ms)
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  // Carregamento de dados com fallback à prova de falhas (useCallback para estabilidade de referência)
  const fetchPartners = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("discount_partners")
        .select("*")
        .eq("is_active", true)
        .order("name");

      if (error) {
        console.error("Erro ao carregar parceiros:", error);
        setPartners([]);
      } else {
        setPartners((data as DiscountPartner[]) || []);
      }
    } catch (e: unknown) {
      console.error("Erro ao carregar Clube de Descontos:", e);
      setPartners([]);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchPartners();
  }, [fetchPartners]);

  // Filtragem local otimizada e sem re-renderizações lentas (useMemo)
  const filteredPartners = useMemo(() => {
    return partners.filter((p) => {
      const matchesCategory =
        selectedCategory === "Todos" ||
        p.category.toLowerCase().includes(selectedCategory.toLowerCase());
      const matchesSearch =
        debouncedSearch === "" ||
        p.name.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
        p.discount_rules.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
        p.category.toLowerCase().includes(debouncedSearch.toLowerCase());

      return matchesCategory && matchesSearch;
    });
  }, [partners, selectedCategory, debouncedSearch]);

  const handleOpenRedeemModal = (partner: DiscountPartner) => {
    setSelectedPartner(partner);
    setModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-zinc-50/50 pb-20 dark:bg-zinc-950">
      {/* Hero Section Premium com Glassmorphism e Gráficos de Fundo */}
      <div className="relative overflow-hidden border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="absolute inset-0 bg-gradient-to-tr from-amber-500/10 via-transparent to-zinc-900/5 pointer-events-none" />
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 relative z-10">
          <div className="max-w-3xl">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-amber-600 border border-amber-500/20 dark:text-amber-400 mb-4">
              <Gift className="h-3.5 w-3.5" />
              <span>Benefícios Corporativos & Vantagens</span>
            </span>
            <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl text-zinc-900 dark:text-white">
              Clube de Descontos & Parceiros
            </h1>
            <p className="mt-3 text-base text-zinc-600 dark:text-zinc-300 leading-relaxed">
              Aproveite acordos comerciais exclusivos negociados para nossa equipe. Filtre por categoria ou busque seu estabelecimento favorito e veja como utilizar cada benefício.
            </p>
          </div>

          {/* Barra de Pesquisa de Alta Performance com Ícones Interativos */}
          <div className="mt-8 flex flex-col sm:flex-row gap-4 max-w-2xl">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar por parceiro, benefício, academia ou desconto..."
                className="w-full rounded-xl border border-zinc-200 bg-zinc-50/80 py-3.5 pl-11 pr-4 text-sm text-zinc-900 placeholder-zinc-400 shadow-inner transition-all focus:border-amber-500 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-amber-500/20 dark:border-zinc-800 dark:bg-zinc-800/60 dark:text-white dark:focus:border-amber-500 dark:focus:bg-zinc-800"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-xs text-zinc-400 hover:bg-zinc-200 hover:text-zinc-600 dark:hover:bg-zinc-700"
                >
                  Limpar
                </button>
              )}
            </div>
            <button
              onClick={() => setPartnerModalOpen(true)}
              type="button"
              className="flex items-center justify-center gap-2 rounded-xl bg-amber-500 px-6 py-3.5 text-sm font-bold text-zinc-950 shadow-md transition-all duration-200 hover:bg-amber-400 hover:shadow-lg active:scale-95 sm:w-auto"
            >
              <Sparkles className="h-4 w-4" />
              <span>Seja um Parceiro ACPO</span>
            </button>
          </div>
        </div>
      </div>

      {/* Navegação por Categorias (Botões de Filtro Rápido) */}
      <div className="sticky top-0 z-30 border-b border-zinc-200/80 bg-white/90 backdrop-blur-md dark:border-zinc-800/80 dark:bg-zinc-900/90 shadow-2xs">
        <div className="mx-auto flex max-w-7xl items-center gap-2 overflow-x-auto px-4 py-3.5 sm:px-6 lg:px-8 scrollbar-none">
          <Filter className="h-4 w-4 shrink-0 text-zinc-400 mr-1" />
          {CATEGORIES.map((cat) => {
            const isActive = selectedCategory === cat;
            return (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                type="button"
                className={`inline-flex items-center gap-1.5 shrink-0 rounded-full px-4 py-1.5 text-xs font-semibold transition-all duration-200 ${
                  isActive
                    ? "bg-zinc-900 text-white shadow-sm scale-105 dark:bg-white dark:text-zinc-900"
                    : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 hover:text-zinc-900 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700 dark:hover:text-zinc-200"
                }`}
              >
                <span>{cat}</span>
                {isActive && <Sparkles className="h-3 w-3 text-amber-400 dark:text-amber-500" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* Container Principal de Cartões do Catálogo */}
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Contagem de Resultados e Ações */}
        <div className="mb-6 flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400 font-medium">
          <div>
            Exibindo{" "}
            <span className="font-bold text-zinc-900 dark:text-zinc-200">
              {filteredPartners.length}
            </span>{" "}
            {filteredPartners.length === 1 ? "parceiro conveniado" : "parceiros conveniados"}{" "}
            {selectedCategory !== "Todos" && `em "${selectedCategory}"`}
          </div>
          <button
            onClick={fetchPartners}
            type="button"
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-zinc-600 transition-colors hover:bg-zinc-200/60 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Atualizar catálogo</span>
          </button>
        </div>

        {/* Estado de Carregamento - Skeletons Modernos */}
        {loading ? (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div
                key={i}
                className="flex h-72 flex-col justify-between rounded-xl border border-zinc-200/70 bg-white p-5 shadow-xs dark:border-zinc-800/70 dark:bg-zinc-900 animate-pulse"
              >
                <div>
                  <div className="mb-4 flex items-center justify-between">
                    <div className="h-12 w-12 rounded-lg bg-zinc-200 dark:bg-zinc-800" />
                    <div className="h-6 w-28 rounded-full bg-zinc-200 dark:bg-zinc-800" />
                  </div>
                  <div className="h-3 w-20 rounded bg-zinc-200 dark:bg-zinc-800 mb-3" />
                  <div className="h-5 w-3/4 rounded bg-zinc-200 dark:bg-zinc-800 mb-4" />
                  <div className="space-y-2">
                    <div className="h-3 w-full rounded bg-zinc-200 dark:bg-zinc-800" />
                    <div className="h-3 w-4/5 rounded bg-zinc-200 dark:bg-zinc-800" />
                  </div>
                </div>
                <div className="h-10 w-full rounded-lg bg-zinc-200 dark:bg-zinc-800 mt-4" />
              </div>
            ))}
          </div>
        ) : filteredPartners.length === 0 ? (
          /* Empty State Ilustrada / Minimalista */
          <div className="my-12 flex flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-300 bg-white/50 p-12 text-center shadow-xs backdrop-blur-xs dark:border-zinc-800 dark:bg-zinc-900/40">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 mb-4">
              <Layers className="h-8 w-8 stroke-[1.5]" />
            </div>
            <h3 className="text-lg font-bold text-zinc-900 dark:text-white">
              Nenhum convênio encontrado com os filtros atuais
            </h3>
            <p className="mt-1 max-w-sm text-sm text-zinc-500 dark:text-zinc-400">
              Não encontramos parceiros para a busca <strong>&ldquo;{searchQuery}&rdquo;</strong> em <strong>&ldquo;{selectedCategory}&rdquo;</strong>.
            </p>
            <button
              onClick={() => {
                setSearchQuery("");
                setSelectedCategory("Todos");
              }}
              type="button"
              className="mt-6 flex items-center gap-2 rounded-lg bg-zinc-900 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200 transition-all"
            >
              <span>Limpar Filtros e Ver Todos</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          /* Grade de Convênios Disponíveis */
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {filteredPartners.map((partner) => (
              <PartnerCard
                key={partner.id}
                partner={partner}
                onSelect={handleOpenRedeemModal}
              />
            ))}
          </div>
        )}
      </main>

      {/* Modal Transacional de Resgate de Benefício (Subtarefa 3) */}
      <RedeemModal
        partner={selectedPartner}
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
      />

      {/* Modal "Seja um Parceiro" para leads externos */}
      <BecomePartnerModal 
        isOpen={partnerModalOpen}
        onClose={() => setPartnerModalOpen(false)}
      />
    </div>
  );
}
