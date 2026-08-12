"use client";

import { useState, useEffect } from "react";
import { User, Shield, Bell, Briefcase, Phone, Palette, Sparkles, Key, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { createClient } from "@/utils/supabase/client";
import { useTheme, type Theme } from "@/components/theme/ThemeProvider";

export function UserProfile() {
  const { theme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("perfil");
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  
  // Dados básicos
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [userId, setUserId] = useState("");
  const [permissions, setPermissions] = useState<Record<string, unknown>>({});
  
  // Personalização Estendida
  const [customRole, setCustomRole] = useState("Especialista em Gestão de Pessoas");
  const [customPhone, setCustomPhone] = useState("");
  const [userStatus, setUserStatus] = useState("online"); // online, busy, focus
  const [userBio, setUserBio] = useState("Focado(a) na excelência e bem-estar organizacional.");
  // A fonte de verdade do tema é o ThemeProvider; o banco só guarda para valer entre dispositivos.
  const themePref = theme;
  const changeTheme = (next: Theme) => setTheme(next);

  // Preferências de Notificação
  const [preferences, setPreferences] = useState({ trial: true, rgs: true, benefits: true, profile: true });
  const [savingPrefs, setSavingPrefs] = useState(false);

  useEffect(() => {
    const fetchUser = async () => {
      const supabase = createClient();
      const { data } = await supabase.auth.getUser();
      if (data.user?.email) {
        setEmail(data.user.email);
        setUserId(data.user.id);
        
        const { data: prof } = await supabase.from('profiles').select('name, permissions').eq('id', data.user.id).maybeSingle();
        if (prof) {
          setName(prof.name || data.user.email.split('@')[0]);
          setPermissions(prof.permissions || {});
          setPreferences(prof.permissions?._preferences || { trial: true, rgs: true, benefits: true, profile: true });
          
          const custom = prof.permissions?._custom_profile || {};
          if (custom.role) setCustomRole(custom.role);
          if (custom.phone) setCustomPhone(custom.phone);
          if (custom.status) setUserStatus(custom.status);
          if (custom.bio) setUserBio(custom.bio);
          // Preferência salva em outro dispositivo passa a valer aqui.
          if (custom.theme === "light" || custom.theme === "dark" || custom.theme === "system") setTheme(custom.theme);
        }
      }
    };
    if (open) fetchUser();
  }, [open]);

  const handleSaveAllPreferences = async () => {
    if (!userId) return;
    setSavingPrefs(true);
    setSuccess("");
    setError("");
    const supabase = createClient();
    
    const updatedCustomProfile = {
      role: customRole,
      phone: customPhone,
      status: userStatus,
      bio: userBio,
      theme: themePref
    };

    const updatedPermissions = { 
      ...permissions, 
      _preferences: preferences,
      _custom_profile: updatedCustomProfile
    };

    const { error: updateError } = await supabase.from('profiles').update({ permissions: updatedPermissions }).eq('id', userId);
    setSavingPrefs(false);
    if (updateError) {
      setError("Erro ao salvar personalização e preferências.");
    } else {
      setPermissions(updatedPermissions);
      setSuccess("Personalização e preferências salvas com sucesso!");
      setTimeout(() => setSuccess(""), 3000);
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    const supabase = createClient();
    
    // Update Auth
    const { error: authError } = await supabase.auth.updateUser({
      email,
      data: { name }
    });

    if (userId) {
      const updatedCustomProfile = {
        role: customRole,
        phone: customPhone,
        status: userStatus,
        bio: userBio,
        theme: themePref
      };
      const updatedPermissions = { ...permissions, _custom_profile: updatedCustomProfile };
      await supabase.from('profiles').update({ name, permissions: updatedPermissions }).eq('id', userId);
    }

    // Update password se os campos de senha foram preenchidos
    if (newPassword) {
      if (!oldPassword) {
        setLoading(false);
        setError("Informe a senha atual para realizar a troca de senha.");
        return;
      }
      
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password: oldPassword,
      });

      if (signInError) {
        setLoading(false);
        setError("A senha atual informada está incorreta.");
        return;
      }

      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (updateError) {
        setError("Erro ao atualizar senha: " + updateError.message);
        setLoading(false);
        return;
      }
    }

    setLoading(false);

    if (authError) {
      setError("Erro ao atualizar perfil: " + authError.message);
    } else {
      setSuccess("Dados do perfil atualizados com sucesso!");
      setOldPassword("");
      setNewPassword("");
      setTimeout(() => setSuccess(""), 3000);
    }
  };

  const getInitials = (str: string) => {
    if (!str) return "GP";
    const parts = str.trim().split(" ");
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  const getStatusColor = (st: string) => {
    switch (st) {
      case "busy": return "bg-red-500 border-red-200 dark:border-red-950";
      case "focus": return "bg-amber-500 border-amber-200 dark:border-amber-950";
      default: return "bg-emerald-500 border-emerald-200 dark:border-emerald-950";
    }
  };

  const getStatusText = (st: string) => {
    switch (st) {
      case "busy": return "Em Reunião / Ocupado";
      case "focus": return "Modo Foco / Retorno posterior";
      default: return "Online / Disponível";
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<button className="relative flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-tr from-primary/80 to-indigo-600 text-white shadow-sm hover:opacity-95 hover:shadow transition-all font-semibold text-xs" />}>
        {name ? getInitials(name) : <User className="h-4 w-4 text-white" />}
        <span className={`absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-background ${getStatusColor(userStatus)}`} />
      </DialogTrigger>
      
      <DialogContent className="sm:max-w-2xl p-0 overflow-hidden rounded-2xl shadow-2xl border bg-card">
        {/* Banner / Header Visual */}
        <div className="relative bg-gradient-to-r from-primary via-indigo-600 to-purple-600 p-6 text-white overflow-hidden">
          <div className="absolute top-[-40px] right-[-40px] w-48 h-48 bg-white/10 rounded-full blur-2xl pointer-events-none" />
          <div className="relative z-10 flex items-center gap-5">
            <div className="relative flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-md border border-white/30 text-2xl font-bold tracking-tight shadow-inner text-white">
              {getInitials(name)}
              <span className={`absolute -bottom-1 -right-1 h-5 w-5 rounded-full border-4 border-card ${getStatusColor(userStatus)}`} title={getStatusText(userStatus)} />
            </div>
            <div className="space-y-1 flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <DialogTitle className="text-2xl font-bold tracking-tight truncate text-white">{name || "Usuário"}</DialogTitle>
                <span className="text-[10px] font-bold tracking-widest uppercase px-2 py-0.5 rounded-full bg-white/20 backdrop-blur-sm border border-white/20 shrink-0">
                  {customRole}
                </span>
              </div>
              <DialogDescription className="text-white/80 text-sm truncate">
                {email} • <span className="font-medium text-white/95">{getStatusText(userStatus)}</span>
              </DialogDescription>
              <p className="text-xs text-white/70 italic pt-1 truncate">&quot;{userBio}&quot;</p>
            </div>
          </div>
        </div>

        <div className="p-6 pt-4">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-3 h-11 p-1 bg-muted/60 rounded-xl mb-6">
              <TabsTrigger value="perfil" className="text-sm font-medium rounded-lg data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-sm transition-all flex items-center justify-center gap-2">
                <Sparkles className="w-4 h-4 text-indigo-500" /> Personalização
              </TabsTrigger>
              <TabsTrigger value="security" className="text-sm font-medium rounded-lg data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-sm transition-all flex items-center justify-center gap-2">
                <Shield className="w-4 h-4 text-emerald-500" /> Segurança & Acesso
              </TabsTrigger>
              <TabsTrigger value="notifications" className="text-sm font-medium rounded-lg data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-sm transition-all flex items-center justify-center gap-2">
                <Bell className="w-4 h-4 text-amber-500" /> Alertas & Avisos
              </TabsTrigger>
            </TabsList>

            {/* ABA: PERSONALIZAÇÃO & DADOS */}
            <TabsContent value="perfil" className="space-y-5">
              <form onSubmit={handleUpdateProfile} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="profile_name" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Nome Completo</Label>
                    <Input
                      id="profile_name"
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Seu nome"
                      required
                      className="h-10 rounded-lg"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="profile_role" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <Briefcase className="w-3.5 h-3.5 text-indigo-500" /> Cargo / Especialidade no RH
                    </Label>
                    <Input
                      id="profile_role"
                      type="text"
                      value={customRole}
                      onChange={(e) => setCustomRole(e.target.value)}
                      placeholder="Ex: Especialista em Recrutamento"
                      className="h-10 rounded-lg"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="profile_email" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">E-mail Corporativo</Label>
                    <Input
                      id="profile_email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="h-10 rounded-lg"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="profile_phone" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5 text-emerald-500" /> Ramal / Telefone de Contato
                    </Label>
                    <Input
                      id="profile_phone"
                      type="text"
                      value={customPhone}
                      onChange={(e) => setCustomPhone(e.target.value)}
                      placeholder="(53) 99999-9999 / Ramal 204"
                      className="h-10 rounded-lg"
                    />
                  </div>

                  <div className="space-y-1.5 col-span-2 md:col-span-1">
                    <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      Status de Atividade
                    </Label>
                    <select
                      value={userStatus}
                      onChange={(e) => setUserStatus(e.target.value)}
                      className="flex h-10 w-full rounded-lg border border-input bg-background px-3 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-primary"
                    >
                      <option value="online">🟢 Online / Disponível</option>
                      <option value="focus">🟡 Modo Foco / Trabalhando em Projeto</option>
                      <option value="busy">🔴 Ocupado / Em Reunião ou Entrevistas</option>
                    </select>
                  </div>

                  <div className="space-y-1.5 col-span-2 md:col-span-1">
                    <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <Palette className="w-3.5 h-3.5 text-purple-500" /> Preferência de Tema
                    </Label>
                    <select
                      value={themePref}
                      onChange={(e) => changeTheme(e.target.value as Theme)}
                      className="flex h-10 w-full rounded-lg border border-input bg-background px-3 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-primary"
                    >
                      <option value="system">⚡ Sincronizar com Sistema (Auto)</option>
                      <option value="light">☀️ Modo Claro Executivo</option>
                      <option value="dark">🌙 Modo Escuro Moderno</option>
                    </select>
                  </div>

                  <div className="space-y-1.5 col-span-2">
                    <Label htmlFor="profile_bio" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Frase de Perfil / Bio</Label>
                    <Input
                      id="profile_bio"
                      value={userBio}
                      onChange={(e) => setUserBio(e.target.value)}
                      placeholder="Escreva uma frase que resuma seu estilo de trabalho..."
                      className="h-10 rounded-lg"
                    />
                  </div>
                </div>

                {error && <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm font-medium">{error}</div>}
                {success && <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-sm font-medium flex items-center gap-2"><CheckCircle2 className="w-4 h-4" />{success}</div>}

                <div className="flex justify-end items-center gap-3 pt-4 border-t mt-6">
                  <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Fechar</Button>
                  <Button type="button" onClick={handleSaveAllPreferences} variant="secondary" disabled={savingPrefs}>
                    {savingPrefs ? "Salvando..." : "Salvar Personalização"}
                  </Button>
                  <Button type="submit" disabled={loading} className="bg-primary hover:bg-primary/90 text-primary-foreground font-medium px-6 rounded-lg shadow-sm">
                    {loading ? "Atualizando..." : "Salvar Perfil Completo"}
                  </Button>
                </div>
              </form>
            </TabsContent>

            {/* ABA: SEGURANÇA & CREDENCIAIS */}
            <TabsContent value="security" className="space-y-5">
              <form onSubmit={handleUpdateProfile} className="space-y-4">
                <div className="p-4 rounded-xl border bg-muted/30 space-y-2">
                  <div className="flex items-center gap-2 font-semibold text-sm">
                    <Key className="w-4 h-4 text-primary" /> Alterar Senha de Acesso
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Recomendamos o uso de senhas fortes contendo letras maiúsculas, números e caracteres especiais. Preencha os campos abaixo apenas se desejar trocar sua senha.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="old_password">Senha Atual</Label>
                    <Input
                      id="old_password"
                      type="password"
                      placeholder="••••••••"
                      value={oldPassword}
                      onChange={(e) => setOldPassword(e.target.value)}
                      className="h-10 rounded-lg"
                    />
                  </div>
                  
                  <div className="space-y-1.5">
                    <Label htmlFor="new_password">Nova Senha</Label>
                    <Input
                      id="new_password"
                      type="password"
                      placeholder="Mínimo de 8 caracteres..."
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="h-10 rounded-lg"
                    />
                  </div>
                </div>

                {error && <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm font-medium">{error}</div>}
                {success && <div className="p-3 rounded-lg bg-emerald-500/10 text-emerald-600 text-sm font-medium flex items-center gap-2"><CheckCircle2 className="w-4 h-4" />{success}</div>}

                <div className="flex justify-end gap-3 pt-6 border-t">
                  <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
                  <Button type="submit" disabled={loading} className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg px-6 shadow-sm">
                    {loading ? "Atualizando..." : "Atualizar Senha"}
                  </Button>
                </div>
              </form>
            </TabsContent>

            {/* ABA: ALERTAS & NOTIFICAÇÕES */}
            <TabsContent value="notifications" className="space-y-5">
              <div className="p-4 rounded-xl border bg-amber-500/5 border-amber-500/20 mb-4">
                <p className="text-xs text-amber-800 dark:text-amber-200">
                  ⚙️ <strong>Sinalizações do Sininho:</strong> Configure aqui quais eventos corporativos e notificações de rotina devem aparecer no seu painel de alertas do sistema.
                </p>
              </div>

              <div className="space-y-3 divide-y border rounded-xl p-4 bg-card shadow-sm">
                <div className="flex items-center justify-between pt-1 pb-3">
                  <div className="space-y-0.5">
                    <Label className="text-sm font-semibold flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-red-500" /> Fim de Experiência & Contratos
                    </Label>
                    <p className="text-xs text-muted-foreground">Alertas sobre colaboradores atingindo 30, 45 ou 90 dias de contrato.</p>
                  </div>
                  <Switch checked={preferences.trial} onCheckedChange={(c) => setPreferences({...preferences, trial: c})} />
                </div>
                
                <div className="flex items-center justify-between pt-3 pb-3">
                  <div className="space-y-0.5">
                    <Label className="text-sm font-semibold flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-blue-500" /> RGS Pendentes & Autorizações
                    </Label>
                    <p className="text-xs text-muted-foreground">Notifica quando há novas Requisições de Gestão de Serviço em aberto.</p>
                  </div>
                  <Switch checked={preferences.rgs} onCheckedChange={(c) => setPreferences({...preferences, rgs: c})} />
                </div>

                <div className="flex items-center justify-between pt-3 pb-3">
                  <div className="space-y-0.5">
                    <Label className="text-sm font-semibold flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-emerald-500" /> Inclusão e Corte de Benefícios
                    </Label>
                    <p className="text-xs text-muted-foreground">Avisos diários de movimentações pendentes no plano de benefícios.</p>
                  </div>
                  <Switch checked={preferences.benefits} onCheckedChange={(c) => setPreferences({...preferences, benefits: c})} />
                </div>

                <div className="flex items-center justify-between pt-3 pb-1">
                  <div className="space-y-0.5">
                    <Label className="text-sm font-semibold flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-purple-500" /> Cadastros e Auditoria Incompletos
                    </Label>
                    <p className="text-xs text-muted-foreground">Sinaliza colaboradores com documentos ou dados curriculares faltantes.</p>
                  </div>
                  <Switch checked={preferences.profile} onCheckedChange={(c) => setPreferences({...preferences, profile: c})} />
                </div>
              </div>

              {error && <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm font-medium">{error}</div>}
              {success && <div className="p-3 rounded-lg bg-emerald-500/10 text-emerald-600 text-sm font-medium flex items-center gap-2"><CheckCircle2 className="w-4 h-4" />{success}</div>}

              <div className="flex justify-end items-center gap-3 pt-4 border-t mt-4">
                <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
                <Button type="button" onClick={handleSaveAllPreferences} disabled={savingPrefs} className="bg-primary hover:bg-primary/90 text-white font-medium px-6 rounded-lg shadow-sm">
                  {savingPrefs ? "Salvando..." : "Salvar Configurações de Alerta"}
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}
