"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { ExternalLink, Copy, Check, FileText, Briefcase, GraduationCap, Star, Info } from "lucide-react"
import { useState } from "react"

export default function FormulariosPage() {
  const [copiedLink, setCopiedLink] = useState<string | null>(null)

  const copyToClipboard = (path: string) => {
    const fullUrl = window.location.origin + path
    navigator.clipboard.writeText(fullUrl)
    setCopiedLink(path)
    setTimeout(() => setCopiedLink(null), 2000)
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight mb-2">Central de Formulários</h1>
        <p className="text-muted-foreground">
          Acesse rapidamente os links para os formulários externos, avaliações e páginas públicas do sistema. 
          Você pode copiar os links para enviar diretamente aos colaboradores ou gestores.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        
        {/* Vagas */}
        <Card className="flex flex-col">
          <CardHeader>
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-2">
              <Briefcase className="h-5 w-5 text-primary" />
            </div>
            <CardTitle>Solicitação de Vaga</CardTitle>
            <CardDescription>Formulário para os gestores solicitarem a abertura de novas vagas para suas áreas.</CardDescription>
          </CardHeader>
          <CardContent className="flex-1">
            <div className="bg-muted p-3 rounded-md text-sm break-all font-mono">
              /solicitar-vaga
            </div>
          </CardContent>
          <CardFooter className="flex gap-2 border-t pt-4">
            <Button variant="outline" className="flex-1" onClick={() => copyToClipboard('/solicitar-vaga')}>
              {copiedLink === '/solicitar-vaga' ? <Check className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
              {copiedLink === '/solicitar-vaga' ? 'Copiado!' : 'Copiar Link'}
            </Button>
            <Button className="flex-1" onClick={() => window.open('/solicitar-vaga', '_blank')}>
              <ExternalLink className="w-4 h-4 mr-2" /> Acessar
            </Button>
          </CardFooter>
        </Card>

        {/* Carreiras */}
        <Card className="flex flex-col">
          <CardHeader>
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-2">
              <GraduationCap className="h-5 w-5 text-primary" />
            </div>
            <CardTitle>Página de Carreiras</CardTitle>
            <CardDescription>Página pública listando todas as vagas abertas, onde os candidatos podem se inscrever.</CardDescription>
          </CardHeader>
          <CardContent className="flex-1">
            <div className="bg-muted p-3 rounded-md text-sm break-all font-mono">
              /carreiras
            </div>
          </CardContent>
          <CardFooter className="flex gap-2 border-t pt-4">
            <Button variant="outline" className="flex-1" onClick={() => copyToClipboard('/carreiras')}>
              {copiedLink === '/carreiras' ? <Check className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
              {copiedLink === '/carreiras' ? 'Copiado!' : 'Copiar Link'}
            </Button>
            <Button className="flex-1" onClick={() => window.open('/carreiras', '_blank')}>
              <ExternalLink className="w-4 h-4 mr-2" /> Acessar
            </Button>
          </CardFooter>
        </Card>

        {/* Avaliação de Desempenho */}
        <Card className="flex flex-col">
          <CardHeader>
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-2">
              <Star className="h-5 w-5 text-primary" />
            </div>
            <CardTitle>Avaliação de Desempenho</CardTitle>
            <CardDescription>Página onde os gestores avaliam os colaboradores em período de experiência.</CardDescription>
          </CardHeader>
          <CardContent className="flex-1">
            <div className="bg-muted p-3 rounded-md text-sm break-all font-mono">
              /gestor/avaliar
            </div>
          </CardContent>
          <CardFooter className="flex gap-2 border-t pt-4">
            <Button variant="outline" className="flex-1" onClick={() => copyToClipboard('/gestor/avaliar')}>
              {copiedLink === '/gestor/avaliar' ? <Check className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
              {copiedLink === '/gestor/avaliar' ? 'Copiado!' : 'Copiar Link'}
            </Button>
            <Button className="flex-1" onClick={() => window.open('/gestor/avaliar', '_blank')}>
              <ExternalLink className="w-4 h-4 mr-2" /> Acessar
            </Button>
          </CardFooter>
        </Card>

        {/* BFI Colaboradores */}
        <Card className="flex flex-col bg-muted/30">
          <CardHeader>
            <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center mb-2">
              <FileText className="h-5 w-5 text-secondary-foreground" />
            </div>
            <CardTitle>Perfil Big Five (Colaborador)</CardTitle>
            <CardDescription>O link para este teste é único e não pode ser copiado genericamente.</CardDescription>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col justify-center">
            <div className="flex items-start gap-3 text-sm text-muted-foreground bg-background p-3 rounded border">
              <Info className="h-5 w-5 shrink-0 text-blue-500" />
              <p>Para gerar o link de um colaborador, vá até a aba <strong>Colaboradores</strong>, selecione o funcionário desejado, desça até "Mapeamento de Perfil" e clique em "Gerar Novo Link".</p>
            </div>
          </CardContent>
          <CardFooter className="flex gap-2 border-t pt-4">
            <Button variant="secondary" className="w-full" onClick={() => window.location.href = '/dashboard/colaboradores'}>
              Ir para Colaboradores
            </Button>
          </CardFooter>
        </Card>

        {/* BFI Candidatos */}
        <Card className="flex flex-col bg-muted/30">
          <CardHeader>
            <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center mb-2">
              <FileText className="h-5 w-5 text-secondary-foreground" />
            </div>
            <CardTitle>Perfil Big Five (Candidato)</CardTitle>
            <CardDescription>O link para este teste é único e deve ser gerado na vaga.</CardDescription>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col justify-center">
            <div className="flex items-start gap-3 text-sm text-muted-foreground bg-background p-3 rounded border">
              <Info className="h-5 w-5 shrink-0 text-blue-500" />
              <p>Para gerar o link de um candidato, vá até o Kanban da <strong>Vaga</strong>, abra o card do candidato na triagem, e clique para solicitar o teste de personalidade.</p>
            </div>
          </CardContent>
          <CardFooter className="flex gap-2 border-t pt-4">
            <Button variant="secondary" className="w-full" onClick={() => window.location.href = '/dashboard/vagas'}>
              Ir para Vagas
            </Button>
          </CardFooter>
        </Card>

      </div>
    </div>
  )
}
