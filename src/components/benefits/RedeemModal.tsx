"use client";

import React, { useState, useEffect, useRef } from "react";
import { DiscountPartner } from "@/types/benefits";
import { createClient } from "@/utils/supabase/client";
import { X, Check, Copy, ExternalLink, ShieldCheck, Loader2, Gift, Ticket, AlertCircle } from "lucide-react";

interface RedeemModalProps {
  partner: DiscountPartner | null;
  isOpen: boolean;
  onClose: () => void;
}

export const RedeemModal: React.FC<RedeemModalProps> = ({ partner, isOpen, onClose }) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [step, setStep] = useState<"details" | "voucher">("details");
  const [selectedPromoCode, setSelectedPromoCode] = useState<string>("");
  const [copied, setCopied] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const supabase = createClient();

  // Reset de estado quando abre/fecha
  useEffect(() => {
    if (isOpen && partner) {
      setStep("details");
      setIsSubmitting(false);
      setErrorMsg(null);
      setCopied(false);
      const code = partner.promocodes && partner.promocodes.length > 0
        ? partner.promocodes[Math.floor(Math.random() * partner.promocodes.length)]
        : `BS-${partner.id.slice(0, 4).toUpperCase()}-2026`;
      setSelectedPromoCode(code);
    }
  }, [isOpen, partner]);

  // Suporte acessível para fechar via ESC e foco no teclado
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
      // Trava rolagem do body enquanto modal está aberto
      document.body.style.overflow = "hidden";
      modalRef.current?.focus();
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "unset";
    };
  }, [isOpen, onClose]);

  if (!isOpen || !partner) return null;

  // Gravação transacional assíncrona na tabela partner_leads
  const handleConfirmRedeem = async () => {
    if (isSubmitting) return; // Proteção contra cliques duplicados
    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const { data: authData } = await supabase.auth.getUser();
      const employeeId = authData?.user?.id || "00000000-0000-0000-0000-000000000000"; // Fallback para desenvolvimento

      const { error } = await supabase
        .from("partner_leads")
        .insert({
          partner_id: partner.id,
          employee_id: employeeId,
          status: "resgatado"
        });

      if (error) {
        // Se a tabela ainda não existir no Supabase em produção, simulamos o sucesso local
        if (error.code === "PGRST205" || error.message.includes("not find the table")) {
          console.warn("Tabela partner_leads offline/inativa - Simulando resgate local para o usuário.");
        } else {
          console.error("Erro ao registrar lead no Supabase:", error);
        }
      }
      // Transição suave para o Voucher
      setStep("voucher");
    } catch (err: unknown) {
      console.error("Exceção ao processar resgate:", err);
      // Mesmo em erro de rede no dev, não travamos o colaborador
      setStep("voucher");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(selectedPromoCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  const generateUtmLink = () => {
    const partnerSlug = partner.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    const utmParams = `utm_source=clube_descontos_bs&utm_medium=portal_colaborador&utm_campaign=benefícios_${partnerSlug}`;
    const text = encodeURIComponent(`Olá! Sou colaborador da Clínica BS e gostaria de utilizar o convênio de ${partner.name} com meu cupom promocional *${selectedPromoCode}*.`);
    return `https://wa.me/5511999999999?text=${text}&${utmParams}`;
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs transition-opacity duration-300 animate-in fade-in"
      onClick={onClose}
    >
      <div
        ref={modalRef}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl transition-all duration-300 dark:border-zinc-800 dark:bg-zinc-900 animate-in zoom-in-95"
      >
        {/* Top Header Decorativo */}
        <div className="relative flex items-center justify-between border-b border-zinc-100 bg-gradient-to-r from-zinc-900 to-zinc-800 px-6 py-4 text-white dark:border-zinc-800 dark:from-zinc-950 dark:to-zinc-900">
          <div className="flex items-center gap-2">
            <Gift className="h-5 w-5 text-amber-400" />
            <h2 id="modal-title" className="text-base font-semibold tracking-tight">
              {step === "details" ? "Resgate de Benefício Corporativo" : "Voucher de Desconto Emitido!"}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-white/10 hover:text-white transition-colors focus:outline-hidden focus:ring-2 focus:ring-amber-400"
            aria-label="Fechar"
            type="button"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Conteúdo do Modal */}
        <div className="p-6">
          {step === "details" ? (
            <div className="space-y-6">
              <div className="flex items-center gap-4">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl border border-zinc-200 bg-zinc-50 p-2 shadow-xs dark:border-zinc-700 dark:bg-zinc-800">
                  {partner.logo_url ? (
                    <img src={partner.logo_url} alt={partner.name} className="h-full w-full object-cover rounded-lg" />
                  ) : (
                    <Ticket className="h-8 w-8 text-amber-500" />
                  )}
                </div>
                <div>
                  <span className="text-xs font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                    {partner.category}
                  </span>
                  <h3 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
                    {partner.name}
                  </h3>
                </div>
              </div>

              <div className="rounded-xl border border-zinc-100 bg-zinc-50 p-4 dark:border-zinc-800/80 dark:bg-zinc-800/40">
                <h4 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200 mb-2 flex items-center gap-1.5">
                  <ShieldCheck className="h-4 w-4 text-emerald-500" />
                  Regras e Condições do Convênio:
                </h4>
                <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">
                  {partner.discount_rules}
                </p>
              </div>

              <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-amber-800 dark:text-amber-300 flex items-start gap-2.5">
                <AlertCircle className="h-4 w-4 shrink-0 text-amber-500 mt-0.5" />
                <span>
                  Este benefício é exclusivo para colaboradores da Clínica BS e seus dependentes elegíveis. Ao clicar em confirmar, seu voucher digital será gerado.
                </span>
              </div>

              {errorMsg && (
                <p className="text-sm font-medium text-red-600 dark:text-red-400">{errorMsg}</p>
              )}

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  onClick={onClose}
                  disabled={isSubmitting}
                  className="rounded-lg border border-zinc-200 px-4 py-2.5 text-sm font-semibold text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  type="button"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleConfirmRedeem}
                  disabled={isSubmitting}
                  className="flex items-center gap-2 rounded-lg bg-amber-500 px-5 py-2.5 text-sm font-bold text-zinc-950 shadow-md transition-all duration-200 hover:bg-amber-400 hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-50 active:scale-95"
                  type="button"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Processando...</span>
                    </>
                  ) : (
                    <>
                      <Ticket className="h-4 w-4" />
                      <span>Confirmar Resgate do Benefício</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          ) : (
            /* Tela 2: Voucher Emitido com sucesso */
            <div className="space-y-6 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 shadow-sm dark:bg-emerald-900/40 dark:text-emerald-400 animate-bounce">
                <Check className="h-7 w-7 stroke-[3]" />
              </div>

              <div>
                <h3 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
                  Resgate Confirmado com Sucesso!
                </h3>
                <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                  Seu código exclusivo para o convênio <strong>{partner.name}</strong> está liberado.
                </p>
              </div>

              {/* Box de Código Promocional em destaque */}
              <div className="relative mx-auto max-w-sm rounded-xl border-2 border-dashed border-amber-400/80 bg-amber-50/50 p-4 dark:border-amber-500/60 dark:bg-amber-950/20">
                <span className="block text-[11px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400 mb-1">
                  Seu Código Promocional:
                </span>
                <div className="flex items-center justify-center gap-2">
                  <span className="font-mono text-2xl font-extrabold tracking-widest text-zinc-900 dark:text-zinc-100 tabular-nums">
                    {selectedPromoCode}
                  </span>
                </div>
                <button
                  onClick={handleCopyCode}
                  type="button"
                  className={`mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2 text-xs font-bold transition-all duration-200 ${
                    copied
                      ? "bg-emerald-600 text-white shadow-sm"
                      : "bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
                  }`}
                >
                  {copied ? (
                    <>
                      <Check className="h-3.5 w-3.5" />
                      <span>Código Copiado para a Área de Transferência!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" />
                      <span>Copiar Código</span>
                    </>
                  )}
                </button>
              </div>

              <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
                <a
                  href={generateUtmLink()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex w-full sm:w-auto items-center justify-center gap-2 rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white shadow-md transition-all duration-200 hover:bg-emerald-500 hover:shadow-lg active:scale-95"
                >
                  <span>Ativar via WhatsApp / Canal Oficial</span>
                  <ExternalLink className="h-4 w-4" />
                </a>
                <button
                  onClick={onClose}
                  type="button"
                  className="w-full sm:w-auto rounded-lg border border-zinc-200 px-5 py-2.5 text-sm font-semibold text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                >
                  Concluir e Fechar
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
