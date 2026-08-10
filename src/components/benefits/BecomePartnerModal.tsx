"use client";

import React, { useState, useEffect, useRef } from "react";
import { createClient } from "@/utils/supabase/client";
import { X, Check, Loader2, Building, User, Mail, Phone, Rocket } from "lucide-react";

interface BecomePartnerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const BecomePartnerModal: React.FC<BecomePartnerModalProps> = ({ isOpen, onClose }) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  const [form, setForm] = useState({
    company_name: "",
    contact_name: "",
    email: "",
    phone: ""
  });

  const modalRef = useRef<HTMLDivElement>(null);
  const supabase = createClient();

  // Reset de estado quando abre/fecha
  useEffect(() => {
    if (isOpen) {
      setConfirmed(false);
      setIsSubmitting(false);
      setErrorMsg(null);
      setForm({
        company_name: "",
        contact_name: "",
        email: "",
        phone: ""
      });
    }
  }, [isOpen]);

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

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (!form.company_name || !form.contact_name || !form.email || !form.phone) {
      setErrorMsg("Por favor, preencha todos os campos obrigatórios.");
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const { error } = await supabase
        .from("partner_prospects")
        .insert({
          company_name: form.company_name,
          contact_name: form.contact_name,
          email: form.email,
          phone: form.phone
        });

      if (error) {
        throw error;
      }
      
      setConfirmed(true);
    } catch (err: any) {
      console.error("Erro ao enviar candidatura:", err);
      setErrorMsg(err.message || "Não foi possível enviar sua solicitação. Tente novamente mais tarde.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
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
        <div className="relative flex items-center justify-between border-b border-zinc-100 bg-gradient-to-r from-amber-600 to-amber-500 px-6 py-4 text-white dark:border-zinc-800">
          <div className="flex items-center gap-2">
            <Rocket className="h-5 w-5 text-white" />
            <h2 id="modal-title" className="text-base font-semibold tracking-tight">
              Seja um Parceiro ACPO
            </h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-amber-100 hover:bg-white/20 hover:text-white transition-colors focus:outline-hidden focus:ring-2 focus:ring-white"
            aria-label="Fechar"
            type="button"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Conteúdo do Modal */}
        <div className="p-6">
          {confirmed ? (
            <div className="flex flex-col items-center justify-center py-8 text-center space-y-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400">
                <Check className="h-8 w-8" />
              </div>
              <h3 className="text-xl font-bold text-zinc-900 dark:text-white">Solicitação Enviada!</h3>
              <p className="text-sm text-zinc-600 dark:text-zinc-300 max-w-sm">
                Obrigado pelo interesse em fazer parte do nosso Clube de Descontos. Nossa equipe entrará em contato em breve para alinharmos os detalhes da parceria.
              </p>
              <button
                onClick={onClose}
                className="mt-4 rounded-lg bg-zinc-900 px-6 py-2.5 text-sm font-bold text-white shadow-sm transition-all duration-200 hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
                type="button"
              >
                Fechar
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <p className="text-sm text-zinc-600 dark:text-zinc-300 mb-6">
                Preencha os dados abaixo e entraremos em contato para apresentar as vantagens de expor a sua marca para os nossos colaboradores.
              </p>

              <div className="space-y-1.5">
                <label htmlFor="company_name" className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                  Nome da Empresa <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Building className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                  <input
                    type="text"
                    id="company_name"
                    name="company_name"
                    value={form.company_name}
                    onChange={handleChange}
                    required
                    className="w-full rounded-lg border border-zinc-200 bg-white py-2 pl-10 pr-3 text-sm text-zinc-900 focus:border-amber-500 focus:outline-hidden focus:ring-1 focus:ring-amber-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                    placeholder="Sua Empresa"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="contact_name" className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                  Nome do Contato <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                  <input
                    type="text"
                    id="contact_name"
                    name="contact_name"
                    value={form.contact_name}
                    onChange={handleChange}
                    required
                    className="w-full rounded-lg border border-zinc-200 bg-white py-2 pl-10 pr-3 text-sm text-zinc-900 focus:border-amber-500 focus:outline-hidden focus:ring-1 focus:ring-amber-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                    placeholder="Seu nome"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label htmlFor="email" className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                    E-mail <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                    <input
                      type="email"
                      id="email"
                      name="email"
                      value={form.email}
                      onChange={handleChange}
                      required
                      className="w-full rounded-lg border border-zinc-200 bg-white py-2 pl-10 pr-3 text-sm text-zinc-900 focus:border-amber-500 focus:outline-hidden focus:ring-1 focus:ring-amber-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                      placeholder="contato@empresa.com"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="phone" className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                    Telefone / WhatsApp <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                    <input
                      type="text"
                      id="phone"
                      name="phone"
                      value={form.phone}
                      onChange={handleChange}
                      required
                      className="w-full rounded-lg border border-zinc-200 bg-white py-2 pl-10 pr-3 text-sm text-zinc-900 focus:border-amber-500 focus:outline-hidden focus:ring-1 focus:ring-amber-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                      placeholder="(00) 00000-0000"
                    />
                  </div>
                </div>
              </div>

              {errorMsg && (
                <div className="rounded-md bg-red-50 p-3 mt-4 border border-red-100 dark:bg-red-900/20 dark:border-red-900/50">
                  <p className="text-sm font-medium text-red-600 dark:text-red-400">{errorMsg}</p>
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-100 dark:border-zinc-800 mt-6">
                <button
                  onClick={onClose}
                  disabled={isSubmitting}
                  className="rounded-lg border border-zinc-200 px-4 py-2.5 text-sm font-semibold text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  type="button"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex items-center gap-2 rounded-lg bg-amber-500 px-5 py-2.5 text-sm font-bold text-zinc-950 shadow-md transition-all duration-200 hover:bg-amber-400 hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-50 active:scale-95"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Enviando...</span>
                    </>
                  ) : (
                    <>
                      <span>Enviar Solicitação</span>
                      <Rocket className="h-4 w-4" />
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
