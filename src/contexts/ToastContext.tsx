"use client";

import { createContext, useCallback, useContext, useState, ReactNode } from "react";

export type ToastVariant = "success" | "error" | "warning";

type Toast = { id: number; message: string; variant: ToastVariant };

interface ToastContextData {
  toast: (message: string, variant?: ToastVariant) => void;
}

const ToastContext = createContext<ToastContextData>({ toast: () => {} });

export function useToast() {
  return useContext(ToastContext);
}

const VARIANT_CLASS: Record<ToastVariant, string> = {
  success: "border-green-600/40 bg-green-600 text-white",
  error: "border-red-600/40 bg-red-600 text-white",
  warning: "border-amber-500/40 bg-amber-500 text-black",
};

const DURATION = 4000;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (message: string, variant: ToastVariant = "success") => {
      const id = Date.now() + Math.random();
      setToasts((prev) => [...prev, { id, message, variant }]);
      setTimeout(() => dismiss(id), DURATION);
    },
    [dismiss]
  );

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      {/* z-[100] fica acima do overlay dos modais (z-[60]) */}
      <div
        role="status"
        aria-live="polite"
        className="print:hidden pointer-events-none fixed bottom-4 right-4 z-[100] flex w-[min(22rem,calc(100vw-2rem))] flex-col gap-2"
      >
        {toasts.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => dismiss(t.id)}
            className={`pointer-events-auto motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 rounded-md border px-4 py-3 text-left text-sm shadow-lg ${VARIANT_CLASS[t.variant]}`}
          >
            {t.message}
          </button>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
