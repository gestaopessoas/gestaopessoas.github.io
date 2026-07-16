"use client";

import { useState, useEffect } from "react";
import { User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { createClient } from "@/utils/supabase/client";

export function UserProfile() {
  const [open, setOpen] = useState(false);
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [email, setEmail] = useState("");

  useEffect(() => {
    const fetchUser = async () => {
      const supabase = createClient();
      const { data } = await supabase.auth.getUser();
      if (data.user?.email) {
        setEmail(data.user.email);
      }
    };
    fetchUser();
  }, []);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!oldPassword || !newPassword) return;

    setLoading(true);
    setError("");
    setSuccess("");

    const supabase = createClient();
    
    // First verify old password by attempting to sign in
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password: oldPassword,
    });

    if (signInError) {
      setLoading(false);
      setError("Senha atual incorreta.");
      return;
    }

    // Now change to new password
    const { error: updateError } = await supabase.auth.updateUser({
      password: newPassword
    });

    setLoading(false);

    if (updateError) {
      setError("Erro ao atualizar senha: " + updateError.message);
    } else {
      setSuccess("Senha atualizada com sucesso!");
      setOldPassword("");
      setNewPassword("");
      setTimeout(() => setOpen(false), 2000);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<button className="flex h-8 w-8 items-center justify-center rounded-full bg-muted hover:bg-muted/80 transition-colors" />}>
        <User className="h-5 w-5 text-muted-foreground" />
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Configurar Perfil</DialogTitle>
          <DialogDescription>
            Altere sua senha de acesso. Informe sua senha atual para autorizar a mudança.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleChangePassword} className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="old_password">Senha Atual</Label>
            <Input
              id="old_password"
              type="password"
              value={oldPassword}
              onChange={(e) => setOldPassword(e.target.value)}
              required
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="new_password">Nova Senha</Label>
            <Input
              id="new_password"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
            />
          </div>

          {error && <div className="text-sm text-destructive font-medium">{error}</div>}
          {success && <div className="text-sm text-green-600 font-medium">{success}</div>}

          <DialogFooter className="mt-4 pt-4">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button type="submit" disabled={loading}>{loading ? "Alterando..." : "Alterar Senha"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
