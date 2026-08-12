"use client";

import React, { useState, useEffect, useRef } from "react";
import { DiscountPartner } from "@/types/benefits";
import { createClient } from "@/utils/supabase/client";
import { X, Check, Copy, ShieldCheck, Loader2, Gift, Phone, AlertCircle, ExternalLink } from "lucide-react";

interface RedeemModalProps {
  partner: DiscountPartner | null;
  isOpen: boolean;
  onClose: () => void;
}

export const RedeemModal: React.FC<RedeemModalProps> = ({ partner, isOpen, onClose }) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const supabase = createClient();

  // Reset de estado quando abre/fecha ou troca de parceiro. Ajuste durante o render
  // (padrão do React para estado derivado de prop): acontece antes da pintura, sem
  // o render extra que um efeito causaria.
  const resetKey = `${isOpen}|${partner?.id ?? ""}`;
  const [lastResetKey, setLastResetKey] = useState(resetKey);
  if (lastResetKey !== resetKey) {
    setLastResetKey(resetKey);
    if (isOpen && partner) {
      setConfirmed(false);
      setIsSubmitting(false);
      setErrorMsg(null);
      setCopied(false);
    }
  }

  // Suporte acessível para fechar via ESC e foco no teclado
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
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

  // Registra o interesse do colaborador no parceiro (sem gerar código de validação)
  const handleConfirmInterest = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const { data: authData } = await supabase.auth.getUser();
      const employeeId = authData?.user?.id;

      // partner_leads exige colaborador autenticado (RLS); sem login, so exibe o contato mesmo assim
      if (employeeId) {
        const { error } = await supabase
          .from("partner_leads")
          .insert({
            partner_id: partner.id,
            employee_id: employeeId,
            status: "resgatado"
          });

        if (error && error.code !== "PGRST205" && !error.message.includes("not find the table")) {
          console.error("Erro ao registrar lead no Supabase:", error);
        }
      }
      setConfirmed(true);
    } catch (err: unknown) {
      console.error("Exceção ao registrar interesse:", err);
      setConfirmed(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopyContact = () => {
    navigator.clipboard.writeText(partner.contact_info || "");
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
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
        {/* Top Header */}
        <div className="relative flex items-center justify-between border-b border-zinc-100 bg-gradient-to-r from-zinc-900 to-zinc-800 px-6 py-4 text-white dark:border-zinc-800 dark:from-zinc-950 dark:to-zinc-900">
          <div className="flex items-center gap-2">
            <Gift className="h-5 w-5 text-amber-400" />
            <h2 id="modal-title" className="text-base font-semibold tracking-tight">
              Como usar este benefício
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
        <div className="p-6 space-y-6">
          <div className="flex items-center gap-4">
            <div className={`flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-zinc-200 shadow-xs dark:border-zinc-700 ${partner.logo_dark_mask ? 'bg-zinc-900' : 'bg-zinc-50 dark:bg-zinc-800'}`}>
              {partner.logo_url ? (
                <img src={partner.logo_url} alt={partner.name} className="h-full w-full object-cover" style={{ objectPosition: partner.logo_position || 'center' }} />
              ) : (
                <Gift className="h-8 w-8 text-amber-500" />
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
              Regras e Condições do Convênio
            </h4>
            <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">
              {partner.discount_rules}
            </p>
          </div>

          {partner.how_to_use && (
            <div className="rounded-xl border border-zinc-100 bg-zinc-50 p-4 dark:border-zinc-800/80 dark:bg-zinc-800/40">
              <h4 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200 mb-2 flex items-center gap-1.5">
                <Gift className="h-4 w-4 text-amber-500" />
                Como Utilizar
              </h4>
              <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-300 whitespace-pre-line">
                {partner.how_to_use}
              </p>
            </div>
          )}

          {/* Contato do parceiro — sem código, contato direto */}
          {partner.contact_info && (
            <div className="relative rounded-xl border-2 border-dashed border-amber-400/80 bg-amber-50/50 p-4 dark:border-amber-500/60 dark:bg-amber-950/20">
              <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400 mb-2">
                <Phone className="h-3.5 w-3.5" />
                Contato do Parceiro
              </span>
              <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 whitespace-pre-line mb-3">
                {partner.contact_info}
              </p>
              <button
                onClick={handleCopyContact}
                type="button"
                className={`inline-flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2 text-xs font-bold transition-all duration-200 ${
                  copied
                    ? "bg-emerald-600 text-white shadow-sm"
                    : "bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
                }`}
              >
                {copied ? (
                  <>
                    <Check className="h-3.5 w-3.5" />
                    <span>Contato Copiado!</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" />
                    <span>Copiar Contato</span>
                  </>
                )}
              </button>
            </div>
          )}

          {partner.instagram_url && (
            <div className="relative rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800/80 dark:bg-zinc-800/40 mt-4">
              <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-pink-600 dark:text-pink-400 mb-2">
                <ExternalLink className="h-3.5 w-3.5" />
                Link Adicional
              </span>
              <a
                href={partner.instagram_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-pink-50 px-4 py-2.5 text-xs font-bold text-pink-700 transition-colors hover:bg-pink-100 dark:bg-pink-950/30 dark:text-pink-400 dark:hover:bg-pink-900/40"
              >
                <span>Acessar Link do Parceiro</span>
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          )}

          <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-amber-800 dark:text-amber-300 flex items-start gap-2.5">
            <AlertCircle className="h-4 w-4 shrink-0 text-amber-500 mt-0.5" />
            <span>
              Este benefício é exclusivo para colaboradores ACPO e seus dependentes elegíveis. Entre em contato diretamente com o parceiro pelo canal acima para utilizar.
            </span>
          </div>

          {errorMsg && (
            <p className="text-sm font-medium text-red-600 dark:text-red-400">{errorMsg}</p>
          )}

          <div className="flex items-center justify-end gap-3 pt-2 border-t border-zinc-100 dark:border-zinc-800">
            {confirmed ? (
              <div className="w-full flex items-center justify-center gap-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 text-emerald-700 dark:text-emerald-400 py-2.5 text-sm font-semibold">
                <Check className="h-4 w-4" />
                <span>Interesse registrado! Já pode entrar em contato.</span>
              </div>
            ) : (
              <>
                <button
                  onClick={onClose}
                  disabled={isSubmitting}
                  className="rounded-lg border border-zinc-200 px-4 py-2.5 text-sm font-semibold text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  type="button"
                >
                  Fechar
                </button>
                <button
                  onClick={handleConfirmInterest}
                  disabled={isSubmitting}
                  className="flex items-center gap-2 rounded-lg bg-amber-500 px-5 py-2.5 text-sm font-bold text-zinc-950 shadow-md transition-all duration-200 hover:bg-amber-400 hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-50 active:scale-95"
                  type="button"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Registrando...</span>
                    </>
                  ) : (
                    <>
                      <Gift className="h-4 w-4" />
                      <span>Tenho Interesse</span>
                    </>
                  )}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
