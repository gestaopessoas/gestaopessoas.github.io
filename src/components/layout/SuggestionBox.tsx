"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { Lightbulb, Loader2 } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { useToast } from "@/contexts/ToastContext";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const LIMITE = 2000;

export function SuggestionBox() {
  const pathname = usePathname();
  const { toast } = useToast();
  const [aberto, setAberto] = useState(false);
  const [mensagem, setMensagem] = useState("");
  const [enviando, setEnviando] = useState(false);

  const enviar = async () => {
    const texto = mensagem.trim();
    if (!texto || enviando) return;

    setEnviando(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("improvement_suggestions")
      // user_id sai do default auth.uid() no banco: a policy exige que seja o próprio,
      // então mandar daqui só criaria uma forma de errar.
      .insert({ page_path: pathname, message: texto });
    setEnviando(false);

    if (error) {
      toast("Não consegui enviar sua sugestão. Tente de novo.", "error");
      return;
    }

    // Só limpa o campo depois do sucesso -- se falhou, o texto continua lá para reenviar.
    setMensagem("");
    setAberto(false);
    toast("Sugestão enviada. Obrigado!", "success");
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setAberto(true)}
        aria-label="Enviar sugestão de melhoria"
        title="Enviar sugestão de melhoria"
        className="print:hidden fixed bottom-6 right-6 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        <Lightbulb className="h-5 w-5" />
      </button>

      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Sugestão de melhoria</DialogTitle>
            <DialogDescription>
              O que está atrapalhando, ou o que faltou? Registramos junto a tela em que você
              está, então não precisa descrever onde.
            </DialogDescription>
          </DialogHeader>

          <Textarea
            value={mensagem}
            onChange={(e) => setMensagem(e.target.value.slice(0, LIMITE))}
            placeholder="Escreva sua sugestão..."
            className="min-h-[140px]"
            autoFocus
          />
          <p className="text-right text-xs text-muted-foreground">
            {mensagem.length}/{LIMITE}
          </p>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAberto(false)} disabled={enviando}>
              Cancelar
            </Button>
            <Button onClick={enviar} disabled={!mensagem.trim() || enviando}>
              {enviando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Enviar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
