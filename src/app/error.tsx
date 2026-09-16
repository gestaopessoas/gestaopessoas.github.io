"use client"

import { useEffect } from "react"
import { Button } from "@/components/ui/button"
import { AlertTriangle } from "lucide-react"

/**
 * Error boundary global. Antes disso, qualquer exceção de render virava tela
 * branca sem mensagem — impossível de diagnosticar com o usuário no telefone.
 * Agora a mensagem aparece na tela e no console.
 */
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[erro-de-tela]", error)
  }, [error])

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-8 text-center">
      <AlertTriangle className="h-10 w-10 text-destructive" aria-hidden="true" />
      <h2 className="text-lg font-semibold">Algo quebrou nesta tela</h2>
      <p className="max-w-xl break-words font-mono text-xs text-muted-foreground">
        {error.message || "Erro desconhecido"}
        {error.digest ? ` (digest: ${error.digest})` : ""}
      </p>
      <Button onClick={reset}>Tentar de novo</Button>
    </div>
  )
}
