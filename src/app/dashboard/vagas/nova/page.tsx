import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ArrowLeft, Save } from "lucide-react"
import Link from "next/link"

export default function NovaVagaPage() {
  return (
    <div className="flex flex-col gap-6 p-8 max-w-4xl mx-auto">
      <div className="flex items-center space-x-4">
        <Link href="/dashboard/vagas">
          <Button variant="outline" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Criar Nova Vaga</h1>
          <p className="text-muted-foreground">Preencha os detalhes para publicar uma nova oportunidade.</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Engenharia de Cargos</CardTitle>
          <CardDescription>Detalhes estruturais da posição solicitada.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="titulo">Título da Vaga</Label>
              <Input id="titulo" placeholder="Ex: Engenheiro(a) de Software" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="departamento">Departamento</Label>
              <Input id="departamento" placeholder="Ex: Tecnologia" />
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="localizacao">Localização</Label>
              <Input id="localizacao" placeholder="Ex: Pelotas/RS (Híbrido)" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tipo">Tipo de Contratação</Label>
              <Input id="tipo" placeholder="Ex: CLT, PJ, Estágio" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Inclusão & Diversidade</CardTitle>
          <CardDescription>Tags e metadados de afirmatividade.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center space-x-2">
            <input type="checkbox" id="pcd" className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary" />
            <Label htmlFor="pcd" className="font-normal">Vaga exclusiva para Pessoa com Deficiência (PcD)</Label>
          </div>
          <div className="flex items-center space-x-2">
            <input type="checkbox" id="banco" className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary" />
            <Label htmlFor="banco" className="font-normal">Banco de Talentos</Label>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end space-x-4">
        <Button variant="outline">Salvar Rascunho</Button>
        <Button>
          <Save className="mr-2 h-4 w-4" />
          Publicar Vaga
        </Button>
      </div>
    </div>
  )
}
