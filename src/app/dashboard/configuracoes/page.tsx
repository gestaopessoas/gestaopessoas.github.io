"use client"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Save } from "lucide-react"

export default function ConfiguracoesPage() {
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
              <CardHeader className="pb-4">
                <CardTitle className="text-lg">Módulos Ativos</CardTitle>
                <CardDescription>Habilite ou desabilite as funcionalidades principais da plataforma.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between border-b border-border/40 pb-4">
                  <div className="space-y-0.5">
                    <Label className="text-base font-medium">Recrutamento & Seleção (ATS)</Label>
                    <p className="text-sm text-muted-foreground">Gestão de vagas, triagem inteligente e banco de talentos.</p>
                  </div>
                  <Switch defaultChecked />
                </div>
                <div className="flex items-center justify-between border-b border-border/40 pb-4">
                  <div className="space-y-0.5">
                    <Label className="text-base font-medium">Admissão Digital</Label>
                    <p className="text-sm text-muted-foreground">Onboarding seguro com upload criptografado de documentos.</p>
                  </div>
                  <Switch defaultChecked />
                </div>
                <div className="flex items-center justify-between border-b border-border/40 pb-4">
                  <div className="space-y-0.5">
                    <Label className="text-base font-medium">Plano de Desenvolvimento (PDI)</Label>
                    <p className="text-sm text-muted-foreground">Acompanhamento de metas, skills e trilhas de carreira.</p>
                  </div>
                  <Switch defaultChecked />
                </div>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-base font-medium">Portal do Gestor</Label>
                    <p className="text-sm text-muted-foreground">Área restrita para gestores aprovarem candidatos e metas.</p>
                  </div>
                  <Switch defaultChecked />
                </div>
              </CardContent>
              <CardFooter className="bg-muted/20 border-t border-border/40 pt-4 flex justify-end">
                <Button size="sm">
                  <Save className="w-4 h-4 mr-2" />
                  Salvar Alterações
                </Button>
              </CardFooter>
            </Card>
          </TabsContent>

          <TabsContent value="permissoes" className="mt-6 space-y-6">
            <Card className="border-border/60 shadow-sm">
              <CardHeader className="pb-4">
                <CardTitle className="text-lg">Permissões de Acesso</CardTitle>
                <CardDescription>Configure o nível de segurança e políticas de acesso.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between border-b border-border/40 pb-4">
                  <div className="space-y-0.5">
                    <Label className="text-base font-medium">Autenticação em Dois Fatores (2FA)</Label>
                    <p className="text-sm text-muted-foreground">Obrigar todos os usuários administradores a usar 2FA.</p>
                  </div>
                  <Switch defaultChecked />
                </div>
                <div className="flex items-center justify-between border-b border-border/40 pb-4">
                  <div className="space-y-0.5">
                    <Label className="text-base font-medium">Visibilidade de Salários</Label>
                    <p className="text-sm text-muted-foreground">Permitir que gestores visualizem a remuneração de seus times.</p>
                  </div>
                  <Switch />
                </div>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-base font-medium">Notificações Automáticas via IA</Label>
                    <p className="text-sm text-muted-foreground">A IA pode enviar emails de reprovação/aprovação automaticamente.</p>
                  </div>
                  <Switch defaultChecked />
                </div>
              </CardContent>
              <CardFooter className="bg-muted/20 border-t border-border/40 pt-4 flex justify-end">
                <Button size="sm">
                  <Save className="w-4 h-4 mr-2" />
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
