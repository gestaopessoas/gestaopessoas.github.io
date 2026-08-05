"use client";

import React from "react";
import { DiscountPartner } from "@/types/benefits";
import { Tag, Sparkles, Ticket } from "lucide-react";

interface PartnerCardProps {
  partner: DiscountPartner;
  onSelect: (partner: DiscountPartner) => void;
}

export const PartnerCard: React.FC<PartnerCardProps> = ({ partner, onSelect }) => {
  // Extrai inteligentemente a porcentagem de desconto do texto de regras para o Badge
  const extractBadgeText = (rules: string): string => {
    const percentMatch = rules.match(/(\d+)%/);
    if (percentMatch && percentMatch[1]) {
      return `ATÉ ${percentMatch[1]}% OFF`;
    }
    return "BENEFÍCIO EXCLUSIVO";
  };

  const badgeText = extractBadgeText(partner.discount_rules);

  return (
    <div className="group relative flex flex-col justify-between overflow-hidden rounded-xl border border-zinc-200/80 bg-white/80 p-5 shadow-xs backdrop-blur-md transition-all duration-300 hover:-translate-y-1 hover:border-amber-400/50 hover:shadow-lg dark:border-zinc-800/80 dark:bg-zinc-900/80 dark:hover:border-amber-500/50">
      {/* Efeito de brilho no hover (Glassmorphism highlight) */}
      <div className="pointer-events-none absolute -right-12 -top-12 h-28 w-28 rounded-full bg-gradient-to-br from-amber-400/10 to-amber-600/5 opacity-0 blur-xl transition-opacity duration-500 group-hover:opacity-100" />

      <div>
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-zinc-100 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-800/50">
            {partner.logo_url ? (
              <img
                src={partner.logo_url}
                alt={`Logo ${partner.name}`}
                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                loading="lazy"
              />
            ) : (
              <Ticket className="h-6 w-6 text-amber-500" />
            )}
          </div>

          {/* Badge de Desconto em destaque HSL */}
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-bold tracking-wide text-emerald-600 border border-emerald-500/20 dark:bg-emerald-500/15 dark:text-emerald-400">
            <Sparkles className="h-3.5 w-3.5" />
            {badgeText}
          </span>
        </div>

        <div className="mb-2">
          <span className="inline-flex items-center gap-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">
            <Tag className="h-3 w-3 text-amber-500" />
            {partner.category}
          </span>
          <h3 className="mt-1 text-lg font-bold tracking-tight text-zinc-900 transition-colors group-hover:text-amber-600 dark:text-zinc-100 dark:group-hover:text-amber-400">
            {partner.name}
          </h3>
        </div>

        <p className="line-clamp-3 text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">
          {partner.discount_rules}
        </p>
      </div>

      <div className="mt-6 pt-4 border-t border-zinc-100 dark:border-zinc-800/60">
        <button
          onClick={() => onSelect(partner)}
          className="relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white shadow-xs transition-all duration-200 hover:bg-amber-500 hover:text-zinc-950 active:scale-[0.98] dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-amber-400 dark:hover:text-zinc-950"
          type="button"
        >
          <Ticket className="h-4 w-4 transition-transform duration-200 group-hover:-rotate-12 group-hover:scale-110" />
          <span>Resgatar Benefício</span>
        </button>
      </div>
    </div>
  );
};
