"use client"

import { useEffect, useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Save, Loader2, DownloadCloud, ShieldAlert, CalendarDays, Link as LinkIcon, Eye, EyeOff } from "lucide-react"
import { createClient } from "@/utils/supabase/client"
import { usePermissions } from "@/hooks/usePermissions"
import { GlobalHistoryTab } from "@/components/configuracoes/GlobalHistoryTab"
import { AiModelTab } from "@/components/configuracoes/AiModelTab"
import { PontoHistoryTab } from "@/components/configuracoes/PontoHistoryTab"
import { errorMessage } from "@/lib/utils";

const MODULES = ["colaboradores", "arquivo_morto", "mp", "vagas", "central_candidato", "recrutamento", "armarios", "uniformes", "ponto", "rgs", "ilhas", "admissao", "onboarding", "centros_de_custo", "departamentos", "cargos", "empresas", "obras", "beneficios", "treinamentos", "ferias", "holerites", "avaliacoes", "clima", "metas", "pdi", "competencias", "turnover", "analytics", "salarios", "configuracoes", "financeiro"] as const
const ACTIONS = ["view", "create", "edit", "delete"] as const

type UserPerms = Record<string, Record<string, boolean>>
type ProfileRow = { id: string; name: string | null; level: number; permissions: UserPerms }
type SettingEntry = { path: string[]; value_text: string | null; value_boolean: boolean | null }

function readSettingFlags(entries: SettingEntry[]) {
  return Object.fromEntries(entries.filter((entry) => entry.path.length === 1).map((entry) => [entry.path[0], entry.value_boolean === true]));
}

