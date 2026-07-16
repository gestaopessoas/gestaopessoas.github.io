"use client"

import { useEffect, useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Save, Loader2, DownloadCloud } from "lucide-react"
import { createClient } from "@/utils/supabase/client"
import { usePermissions } from "@/hooks/usePermissions"

const MODULES = ["colaboradores", "arquivo_morto", "mp", "vagas", "talentos", "recrutamento", "armarios", "uniformes", "ponto", "rgs", "ilhas", "admissao", "onboarding", "centros_de_custo", "departamentos", "cargos", "empresas", "obras", "beneficios", "treinamentos", "ferias", "holerites", "avaliacoes", "clima", "metas", "pdi", "competencias", "turnover", "analytics", "salarios", "configuracoes"] as const
const ACTIONS = ["view", "create", "edit", "delete"] as const

type UserPerms = Record<string, Record<string, boolean>>
type ProfileRow = { id: string; name: string | null; level: number; permissions: UserPerms | null }

export default function ConfiguracoesPage() {
  const [modules, setModules] = useState({ ats: true, admissao: true, pdi: true, gestor: true, rgs_tracking: true })
  const [permissions, setPermissions] = useState({ "2fa": true, ai_notifications: true })
  const [jobRequestCode, setJobRequestCode] = useState("")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const supabase = createClient()
  const { loading: permLoading, can } = usePermissions()

  const [profiles, setProfiles] = useState<ProfileRow[]>([])
  const [profilesLoading, setProfilesLoading] = useState(true)
  const [savingProfileId, setSavingProfileId] = useState<string | null>(null)

  useEffect(() => {
    async function loadProfiles() {
      const { data } = await supabase.from('profiles').select('id, name, level, permissions')
      setProfiles((data as ProfileRow[]) ?? [])
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
    const { error } = await supabase.from('profiles').update({
      level: profile.level,
      permissions: profile.permissions ?? {},
    }).eq('id', profile.id)
    setSavingProfileId(null)
    if (error) alert("Erro ao salvar usuário: " + error.message)
  }

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from('system_settings').select('*').in('key', ['modules', 'permissions'])
      if (data) {
        data.forEach(row => {
          if (row.key === 'modules') setModules(row.value)
          if (row.key === 'permissions') setPermissions(row.value)
        })
      }
      const { data: publicForm } = await supabase.from('public_form_settings').select('value').eq('key', 'job_request_code').single()
      if (publicForm) setJobRequestCode(publicForm.value)
      
      setLoading(false)
    }
    load()
  }, [supabase])

  async function handleSave() {
    setSaving(true)
    try {
      const { error: settingsError } = await supabase.from('system_settings').upsert([
        { key: 'modules', value: modules },
        { key: 'permissions', value: permissions }
      ], { onConflict: 'key' });
      
      if (settingsError) throw new Error(settingsError.message);

      const { error: publicFormError } = await supabase.from('public_form_settings').upsert(
        { key: 'job_request_code', value: jobRequestCode },
        { onConflict: 'key' }
      );
      if (publicFormError) throw new Error(publicFormError.message);

      await supabase.from('system_audit_logs').insert({
        action_type: 'UPDATE_SETTINGS',
        entity_name: 'system_settings',
        user_identifier: 'Administrador',
        ip_address: 'browser',
        details: { modules, permissions }
      });
      
      alert("Configurações salvas com sucesso!");
    } catch (error: any) {
      alert("Erro ao salvar: " + error.message);
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
      const backupData: Record<string, any> = {};
      
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
    } catch (error: any) {
      alert("Erro ao gerar backup: " + error.message);
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
          <TabsList className={`grid w-full ${can('configuracoes', 'edit') ? 'grid-cols-4 max-w-3xl' : 'grid-cols-3 max-w-xl'} h-10 p-1 bg-muted/50`}>
            <TabsTrigger value="modulos" className="text-sm rounded-md data-[state=active]:shadow-sm">Módulos</TabsTrigger>
            <TabsTrigger value="permissoes" className="text-sm rounded-md data-[state=active]:shadow-sm">Permissões Globais</TabsTrigger>
            <TabsTrigger value="backup" className="text-sm rounded-md data-[state=active]:shadow-sm">Backup</TabsTrigger>
            {can('configuracoes', 'edit') && (
              <TabsTrigger value="usuarios" className="text-sm rounded-md data-[state=active]:shadow-sm">Usuários & Permissões</TabsTrigger>
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
              </CardContent>
              <CardFooter className="bg-muted/20 border-t border-border/40 pt-4 flex justify-end">
                <Button size="sm" onClick={handleSave} disabled={saving}>
                  {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                  Salvar Alterações
                </Button>
              </CardFooter>
            </Card>
          </TabsContent>

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
                  <Input 
                    value={jobRequestCode} 
                    onChange={(e) => setJobRequestCode(e.target.value)} 
                    className="w-48"
                    placeholder="Ex: ACPO-VAGAS" 
                  />
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
        </Tabs>
      </div>
    </div>
  )
}
