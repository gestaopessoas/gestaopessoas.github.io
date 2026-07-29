"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ArrowLeft, Save } from "lucide-react"
import Link from "next/link"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/utils/supabase/client"

export default function NovaVagaPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const [form, setForm] = useState({
    title: "",
    description: "",
    department: "",
    location: "",
    contractType: "",
    isPcd: false,
    isTalentPool: false,
  })

  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)

    try {
      const supabase = createClient()
      
      // 1. Inserir na fila de solicitações (job_requests) como "Aprovada"
      const { data: requestData, error: requestError } = await supabase
        .from("job_requests")
        .insert({
          position_title: form.title,
          requester_name: "RH (Via Dashboard)",
          requester_area: form.department,
          unit: form.location,
          contract_type: form.contractType,
          status: "Aprovada",
          requested_role: form.title,
          reason: "Nova Vaga",
          urgency: "Média",
          notes: form.isTalentPool ? "Banco de talentos" : "",
        })
        .select()
        .single()

      if (requestError) throw new Error("Erro ao criar solicitação de vaga: " + requestError.message)

      // 2. Inserir na tabela pública de vagas (jobs) para candidatos
      const { error: jobError } = await supabase
        .from("jobs")
        .insert({
          title: form.title,
          description: form.description || "Detalhes da vaga em breve.",
          status: "PUBLISHED",
          pcd_tags: form.isPcd ? ["Exclusiva PCD"] : [],
        })

      if (jobError) throw new Error("Erro ao publicar vaga externa: " + jobError.message)

      router.push("/dashboard/vagas")
      router.refresh()
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message)
      } else {
        setError("Ocorreu um erro desconhecido.")
      }
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handlePublish} className="flex flex-col gap-6 p-8 max-w-4xl mx-auto">
      <div className="flex items-center space-x-4">
        <Link href="/dashboard/vagas">
          <Button type="button" variant="outline" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Criar Nova Vaga</h1>
          <p className="text-muted-foreground">Preencha os detalhes para publicar uma nova oportunidade.</p>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Engenharia de Cargos</CardTitle>
          <CardDescription>Detalhes estruturais da posição solicitada.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="titulo">Título da Vaga *</Label>
              <Input 
                id="titulo" 
                required 
                placeholder="Ex: Engenheiro(a) de Software" 
                value={form.title}
                onChange={(e) => setForm({...form, title: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="departamento">Departamento</Label>
              <Input 
                id="departamento" 
                placeholder="Ex: Tecnologia" 
                value={form.department}
                onChange={(e) => setForm({...form, department: e.target.value})}
              />
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="localizacao">Localização</Label>
              <Input 
                id="localizacao" 
                placeholder="Ex: Pelotas/RS (Híbrido)" 
                value={form.location}
                onChange={(e) => setForm({...form, location: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tipo">Tipo de Contratação</Label>
              <Input 
                id="tipo" 
                placeholder="Ex: CLT, PJ, Estágio" 
                value={form.contractType}
                onChange={(e) => setForm({...form, contractType: e.target.value})}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="descricao">Descrição da Vaga</Label>
            <textarea 
              id="descricao"
              rows={4}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              placeholder="Descreva as atividades e responsabilidades..."
              value={form.description}
              onChange={(e) => setForm({...form, description: e.target.value})}
            />
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
            <input 
              type="checkbox" 
              id="pcd" 
              className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
              checked={form.isPcd}
              onChange={(e) => setForm({...form, isPcd: e.target.checked})} 
            />
            <Label htmlFor="pcd" className="font-normal cursor-pointer">Vaga exclusiva para Pessoa com Deficiência (PcD)</Label>
          </div>
          <div className="flex items-center space-x-2">
            <input 
              type="checkbox" 
              id="banco" 
              className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
              checked={form.isTalentPool}
              onChange={(e) => setForm({...form, isTalentPool: e.target.checked})} 
            />
            <Label htmlFor="banco" className="font-normal cursor-pointer">Banco de Talentos</Label>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end space-x-4">
        <Button type="button" variant="outline" onClick={() => router.push("/dashboard/vagas")}>
          Cancelar
        </Button>
        <Button type="submit" disabled={loading}>
          <Save className="mr-2 h-4 w-4" />
          {loading ? "Publicando..." : "Publicar Vaga"}
        </Button>
      </div>
    </form>
  )
}
