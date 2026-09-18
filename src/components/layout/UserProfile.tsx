"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { User, Shield, Bell, Briefcase, Phone, Key, CheckCircle2, Pencil, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { createClient } from "@/utils/supabase/client";
import { EmployeeAvatar } from "@/components/EmployeeAvatar";
import { resolveProfileFields, validarSenha, forcaSenha, AVISO_CADASTRO, SENHA_MINIMA } from "@/lib/profileFields.mjs";

type CampoTravado = "name" | "role" | "phone";

// Campo de texto que nasce bloqueado e só abre no lápis. Nome, cargo e telefone moram no
// cadastro de colaborador; editá-los aqui mexe no RH, então não podem abrir sozinhos.
function CampoComCadeado({
  id, label, icon, value, onChange, travado, aberto, onDestravar, loading,
}: {
  id: string; label: React.ReactNode; icon?: React.ReactNode; value: string;
  onChange: (v: string) => void; travado: boolean; aberto: boolean;
  onDestravar: () => void; loading: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
        {icon} {label}
      </Label>
      {loading ? (
        <div className="h-10 rounded-lg bg-muted animate-pulse" />
      ) : (
        <div className="relative">
          <Input
            id={id}
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            readOnly={travado && !aberto}
            className={`h-10 rounded-lg ${travado ? "pr-10" : ""} ${travado && !aberto ? "bg-muted/50 text-muted-foreground cursor-default" : ""}`}
          />
          {travado && (
            <button
              type="button"
              onClick={onDestravar}
              disabled={aberto}
              title={aberto ? "Campo liberado para edição" : "Editar (altera também o cadastro de colaborador)"}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground disabled:opacity-40"
            >
              {aberto ? <Pencil className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export function UserProfile() {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("perfil");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [saving, setSaving] = useState(false);

  // Dados básicos
  const [email, setEmail] = useState("");
  const [userId, setUserId] = useState("");
  const [employeeId, setEmployeeId] = useState<string | null>(null);
  const [avatar, setAvatar] = useState<{ path: string | null; crop: unknown }>({ path: null, crop: null });

  // Campos do cadastro (ou das preferências, quando não há colaborador vinculado)
  const [name, setName] = useState("");
  const [customRole, setCustomRole] = useState("");
  const [customPhone, setCustomPhone] = useState("");
  const [travados, setTravados] = useState(false);
  const [abertos, setAbertos] = useState<Set<CampoTravado>>(new Set());
  // Valores como vieram do banco: é para onde os campos voltam se a pessoa cancelar o aviso.
  const [original, setOriginal] = useState({ name: "", role: "", phone: "", email: "" });

  // Livres: são do usuário, não do RH.
  const [userStatus, setUserStatus] = useState("online");
  const [userBio, setUserBio] = useState("");

  // Senha
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  // Preferências de Notificação
  const [preferences, setPreferences] = useState({ trial: true, rgs: true, benefits: true, profile: true });
  const [savingPrefs, setSavingPrefs] = useState(false);

  const limparSenha = useCallback(() => {
    setOldPassword("");
    setNewPassword("");
    setConfirmPassword("");
  }, []);

  // Sem isso, o avatar do header só troca das iniciais para a foto depois que o usuário abre o
  // modal uma vez — é este efeito que preenche `avatar.path`. Roda fechado na primeira montagem
  // para o header já nascer com a foto certa, e só depois volta a exigir `open` para recarregar.
  const jaCarregou = useRef(false);
  useEffect(() => {
    if (!open && jaCarregou.current) return;
    jaCarregou.current = true;
    let vivo = true;

    const carregar = async () => {
      setLoading(true);
      setLoadError("");
      const supabase = createClient();
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (!vivo) return;
      if (authError || !auth.user) {
        setLoadError("Não foi possível carregar seus dados. Feche e abra o perfil de novo.");
        setLoading(false);
        return;
      }

      // As três consultas não dependem uma da outra: em cascata, o modal ficava com os campos
      // em branco por um instante e eles se preenchiam sozinhos na cara do usuário — o que
      // também apaga o que a pessoa já tivesse digitado nesse meio tempo.
      const [perfil, prefs, colaborador] = await Promise.all([
        supabase.from("profiles").select("name, avatar_url").eq("id", auth.user.id).maybeSingle(),
        supabase.from("profile_preferences").select("*").eq("profile_id", auth.user.id).maybeSingle(),
        supabase.from("employees").select("id, name, role, phone, photo_path, photo_crop").eq("user_id", auth.user.id).maybeSingle(),
      ]);
      if (!vivo) return;

      if (perfil.error || prefs.error || colaborador.error) {
        // Campos vazios aqui não são "dados reais": com eles na tela, "Salvar Perfil Completo"
        // gravaria esse vazio por cima do cadastro.
        setLoadError("Não foi possível carregar seus dados. Feche e abra o perfil de novo.");
        setLoading(false);
        return;
      }

      const campos = resolveProfileFields({
        employee: colaborador.data,
        profile: perfil.data,
        preferences: prefs.data,
      });

      setUserId(auth.user.id);
      setEmail(auth.user.email ?? "");
      setEmployeeId(campos.employeeId);
      setTravados(campos.vinculado);
      setAbertos(new Set());
      setName(campos.name.value || (auth.user.email?.split("@")[0] ?? ""));
      setCustomRole(campos.role.value);
      setCustomPhone(campos.phone.value);
      setOriginal({ name: campos.name.value, role: campos.role.value, phone: campos.phone.value, email: auth.user.email ?? "" });
      setAvatar({
        path: colaborador.data?.photo_path ?? perfil.data?.avatar_url ?? null,
        crop: colaborador.data?.photo_crop ?? null,
      });

      const p = prefs.data;
      if (p) {
        setPreferences({ trial: p.notify_trial, rgs: p.notify_rgs, benefits: p.notify_benefits, profile: p.notify_profile });
        if (p.availability_status) setUserStatus(p.availability_status);
        if (p.bio) setUserBio(p.bio);
      }
      setLoading(false);
    };

    carregar();
    return () => { vivo = false; };
  }, [open]);

  const destravar = (campo: CampoTravado) => {
    setAbertos((atual) => new Set(atual).add(campo));
    setError("");
  };

  const voltarAoCadastro = () => {
    setName(original.name);
    setCustomRole(original.role);
    setCustomPhone(original.phone);
    setEmail(original.email);
    setAbertos(new Set());
  };

  // Só as preferências livres. Não encosta em nome, cargo, telefone nem e-mail.
  const handleSaveAllPreferences = async () => {
    if (!userId || loadError) return;
    setSavingPrefs(true);
    setSuccess("");
    setError("");
    const { error: updateError } = await createClient().from("profile_preferences").upsert({
      profile_id: userId,
      notify_trial: preferences.trial,
      notify_rgs: preferences.rgs,
      notify_benefits: preferences.benefits,
      notify_profile: preferences.profile,
      availability_status: userStatus,
      bio: userBio,
      updated_at: new Date().toISOString(),
    });
    setSavingPrefs(false);
    if (updateError) {
      setError("Erro ao salvar personalização e preferências.");
    } else {
      setSuccess("Personalização e preferências salvas com sucesso!");
      setTimeout(() => setSuccess(""), 3000);
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loadError) return;
    setError("");
    setSuccess("");

    const mudouCadastro = travados && (name !== original.name || customRole !== original.role || customPhone !== original.phone);
    if (mudouCadastro && !window.confirm(`${AVISO_CADASTRO}\n\nDeseja continuar?`)) {
      voltarAoCadastro();
      return;
    }

    setSaving(true);
    const supabase = createClient();
    const recados: string[] = [];

    if (employeeId) {
      // Grava onde o dado mora de verdade. `employees_todos` porque o gatilho INSTEAD OF
      // roteia para o quadro atual ou para o arquivo morto conforme onde a pessoa está.
      const { error: empError } = await supabase.from("employees_todos")
        .update({ name: name.trim(), role: customRole.trim() || null, phone: customPhone.trim() || null })
        .eq("id", employeeId);
      if (empError) {
        setSaving(false);
        setError("Erro ao atualizar seu cadastro de colaborador: " + empError.message);
        return;
      }
    }

    // `profiles.name` é o que o resto do app lê; com ou sem vínculo ele acompanha.
    const { error: profError } = await supabase.from("profiles").update({ name: name.trim() }).eq("id", userId);
    if (profError) {
      setSaving(false);
      setError("Erro ao atualizar o perfil: " + profError.message);
      return;
    }

    const { error: prefError } = await supabase.from("profile_preferences").upsert({
      profile_id: userId,
      notify_trial: preferences.trial,
      notify_rgs: preferences.rgs,
      notify_benefits: preferences.benefits,
      notify_profile: preferences.profile,
      // Sem colaborador vinculado, cargo e telefone continuam morando aqui, como antes.
      ...(employeeId ? {} : { custom_role: customRole, custom_phone: customPhone }),
      availability_status: userStatus,
      bio: userBio,
      updated_at: new Date().toISOString(),
    });
    if (prefError) {
      setSaving(false);
      setError("Erro ao salvar suas preferências: " + prefError.message);
      return;
    }

    // E-mail de LOGIN. O Supabase manda um link de confirmação para o endereço novo e só
    // troca depois do clique — dizer isso na tela, senão a pessoa acha que já mudou.
    if (email.trim() && email.trim() !== original.email) {
      const { error: authError } = await supabase.auth.updateUser({ email: email.trim(), data: { name: name.trim() } });
      if (authError) {
        setSaving(false);
        setError("Erro ao atualizar o e-mail de login: " + authError.message);
        return;
      }
      recados.push("Enviamos um link de confirmação para o e-mail novo; o login só muda depois que você clicar nele.");
    } else {
      await supabase.auth.updateUser({ data: { name: name.trim() } });
    }

    setSaving(false);
    setOriginal({ name, role: customRole, phone: customPhone, email });
    setAbertos(new Set());
    setSuccess(["Dados do perfil atualizados com sucesso!", ...recados].join(" "));
    setTimeout(() => setSuccess(""), 6000);
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    const problema = validarSenha(newPassword, confirmPassword, oldPassword);
    if (problema) {
      setError(problema);
      return;
    }

    setSavingPassword(true);
    const supabase = createClient();

    // Confirmar a senha atual antes de trocar é o ponto que mais importa, e já era feito.
    const { error: signInError } = await supabase.auth.signInWithPassword({ email: original.email, password: oldPassword });
    if (signInError) {
      setSavingPassword(false);
      // Mensagem própria: a da API vem em inglês e não diz o que fazer.
      setError("A senha atual está incorreta.");
      return;
    }

    const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
    if (updateError) {
      setSavingPassword(false);
      setError("Não foi possível atualizar a senha: " + updateError.message);
      return;
    }

    // Trocar a senha por suspeita de invasão só resolve se derrubar quem já estava dentro.
    // Esta sessão continua aberta; as outras caem.
    const { error: signOutError } = await supabase.auth.signOut({ scope: "others" });
    setSavingPassword(false);
    limparSenha();
    setSuccess(signOutError
      ? "Senha alterada. Não foi possível encerrar as sessões nos outros aparelhos — troque a senha de novo se isso for importante agora."
      : "Senha alterada. Você foi desconectado dos outros aparelhos; esta sessão continua aberta.");
    setTimeout(() => setSuccess(""), 8000);
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

  const forca = forcaSenha(newPassword);
  const bloqueado = loading || !!loadError;

  return (
    <Dialog open={open} onOpenChange={(aberto) => { setOpen(aberto); if (!aberto) { limparSenha(); setError(""); setSuccess(""); } }}>
      <DialogTrigger render={<button className="relative flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-tr from-primary/80 to-indigo-600 text-white shadow-sm hover:opacity-95 hover:shadow transition-all font-semibold text-xs" />}>
        {avatar.path
          ? <EmployeeAvatar name={name} photoPath={avatar.path} photoCrop={avatar.crop} className="h-9 w-9" textClassName="text-xs" />
          : (name ? getInitials(name) : <User className="h-4 w-4 text-white" />)}
        <span className={`absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-background ${getStatusColor(userStatus)}`} />
      </DialogTrigger>

      <DialogContent className="sm:max-w-2xl p-0 overflow-hidden rounded-2xl shadow-2xl border bg-card">
        {/* Banner / Header Visual */}
        <div className="relative bg-gradient-to-r from-primary via-indigo-600 to-purple-600 p-6 text-white overflow-hidden">
          <div className="absolute top-[-40px] right-[-40px] w-48 h-48 bg-white/10 rounded-full blur-2xl pointer-events-none" />
          <div className="relative z-10 flex items-center gap-5">
            <div className="relative flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-md border border-white/30 text-2xl font-bold tracking-tight shadow-inner text-white overflow-hidden">
              {avatar.path
                ? <EmployeeAvatar name={name} photoPath={avatar.path} photoCrop={avatar.crop} className="h-20 w-20 rounded-2xl" textClassName="text-2xl" />
                : getInitials(name)}
              <span className={`absolute -bottom-1 -right-1 h-5 w-5 rounded-full border-4 border-card ${getStatusColor(userStatus)}`} title={getStatusText(userStatus)} />
            </div>
            <div className="space-y-1 flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <DialogTitle className="text-2xl font-bold tracking-tight truncate text-white">{name || "Usuário"}</DialogTitle>
                {customRole && (
                  <span className="text-[10px] font-bold tracking-widest uppercase px-2 py-0.5 rounded-full bg-white/20 backdrop-blur-sm border border-white/20 shrink-0">
                    {customRole}
                  </span>
                )}
              </div>
              <DialogDescription className="text-white/80 text-sm truncate">
                {email} • <span className="font-medium text-white/95">{getStatusText(userStatus)}</span>
              </DialogDescription>
              {userBio && <p className="text-xs text-white/70 italic pt-1 truncate">&quot;{userBio}&quot;</p>}
            </div>
          </div>
        </div>

        <div className="p-6 pt-4">
          {loadError && (
            <div role="alert" className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm font-medium">{loadError}</div>
          )}

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-3 h-11 p-1 bg-muted/60 rounded-xl mb-6">
              <TabsTrigger value="perfil" className="text-sm font-medium rounded-lg data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-sm transition-all flex items-center justify-center gap-2">
                <User className="w-4 h-4 text-indigo-500" /> Meus Dados
              </TabsTrigger>
              <TabsTrigger value="security" className="text-sm font-medium rounded-lg data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-sm transition-all flex items-center justify-center gap-2">
                <Shield className="w-4 h-4 text-emerald-500" /> Segurança & Acesso
              </TabsTrigger>
              <TabsTrigger value="notifications" className="text-sm font-medium rounded-lg data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-sm transition-all flex items-center justify-center gap-2">
                <Bell className="w-4 h-4 text-amber-500" /> Alertas & Avisos
              </TabsTrigger>
            </TabsList>

            {/* ABA: MEUS DADOS */}
            <TabsContent value="perfil" className="space-y-5">
              <form onSubmit={handleUpdateProfile} className="space-y-4">
                {travados && !loading && (
                  <div className="p-3 rounded-lg border bg-muted/30 text-xs text-muted-foreground">
                    Nome, cargo e telefone vêm do seu cadastro de colaborador no RH. Clique no cadeado para editar
                    — {AVISO_CADASTRO.toLowerCase()}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <CampoComCadeado
                    id="profile_name" label="Nome Completo" value={name} onChange={setName}
                    travado={travados} aberto={abertos.has("name")} onDestravar={() => destravar("name")} loading={loading}
                  />
                  <CampoComCadeado
                    id="profile_role" label="Cargo" icon={<Briefcase className="w-3.5 h-3.5 text-indigo-500" />}
                    value={customRole} onChange={setCustomRole}
                    travado={travados} aberto={abertos.has("role")} onDestravar={() => destravar("role")} loading={loading}
                  />

                  <div className="space-y-1.5">
                    <Label htmlFor="profile_email" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">E-mail de login</Label>
                    {loading ? <div className="h-10 rounded-lg bg-muted animate-pulse" /> : (
                      <Input id="profile_email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="h-10 rounded-lg" />
                    )}
                    <p className="text-[11px] text-muted-foreground">
                      É o e-mail com que você entra no sistema. Mudar exige confirmar pelo link enviado ao endereço novo.
                      O e-mail do cadastro de RH é outro campo, e quem altera é o RH.
                    </p>
                  </div>

                  <CampoComCadeado
                    id="profile_phone" label="Ramal / Telefone" icon={<Phone className="w-3.5 h-3.5 text-emerald-500" />}
                    value={customPhone} onChange={setCustomPhone}
                    travado={travados} aberto={abertos.has("phone")} onDestravar={() => destravar("phone")} loading={loading}
                  />

                  <div className="space-y-1.5 col-span-2 md:col-span-1">
                    <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Status de Atividade</Label>
                    {loading ? <div className="h-10 rounded-lg bg-muted animate-pulse" /> : (
                      <select
                        value={userStatus}
                        onChange={(e) => setUserStatus(e.target.value)}
                        className="flex h-10 w-full rounded-lg border border-input bg-background px-3 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-primary"
                      >
                        <option value="online">🟢 Online / Disponível</option>
                        <option value="focus">🟡 Modo Foco / Trabalhando em Projeto</option>
                        <option value="busy">🔴 Ocupado / Em Reunião ou Entrevistas</option>
                      </select>
                    )}
                  </div>

                  <div className="space-y-1.5 col-span-2">
                    <Label htmlFor="profile_bio" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Frase de Perfil / Bio</Label>
                    {loading ? <div className="h-10 rounded-lg bg-muted animate-pulse" /> : (
                      <Input
                        id="profile_bio" value={userBio} onChange={(e) => setUserBio(e.target.value)}
                        placeholder="Escreva uma frase que resuma seu estilo de trabalho..."
                        className="h-10 rounded-lg"
                      />
                    )}
                  </div>
                </div>

                {error && <div role="alert" className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm font-medium">{error}</div>}
                {success && <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-sm font-medium flex items-center gap-2"><CheckCircle2 className="w-4 h-4" />{success}</div>}

                <div className="flex justify-end items-center gap-3 pt-4 border-t mt-6">
                  <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Fechar</Button>
                  <Button type="button" onClick={handleSaveAllPreferences} variant="secondary" disabled={savingPrefs || bloqueado}>
                    {savingPrefs ? "Salvando..." : "Salvar Personalização"}
                  </Button>
                  <Button type="submit" disabled={saving || bloqueado} className="bg-primary hover:bg-primary/90 text-primary-foreground font-medium px-6 rounded-lg shadow-sm">
                    {saving ? "Atualizando..." : "Salvar Perfil Completo"}
                  </Button>
                </div>
              </form>
            </TabsContent>

            {/* ABA: SEGURANÇA & CREDENCIAIS */}
            <TabsContent value="security" className="space-y-5">
              <form onSubmit={handleUpdatePassword} className="space-y-4">
                <div className="p-4 rounded-xl border bg-muted/30 space-y-2">
                  <div className="flex items-center gap-2 font-semibold text-sm">
                    <Key className="w-4 h-4 text-primary" /> Alterar Senha de Acesso
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Mínimo de {SENHA_MINIMA} caracteres, misturando letras e números. Ao trocar, você continua
                    conectado aqui e é desconectado dos outros aparelhos.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="old_password">Senha Atual</Label>
                  <Input id="old_password" type="password" autoComplete="current-password" placeholder="••••••••"
                    value={oldPassword} onChange={(e) => setOldPassword(e.target.value)} className="h-10 rounded-lg" />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="new_password">Nova Senha</Label>
                    <Input id="new_password" type="password" autoComplete="new-password" placeholder={`Mínimo de ${SENHA_MINIMA} caracteres...`}
                      value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="h-10 rounded-lg" />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="confirm_password">Repita a Nova Senha</Label>
                    <Input id="confirm_password" type="password" autoComplete="new-password" placeholder="••••••••"
                      value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="h-10 rounded-lg" />
                  </div>
                </div>

                {newPassword && (
                  <div className="flex items-center gap-2" aria-hidden="true">
                    {[1, 2, 3, 4].map((n) => (
                      <span key={n} className={`h-1.5 flex-1 rounded-full ${forca >= n ? (forca >= 3 ? "bg-emerald-500" : "bg-amber-500") : "bg-muted"}`} />
                    ))}
                    <span className="text-xs text-muted-foreground w-24 text-right">
                      {forca === 0 ? "Muito curta" : forca >= 3 ? "Forte" : "Aceitável"}
                    </span>
                  </div>
                )}

                {error && <div role="alert" className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm font-medium">{error}</div>}
                {success && <div className="p-3 rounded-lg bg-emerald-500/10 text-emerald-600 text-sm font-medium flex items-center gap-2"><CheckCircle2 className="w-4 h-4" />{success}</div>}

                <div className="flex justify-end gap-3 pt-6 border-t">
                  <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
                  <Button type="submit" disabled={savingPassword || bloqueado} className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg px-6 shadow-sm">
                    {savingPassword ? "Atualizando..." : "Atualizar Senha"}
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

              {error && <div role="alert" className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm font-medium">{error}</div>}
              {success && <div className="p-3 rounded-lg bg-emerald-500/10 text-emerald-600 text-sm font-medium flex items-center gap-2"><CheckCircle2 className="w-4 h-4" />{success}</div>}

              <div className="flex justify-end items-center gap-3 pt-4 border-t mt-4">
                <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
                <Button type="button" onClick={handleSaveAllPreferences} disabled={savingPrefs || bloqueado} className="bg-primary hover:bg-primary/90 text-white font-medium px-6 rounded-lg shadow-sm">
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
