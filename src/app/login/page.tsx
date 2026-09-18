"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/utils/supabase/client";
import { Eye, EyeOff, LogIn } from "lucide-react";
import { useState } from "react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const supabase = createClient();
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password.trim(),
      });

      if (error || !data.session) {
        setError(error?.message || "E-mail ou senha invalidos.");
        setLoading(false);
        return;
      }

      window.location.assign("/dashboard/vagas/");
    } catch (error) {
      setError(error instanceof Error ? error.message : "Nao foi possivel entrar agora.");
      setLoading(false);
    }
  };

  return (
    <main className="grid min-h-screen place-items-center bg-muted/40 px-4">
      <form onSubmit={submit} className="w-full max-w-sm">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Entrar</CardTitle>
            <CardDescription>Acesse o painel de gestao de pessoas da ACPO.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            {error && <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}
            <div className="grid gap-2">
              <Label htmlFor="email">E-mail</Label>
              <Input id="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password">Senha</Label>
              {/* O olho fica DENTRO do campo: `relative` no invólucro, e o padding à direita
                  reserva a área do botão para o texto digitado não passar por baixo dele. */}
              <div className="relative">
                <Input
                  id="password"
                  type={mostrarSenha ? "text" : "password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="pr-10"
                  required
                />
                <button
                  type="button"
                  onClick={() => setMostrarSenha((visivel) => !visivel)}
                  // `aria-pressed` em vez de trocar só o ícone: quem usa leitor de tela
                  // precisa saber se a senha está exposta agora, não só que há um botão.
                  aria-pressed={mostrarSenha}
                  aria-label={mostrarSenha ? "Ocultar senha" : "Mostrar senha"}
                  className="absolute inset-y-0 right-0 grid w-10 place-items-center rounded-md text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {mostrarSenha ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </CardContent>
          <CardFooter>
            <Button type="submit" className="w-full" disabled={loading}>
              <LogIn className="mr-2 h-4 w-4" />
              {loading ? "Entrando..." : "Entrar"}
            </Button>
          </CardFooter>
        </Card>
      </form>
    </main>
  );
}
