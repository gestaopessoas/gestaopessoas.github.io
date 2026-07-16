"use client";

import { useState, useEffect } from "react";
import { User, Shield, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  const [userId, setUserId] = useState("");
  const [permissions, setPermissions] = useState<any>({});
  const [preferences, setPreferences] = useState({ trial: true, rgs: true, benefits: true, profile: true });
  const [savingPrefs, setSavingPrefs] = useState(false);

  useEffect(() => {
    const fetchUser = async () => {
      const supabase = createClient();
      const { data } = await supabase.auth.getUser();
      if (data.user?.email) {
        setEmail(data.user.email);
        setUserId(data.user.id);
        
        const { data: prof } = await supabase.from('profiles').select('permissions').eq('id', data.user.id).single();
        if (prof) {
          setPermissions(prof.permissions || {});
          setPreferences(prof.permissions?._preferences || { trial: true, rgs: true, benefits: true, profile: true });
        }
      }
    };
    if (open) fetchUser();
  }, [open]);

  const handleSavePreferences = async () => {
    if (!userId) return;
    setSavingPrefs(true);
    setSuccess("");
    setError("");
    const supabase = createClient();
    const updatedPermissions = { ...permissions, _preferences: preferences };
    const { error: updateError } = await supabase.from('profiles').update({ permissions: updatedPermissions }).eq('id', userId);
    setSavingPrefs(false);
    if (updateError) {
      setError("Erro ao salvar preferências.");
    } else {
      setSuccess("Preferências salvas com sucesso!");
      setTimeout(() => setSuccess(""), 3000);
    }
  };

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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Meu Perfil</DialogTitle>
          <DialogDescription>
            Gerencie sua conta e suas preferências do sistema.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="security" className="w-full">
          <TabsList className="grid w-full grid-cols-2 h-10 p-1 bg-muted/50 mb-4">
            <TabsTrigger value="security" className="text-sm rounded-md data-[state=active]:shadow-sm">
              <Shield className="w-4 h-4 mr-2" /> Segurança
            </TabsTrigger>
            <TabsTrigger value="notifications" className="text-sm rounded-md data-[state=active]:shadow-sm">
              <Bell className="w-4 h-4 mr-2" /> Notificações
            </TabsTrigger>
          </TabsList>

          <TabsContent value="security">
            <form onSubmit={handleChangePassword} className="space-y-4">
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

              <div className="flex justify-end gap-2 pt-4 border-t mt-4">
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
                <Button type="submit" disabled={loading}>{loading ? "Alterando..." : "Alterar Senha"}</Button>
              </div>
            </form>
          </TabsContent>

          <TabsContent value="notifications" className="space-y-6 pt-2">
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b pb-3">
                <div className="space-y-0.5">
                  <Label className="text-sm font-medium">Fim de Experiência</Label>
                  <p className="text-xs text-muted-foreground">Avisos sobre colaboradores próximos ao fim do contrato.</p>
                </div>
                <Switch checked={preferences.trial} onCheckedChange={(c) => setPreferences({...preferences, trial: c})} />
              </div>
              
              <div className="flex items-center justify-between border-b pb-3">
                <div className="space-y-0.5">
                  <Label className="text-sm font-medium">RGS Pendentes</Label>
                  <p className="text-xs text-muted-foreground">Alertas de Requisição de Gestão de Serviço em aberto.</p>
                </div>
                <Switch checked={preferences.rgs} onCheckedChange={(c) => setPreferences({...preferences, rgs: c})} />
              </div>

              <div className="flex items-center justify-between border-b pb-3">
                <div className="space-y-0.5">
                  <Label className="text-sm font-medium">Benefícios</Label>
                  <p className="text-xs text-muted-foreground">Notificações de inclusões e cortes pendentes.</p>
                </div>
                <Switch checked={preferences.benefits} onCheckedChange={(c) => setPreferences({...preferences, benefits: c})} />
              </div>

              <div className="flex items-center justify-between pb-1">
                <div className="space-y-0.5">
                  <Label className="text-sm font-medium">Cadastros Incompletos</Label>
                  <p className="text-xs text-muted-foreground">Avisos sobre informações faltantes de colaboradores.</p>
                </div>
                <Switch checked={preferences.profile} onCheckedChange={(c) => setPreferences({...preferences, profile: c})} />
              </div>
            </div>

            {error && <div className="text-sm text-destructive font-medium">{error}</div>}
            {success && <div className="text-sm text-green-600 font-medium">{success}</div>}

            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button type="button" onClick={handleSavePreferences} disabled={savingPrefs}>
                {savingPrefs ? "Salvando..." : "Salvar Preferências"}
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
