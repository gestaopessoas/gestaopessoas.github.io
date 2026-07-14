"use client"

import { useEffect, useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Save, Loader2 } from "lucide-react"
import { createClient } from "@/utils/supabase/client"

export default function ConfiguracoesPage() {
  const [modules, setModules] = useState({ ats: true, admissao: true, pdi: true, gestor: true })
  const [permissions, setPermissions] = useState({ "2fa": true, salaries: false, ai_notifications: true })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from('system_settings').select('*').in('setting_key', ['modules', 'permissions'])
      if (data) {
        data.forEach(row => {
          if (row.setting_key === 'modules') setModules(row.setting_value)
          if (row.setting_key === 'permissions') setPermissions(row.setting_value)
        })
      }
      setLoading(false)
    }
    load()
  }, [supabase])

  async function handleSave() {
    setSaving(true)
    try {
      const response = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          modules,
          permissions,
          user_name: 'Administrador' // TODO: Pegar do contexto do usuário logado
        })
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Erro desconhecido');
      }
      
      alert("Configurações salvas e logadas com sucesso no banco de dados.");
    } catch (error: any) {
      alert("Erro ao salvar: " + error.message);
    } finally {
      setSaving(false);
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
          <TabsList className="grid w-full grid-cols-2 max-w-md h-10 p-1 bg-muted/50">
            <TabsTrigger value="modulos" className="text-sm rounded-md data-[state=active]:shadow-sm">Módulos do Sistema</TabsTrigger>
            <TabsTrigger value="permissoes" className="text-sm rounded-md data-[state=active]:shadow-sm">Permissões Globais</TabsTrigger>
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
                <div className="flex items-center justify-between border-b border-border/40 pb-4">
                  <div className="space-y-0.5">
                    <Label className="text-base font-medium">Visibilidade de Salários</Label>
                    <p className="text-sm text-muted-foreground">Permitir que gestores visualizem a remuneração de seus times.</p>
                  </div>
                  <Switch checked={permissions.salaries} onCheckedChange={(c) => setPermissions({...permissions, salaries: c})} />
                </div>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-base font-medium">Notificações Automáticas via IA</Label>
                    <p className="text-sm text-muted-foreground">A IA pode enviar emails de reprovação/aprovação automaticamente.</p>
                  </div>
                  <Switch checked={permissions.ai_notifications} onCheckedChange={(c) => setPermissions({...permissions, ai_notifications: c})} />
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
        </Tabs>
      </div>
    </div>
  )
}
