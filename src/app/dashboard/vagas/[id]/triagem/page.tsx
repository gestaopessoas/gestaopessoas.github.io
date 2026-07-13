import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { PlusCircle, Save, Trash2, ShieldAlert } from "lucide-react"

export default function TriagemQuestionsPage() {
  return (
    <div className="flex flex-col gap-6 p-8 max-w-4xl mx-auto">
      <header className="flex items-center justify-between mb-2">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Triagem & Knockout Questions</h1>
          <p className="text-muted-foreground">Configure perguntas eliminatórias para a vaga REQ-042.</p>
        </div>
      </header>

      <Card className="border-l-4 border-l-orange-500">
        <CardHeader className="pb-3 flex flex-row items-start space-x-3">
          <ShieldAlert className="h-6 w-6 text-orange-500 shrink-0 mt-0.5" />
          <div>
            <CardTitle className="text-lg">Filtro Automático</CardTitle>
            <CardDescription>
              Candidatos que não atenderem aos critérios das Knockout Questions serão automaticamente reprovados pela IA e enviados para o Banco de Talentos.
            </CardDescription>
          </div>
        </CardHeader>
      </Card>

      <div className="space-y-4">
        {/* Question 1 */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Pergunta 1</CardTitle>
              <Button variant="ghost" size="icon" className="text-destructive h-8 w-8">
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid gap-2">
              <Label>Enunciado da Pergunta</Label>
              <Input defaultValue="Você possui experiência prévia com Next.js (App Router)?" />
            </div>
            <div className="grid gap-2">
              <Label>Critério de Aceitação (Knockout Rule)</Label>
              <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50">
                <option>Obrigatório responder &quot;Sim&quot;</option>
                <option>Análise Semântica (AIA) - Requer contexto</option>
              </select>
            </div>
          </CardContent>
        </Card>

        {/* Question 2 */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Pergunta 2</CardTitle>
              <Button variant="ghost" size="icon" className="text-destructive h-8 w-8">
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid gap-2">
              <Label>Enunciado da Pergunta</Label>
              <Input defaultValue="Qual seu nível de proficiência em Inglês?" />
            </div>
            <div className="grid gap-2">
              <Label>Critério de Aceitação (Knockout Rule)</Label>
              <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50">
                <option>Intermediário ou superior</option>
                <option>Avançado ou Fluente</option>
              </select>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center space-x-4">
        <Button variant="outline" className="w-full border-dashed border-2 bg-transparent hover:bg-muted/50 h-12">
          <PlusCircle className="mr-2 h-4 w-4" />
          Adicionar Nova Pergunta
        </Button>
      </div>

      <div className="flex justify-end pt-6 border-t mt-4">
        <Button size="lg">
          <Save className="mr-2 h-4 w-4" />
          Salvar Regras de Triagem
        </Button>
      </div>
    </div>
  )
}