export default function ConfiguracoesPage() {
  const [modules, setModules] = useState({ ats: true, admissao: true, pdi: true, gestor: true, rgs_tracking: true, financeiro: false })
  const [permissions, setPermissions] = useState({ "2fa": true, ai_notifications: true })
  const [jobRequestCode, setJobRequestCode] = useState("")
  const [showJobCode, setShowJobCode] = useState(false)
  const [workSchedules, setWorkSchedules] = useState<string[]>([
    "SEG A SEX das 07:45h - 12h - 13:15 - 17:48h", 
    "SEG A SEX das 07:30h - 12h - 13:15 - 17:33h"
  ])
  const [pauseHistory, setPauseHistory] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const supabase = createClient()
  const { loading: permLoading, can, level } = usePermissions()

  const [profiles, setProfiles] = useState<ProfileRow[]>([])
  const [profilesLoading, setProfilesLoading] = useState(true)
  const [savingProfileId, setSavingProfileId] = useState<string | null>(null)

  useEffect(() => {
    async function loadProfiles() {
      const { data } = await supabase.from('profiles').select('id, name, level, profile_permissions(module_key, action_key, allowed)')
      setProfiles((data ?? []).map((profile) => {
        const permissions: UserPerms = {};
        for (const item of profile.profile_permissions ?? []) {
          permissions[item.module_key] ??= {};
          permissions[item.module_key][item.action_key] = item.allowed;
        }
        return { id: profile.id, name: profile.name, level: profile.level ?? 0, permissions };
      }))
      setProfilesLoading(false)
    }
    loadProfiles()
  }, [supabase])

  function updateProfileField(id: string, field: 'level' | 'permissions', value: number | UserPerms) {
    setProfiles(prev => prev.map(p => p.id === id ? { ...p, [field]: value } : p))
  }

  function toggleModuleAction(profile: ProfileRow, mod: string, action: string, checked: boolean) {
    const perms: UserPerms = { ...(profile.permissions ?? {}) }
    perms[mod] = { ...(perms[mod] ?? {}), [action]: checked }
    updateProfileField(profile.id, 'permissions', perms)
  }

  async function saveProfile(profile: ProfileRow) {
    setSavingProfileId(profile.id)
    const { error } = await supabase.from('profiles').update({ level: profile.level }).eq('id', profile.id)
    if (!error) {
      await supabase.from('profile_permissions').delete().eq('profile_id', profile.id)
      const rows = Object.entries(profile.permissions).flatMap(([module_key, actions]) => Object.entries(actions).map(([action_key, allowed]) => ({ profile_id: profile.id, module_key, action_key, allowed })))
      if (rows.length) await supabase.from('profile_permissions').insert(rows)
    }
    setSavingProfileId(null)
    if (error) alert("Erro ao salvar usuário: " + error.message)
  }

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from('system_settings').select('key, pause_history_tracking, system_setting_entries(path, value_text, value_boolean)').in('key', ['modules', 'permissions', 'work_schedules'])
      if (data) {
        data.forEach(row => {
          const entries = (row.system_setting_entries ?? []) as SettingEntry[];
          if (row.key === 'modules') {
            setModules((previous) => ({ ...previous, ...readSettingFlags(entries) }))
            setPauseHistory(row.pause_history_tracking || false)
          }
          if (row.key === 'permissions') setPermissions((previous) => ({ ...previous, ...readSettingFlags(entries) }))
          if (row.key === 'work_schedules') setWorkSchedules(entries.sort((a, b) => Number(a.path[0]) - Number(b.path[0])).map((entry) => entry.value_text ?? ''))
        })
      }
      const { data: publicForm } = await supabase.from('public_form_settings').select('value').eq('key', 'job_request_code').maybeSingle()
      if (publicForm) setJobRequestCode(publicForm.value)
      
      setLoading(false)
    }
    load()
  }, [supabase])

  async function handleSave() {
    setSaving(true)
    try {
      const { error: settingsError } = await supabase.from('system_settings').upsert([
        { key: 'modules', pause_history_tracking: pauseHistory },
        { key: 'permissions', pause_history_tracking: pauseHistory },
        { key: 'work_schedules', pause_history_tracking: pauseHistory }
      ], { onConflict: 'key' });
      
      if (settingsError) throw new Error(settingsError.message);

      const { error: publicFormError } = await supabase.from('public_form_settings').upsert(
        { key: 'job_request_code', value: jobRequestCode },
        { onConflict: 'key' }
      );
      if (publicFormError) throw new Error(publicFormError.message);

      const { error: entriesError } = await supabase.from('system_setting_entries').delete().in('setting_key', ['modules', 'permissions', 'work_schedules']);
      if (entriesError) throw new Error(entriesError.message);
      const entries = [
        ...Object.entries(modules).map(([key, value]) => ({ setting_key: 'modules', path: [key], value_type: 'boolean', value_boolean: value })),
        ...Object.entries(permissions).map(([key, value]) => ({ setting_key: 'permissions', path: [key], value_type: 'boolean', value_boolean: value })),
        ...workSchedules.map((value, index) => ({ setting_key: 'work_schedules', path: [String(index)], value_type: 'string', value_text: value })),
      ];
      if (entries.length) {
        const { error } = await supabase.from('system_setting_entries').insert(entries);
        if (error) throw new Error(error.message);
      }
      await supabase.from('system_audit_logs').insert({
        action_type: 'UPDATE_SETTINGS',
        entity_name: 'system_settings',
        user_identifier: 'Administrador',
        ip_address: 'browser'
      });
      
      alert("Configurações salvas com sucesso!");
    } catch (error) {
      alert("Erro ao salvar: " + errorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  const [backingUp, setBackingUp] = useState(false);

  async function handleBackup() {
    setBackingUp(true);
    try {
      const tables = [
        "applications", "benefit_ignores", "big_five_questions", "candidate_big_five_results", 
        "candidates", "climate_survey_responses", "climate_surveys", "companies", 
        "company_benefits", "competencies", "cost_centers", "departments", 
        "employee_archives", "employee_benefits", "employee_epis", "employee_promotions", 
        "employee_uniforms", "employees", "evaluation_cycles", "goals", "interviews", 
        "islands", "job_applications", "job_openings", "job_profiles", "job_requests", 
        "lockers", "lunch_lists", "occupational_exams", "payslips", "physical_boxes", 
        "profiles", "public_form_settings", "rgs_processes", "system_audit_logs", 
        "system_settings", "tests", "time_logs", "training_sessions", "uniform_items", 
        "vacations", "workplaces"
      ];
      const backupData: Record<string, unknown> = {};
      
      for (const table of tables) {
        const { data, error } = await supabase.from(table).select("*");
        if (!error && data) {
          backupData[table] = data;
        }
      }
      
      const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `backup_gestaopessoas_${new Date().toISOString().split('T')[0]}.json`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      
      alert("Backup gerado com sucesso!");
    } catch (error) {
      alert("Erro ao gerar backup: " + errorMessage(error));
    } finally {
      setBackingUp(false);
    }
  }

  if (loading) return <div className="flex items-center justify-center h-full"><Loader2 className="w-6 h-6 animate-spin" /></div>

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="p-8 max-w-4xl mx-auto w-full space-y-8">
        <header>
          <h1 className="text-2xl font-semibold tracking-tight">Configurações</h1>
          <p className="text-sm text-muted-foreground mt-1">Gerencie os módulos ativos e as permissões de acesso do sistema.</p>
        </header>

        <Tabs defaultValue="modulos" className="w-full">
          <TabsList className="flex flex-wrap h-auto p-1 bg-muted/50 gap-1 mb-6">
            <TabsTrigger value="modulos" className="text-sm rounded-md flex-1">Módulos</TabsTrigger>
            <TabsTrigger value="permissoes" className="text-sm rounded-md flex-1 min-w-[140px]">Permissões</TabsTrigger>
            <TabsTrigger value="integracoes" className="text-sm rounded-md flex-1 min-w-[140px]">Integrações</TabsTrigger>
            {can('configuracoes', 'edit') && (
              <TabsTrigger value="ia" className="text-sm rounded-md flex-1 min-w-[100px]">IA</TabsTrigger>
            )}
            <TabsTrigger value="backup" className="text-sm rounded-md flex-1">Backup</TabsTrigger>
            {can('configuracoes', 'edit') && (
              <TabsTrigger value="usuarios" className="text-sm rounded-md flex-1 min-w-[160px]">Usuários & Permissões</TabsTrigger>
            )}
            {level >= 50 && (
              <TabsTrigger value="log" className="text-sm rounded-md flex-1 min-w-[140px]">Log de Histórico</TabsTrigger>
            )}
            {level >= 50 && (
              <TabsTrigger value="ponto_history" className="text-sm rounded-md flex-1 min-w-[150px]">Histórico do Ponto</TabsTrigger>
            )}
          </TabsList>
          
          <TabsContent value="modulos" className="mt-6 space-y-6">
            <Card className="border-border/60 shadow-sm">
              <CardHeader className="pb-4 border-b border-border/40 mb-4">
                <CardTitle className="text-lg">Módulos Ativos</CardTitle>
                <CardDescription>Habilite ou desabilite as funcionalidades principais da plataforma.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between border-b border-border/40 pb-4">
                  <div className="space-y-0.5">
                    <Label className="text-base font-medium">Recrutamento & Seleção (ATS)</Label>
                    <p className="text-sm text-muted-foreground">Gestão de vagas, triagem inteligente e banco de talentos.</p>
                  </div>
                  <Switch checked={modules.ats} onCheckedChange={(c) => setModules({...modules, ats: c})} />
                </div>
                <div className="flex items-center justify-between border-b border-border/40 pb-4">
                  <div className="space-y-0.5">
                    <Label className="text-base font-medium">Admissão Digital</Label>
                    <p className="text-sm text-muted-foreground">Onboarding seguro com upload criptografado de documentos.</p>
                  </div>
                  <Switch checked={modules.admissao} onCheckedChange={(c) => setModules({...modules, admissao: c})} />
                </div>
                <div className="flex items-center justify-between border-b border-border/40 pb-4">
                  <div className="space-y-0.5">
                    <Label className="text-base font-medium">Plano de Desenvolvimento (PDI)</Label>
                    <p className="text-sm text-muted-foreground">Acompanhamento de metas, skills e trilhas de carreira.</p>
                  </div>
                  <Switch checked={modules.pdi} onCheckedChange={(c) => setModules({...modules, pdi: c})} />
                </div>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-base font-medium">Portal do Gestor</Label>
                    <p className="text-sm text-muted-foreground">Área restrita para gestores aprovarem candidatos e metas.</p>
                  </div>
                  <Switch checked={modules.gestor} onCheckedChange={(c) => setModules({...modules, gestor: c})} />
                </div>
                <div className="flex items-center justify-between border-t border-border/40 pt-4">
                  <div className="space-y-0.5">
                    <Label className="text-base font-medium">Registro Automático de RGS</Label>
                    <p className="text-sm text-muted-foreground">Criar registros automaticamente no RGS ao alterar colaboradores (Admissão, Demissão, Alterações).</p>
                  </div>
                  <Switch checked={modules.rgs_tracking ?? true} onCheckedChange={(c) => setModules({...modules, rgs_tracking: c})} />
                </div>
                {level === 100 && (
                  <div className="flex items-center justify-between border-t border-border/40 pt-4">
                    <div className="space-y-0.5">
                      <Label className="text-base font-medium">Histórico de Colaboradores</Label>
                      <p className="text-sm text-muted-foreground">Habilitar ou pausar a criação automática de registros no Histórico do Colaborador.</p>
                    </div>
                    <Switch checked={!pauseHistory} onCheckedChange={(c) => setPauseHistory(!c)} />
                  </div>
                )}
                <div className="flex items-center justify-between border-t border-border/40 pt-4">
                  <div className="space-y-0.5">
                    <Label className="text-base font-medium">Resumo Financeiro</Label>
                    <p className="text-sm text-muted-foreground">Exibir a aba de consolidação financeira e custos de folha.</p>
                  </div>
                  <Switch checked={modules.financeiro ?? false} onCheckedChange={(c) => setModules({...modules, financeiro: c})} />
                </div>
              </CardContent>
              <CardFooter className="bg-muted/20 border-t border-border/40 pt-4 flex justify-end">
                <Button size="sm" onClick={handleSave} disabled={saving}>
                  {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                  Salvar Alterações
                </Button>
              </CardFooter>
            </Card>
          </TabsContent>

          <TabsContent value="integracoes" className="mt-6 space-y-6">
            <Card className="border-border/60 shadow-sm">
              <CardHeader className="pb-4 border-b border-border/40 mb-4">
                <CardTitle className="text-lg">Integrações Pessoais</CardTitle>
                <CardDescription>Conecte contas externas para sincronizar dados com o seu perfil.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <CalendarDays className="h-5 w-5 text-blue-600" />
                      <Label className="text-base font-medium">Microsoft Outlook (Calendário)</Label>
                    </div>
                    <p className="text-sm text-muted-foreground ml-7">Sincronize suas entrevistas e agendamentos diretamente com a agenda do Outlook.</p>
                  </div>
                  <Button variant="outline" className="gap-2" onClick={() => alert('Em breve! É necessário configurar o App ID da Microsoft primeiro.')}>
                    <LinkIcon className="h-4 w-4" /> Conectar Conta
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {can('configuracoes', 'edit') && (
            <TabsContent value="ia" className="mt-6 space-y-6">
              <AiModelTab />
            </TabsContent>
          )}

          <TabsContent value="permissoes" className="mt-6 space-y-6">
            <Card className="border-border/60 shadow-sm">
              <CardHeader className="pb-4 border-b border-border/40 mb-4">
                <CardTitle className="text-lg">Permissões de Acesso</CardTitle>
                <CardDescription>Configure o nível de segurança e políticas de acesso.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between border-b border-border/40 pb-4">
                  <div className="space-y-0.5">
                    <Label className="text-base font-medium">Autenticação em Dois Fatores (2FA)</Label>
                    <p className="text-sm text-muted-foreground">Obrigar todos os usuários administradores a usar 2FA.</p>
                  </div>
                  <Switch checked={permissions["2fa"]} onCheckedChange={(c) => setPermissions({...permissions, "2fa": c})} />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-base font-medium">Notificações Automáticas via IA</Label>
                    <p className="text-sm text-muted-foreground">A IA pode enviar emails de reprovação/aprovação automaticamente.</p>
                  </div>
                  <Switch checked={permissions.ai_notifications} onCheckedChange={(c) => setPermissions({...permissions, ai_notifications: c})} />
                </div>
                <div className="flex items-center justify-between border-t border-border/40 pt-4">
                  <div className="space-y-1">
                    <Label className="text-base font-medium">Código do Formulário Público de Vagas</Label>
                    <p className="text-sm text-muted-foreground">Senha que os gestores usarão para solicitar abertura de novas vagas.</p>
                  </div>
                  <div className="relative w-48">
                    <Input
                      type={showJobCode ? "text" : "password"}
                      value={jobRequestCode}
                      onChange={(e) => setJobRequestCode(e.target.value)}
                      className="pr-9"
                      placeholder="Ex: ACPO-VAGAS"
                      autoComplete="new-password"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      className="absolute right-0.5 top-1/2 -translate-y-1/2"
                      onClick={() => setShowJobCode((v) => !v)}
                      title={showJobCode ? "Ocultar código" : "Mostrar código"}
                    >
                      {showJobCode ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
                <div className="flex items-center justify-between border-t border-border/40 pt-4">
                  <div className="space-y-1 w-full max-w-lg">
                    <Label className="text-base font-medium">Horários e Escalas Padrões</Label>
                    <p className="text-sm text-muted-foreground">Coloque um horário por linha. Eles aparecerão nos dropdowns de solicitação de vaga e MP.</p>
                    <textarea
                      className="w-full min-h-32 max-h-48 resize-none overflow-y-auto rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                      maxLength={2000}
                      value={workSchedules.join("\n")}
                      onChange={(e) => setWorkSchedules(e.target.value.split("\n").map(s => s.trim()).filter(Boolean))}
                      placeholder="Ex: SEG A SEX das 07:45h - 12h - 13:15 - 17:48h"
                    />
                    <div className="text-right text-xs text-muted-foreground">{workSchedules.join("\n").length}/2000</div>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="bg-muted/20 border-t border-border/40 pt-4 flex justify-end">
                <Button size="sm" onClick={handleSave} disabled={saving}>
                  {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                  Salvar Alterações
                </Button>
              </CardFooter>
            </Card>
          </TabsContent>

          {can('configuracoes', 'edit') && (
            <TabsContent value="usuarios" className="mt-6 space-y-6">
              {(permLoading || profilesLoading) ? (
                <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin" /></div>
              ) : (
                profiles.map(profile => (
                  <Card key={profile.id} className="border-border/60 shadow-sm">
                    <CardHeader className="pb-4 border-b border-border/40 mb-4">
                      <CardTitle className="text-lg">{profile.name ?? profile.id}</CardTitle>
                      <CardDescription>
                        Nível de acesso (0-100). <strong>Nível ≥ 50 concede acesso total (admin)</strong> e ignora a grade abaixo.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      <div className="flex items-center gap-3 max-w-xs">
                        <Label className="text-sm font-medium whitespace-nowrap">Level</Label>
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          value={profile.level}
                          onChange={(e) => updateProfileField(profile.id, 'level', Number(e.target.value))}
                        />
                      </div>

                      {profile.level >= 50 ? (
                        <p className="text-sm text-muted-foreground">Este usuário é admin (level ≥ 50) e já tem acesso total a todos os módulos.</p>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm border-collapse">
                            <thead>
                              <tr className="border-b border-border/40">
                                <th className="text-left py-2 pr-4 font-medium">Módulo</th>
                                {ACTIONS.map(action => (
                                  <th key={action} className="text-center py-2 px-2 font-medium capitalize">{action}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {MODULES.map(mod => (
                                <tr key={mod} className="border-b border-border/20">
                                  <td className="py-2 pr-4">{mod}</td>
                                  {ACTIONS.map(action => (
                                    <td key={action} className="text-center py-2 px-2">
                                      <Switch
                                        checked={profile.permissions?.[mod]?.[action] === true}
                                        onCheckedChange={(c) => toggleModuleAction(profile, mod, action, c)}
                                      />
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </CardContent>
                    <CardFooter className="bg-muted/20 border-t border-border/40 pt-4 flex justify-end">
                      <Button size="sm" onClick={() => saveProfile(profile)} disabled={savingProfileId === profile.id}>
                        {savingProfileId === profile.id ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                        Salvar Usuário
                      </Button>
                    </CardFooter>
                  </Card>
                ))
              )}
            </TabsContent>
          )}

          <TabsContent value="backup" className="mt-6 space-y-6">
            <Card className="border-border/60 shadow-sm">
              <CardHeader className="pb-4 border-b border-border/40 mb-4">
                <CardTitle className="text-lg">Backup do Sistema</CardTitle>
                <CardDescription>Exporte todos os dados do banco de dados em formato JSON para fins de segurança e arquivo.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-base font-medium">Exportar Banco de Dados</Label>
                    <p className="text-sm text-muted-foreground">O arquivo JSON gerado conterá Colaboradores, Armários, Entrevistas e Configurações.</p>
                  </div>
                  <Button onClick={handleBackup} disabled={backingUp} variant="outline" className="gap-2 border-primary/50 text-primary hover:bg-primary/10">
                    {backingUp ? <Loader2 className="w-4 h-4 animate-spin" /> : <DownloadCloud className="w-4 h-4" />}
                    Fazer Backup (JSON)
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {level >= 50 && (
            <TabsContent value="log" className="mt-6 space-y-6">
              <GlobalHistoryTab />
            </TabsContent>
          )}

          {level >= 50 && (
            <TabsContent value="ponto_history" className="mt-6 space-y-6">
              <PontoHistoryTab />
            </TabsContent>
          )}

        </Tabs>
      </div>
    </div>
  )
}
