import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { CheckCircle2, Circle, FileText, UploadCloud, ShieldCheck } from "lucide-react"

export default function AdmissaoDigitalPage() {
  const requirements = [
    { id: 1, title: "Documento de Identidade (RG/CNH)", status: "approved", type: "document" },
    { id: 2, title: "Comprovante de Residência", status: "pending", type: "document" },
    { id: 3, title: "Atestado de Saúde Ocupacional (ASO)", status: "uploaded", type: "medical" },
    { id: 4, title: "Dados Bancários", status: "pending", type: "form" },
  ]

  return (
    <div className="flex flex-col gap-8 p-8 max-w-5xl mx-auto">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-2">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Admissão Digital</h1>
          <p className="text-muted-foreground">Acompanhamento de onboarding e documentação segura.</p>
        </div>
        <div className="flex items-center space-x-2 bg-green-500/10 text-green-700 px-4 py-2 rounded-lg dark:text-green-400">
          <ShieldCheck className="h-5 w-5" />
          <span className="font-semibold text-sm">Criptografia End-to-End Ativa</span>
        </div>
      </header>

      <div className="grid md:grid-cols-3 gap-6">
        {/* Progress Sidebar */}
        <div className="md:col-span-1 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Progresso do Candidato</CardTitle>
              <CardDescription>Rafael Lima (Frontend Dev)</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-center mb-6">
                <div className="relative h-32 w-32 rounded-full border-8 border-muted flex items-center justify-center">
                  <svg className="absolute inset-0 h-full w-full transform -rotate-90" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="46" fill="transparent" stroke="currentColor" strokeWidth="8" className="text-primary" strokeDasharray="289" strokeDashoffset="216" />
                  </svg>
                  <span className="text-2xl font-bold">25%</span>
                </div>
              </div>
              <ul className="space-y-3">
                {requirements.map((req) => (
                  <li key={req.id} className="flex items-center space-x-3 text-sm">
                    {req.status === 'approved' && <CheckCircle2 className="h-4 w-4 text-green-500" />}
                    {req.status === 'uploaded' && <CheckCircle2 className="h-4 w-4 text-amber-500" />}
                    {req.status === 'pending' && <Circle className="h-4 w-4 text-muted-foreground" />}
                    <span className={req.status === 'pending' ? 'text-muted-foreground' : 'font-medium'}>
                      {req.title}
                    </span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>

        {/* Action Area */}
        <div className="md:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Ações Pendentes</CardTitle>
              <CardDescription>Revise os documentos enviados para continuar o processo.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Document Review Item */}
              <div className="flex items-start p-4 border rounded-lg bg-card">
                <FileText className="h-8 w-8 text-primary shrink-0 mr-4 mt-1" />
                <div className="flex-1">
                  <h4 className="font-semibold">Atestado de Saúde Ocupacional (ASO)</h4>
                  <p className="text-sm text-muted-foreground mt-1">Enviado hoje às 14:32</p>
                  <div className="mt-4 flex gap-3">
                    <Button size="sm">Analisar Documento</Button>
                    <Button size="sm" variant="outline" className="text-destructive">Rejeitar</Button>
                  </div>
                </div>
              </div>

              {/* Upload Item */}
              <div className="flex items-center justify-center p-8 border-2 border-dashed rounded-lg bg-muted/30">
                <div className="flex flex-col items-center text-center">
                  <UploadCloud className="h-10 w-10 text-muted-foreground mb-4" />
                  <h4 className="font-medium">Anexar Contrato de Trabalho Assinado</h4>
                  <p className="text-sm text-muted-foreground mt-1 mb-4">Arraste o PDF ou clique para buscar</p>
                  <Button variant="secondary">Procurar Arquivo</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
