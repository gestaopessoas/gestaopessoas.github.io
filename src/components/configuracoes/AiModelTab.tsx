"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { createClient } from "@/utils/supabase/client"
import { CheckCircle2, Loader2, RefreshCw, Save, XCircle } from "lucide-react"
import {
  DEFAULT_RESUME_MODEL,
  fetchResumeModel,
  listGeminiModels,
  saveResumeModel,
  testResumeModel,
  type GeminiModelOption,
} from "@/lib/resumeModelSettings"

type TestState = { ok: true } | { ok: false; error: string } | null

export function AiModelTab() {
  const [model, setModel] = useState<string>(DEFAULT_RESUME_MODEL)
  const [savedModel, setSavedModel] = useState<string>(DEFAULT_RESUME_MODEL)
  const [options, setOptions] = useState<GeminiModelOption[]>([])
  const [loading, setLoading] = useState(true)
  const [listError, setListError] = useState("")
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<TestState>(null)

  const loadModels = async () => {
    setListError("")
    try {
      setOptions(await listGeminiModels())
    } catch (err) {
      setListError(err instanceof Error ? err.message : "Falha ao listar modelos.")
    }
  }

  useEffect(() => {
    let active = true
    const load = async () => {
      const current = await fetchResumeModel(createClient())
      if (!active) return
      setModel(current)
      setSavedModel(current)
      await loadModels()
      if (active) setLoading(false)
    }
    load()
    return () => { active = false }
  }, [])

  const handleSave = async () => {
    setSaving(true)
    try {
      await saveResumeModel(createClient(), model)
      setSavedModel(model)
    } catch (err) {
      alert("Erro ao salvar o modelo: " + (err instanceof Error ? err.message : "desconhecido"))
    }
    setSaving(false)
  }

  const handleTest = async () => {
    setTesting(true)
    setTestResult(null)
    setTestResult(await testResumeModel(model))
    setTesting(false)
  }

  // O modelo salvo pode não estar na lista (foi aposentado, ou a listagem falhou). Ele entra
  // como opção mesmo assim, senão o campo apareceria vazio escondendo o que está em uso.
  const selectOptions = Array.from(new Set([...options.map((o) => o.id), savedModel, model].filter(Boolean)))

  return (
    <Card className="border-border/60 shadow-sm">
      <CardHeader className="pb-4 border-b border-border/40 mb-4">
        <CardTitle className="text-lg">Modelo de IA — Importação de Currículo</CardTitle>
        <CardDescription>
          Define qual modelo do Gemini lê os currículos enviados. Vale para todo o sistema:
          Banco de Talentos, Entrevistas, Central do Candidato e demais telas.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando configuração...
          </div>
        ) : (
          <>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Modelo</Label>
              <div className="flex flex-wrap items-center gap-2">
                <Select value={model} onValueChange={(value) => { setModel(value ?? DEFAULT_RESUME_MODEL); setTestResult(null) }}>
                  <SelectTrigger className="w-full sm:w-[340px]">
                    <SelectValue placeholder="Selecione o modelo" />
                  </SelectTrigger>
                  <SelectContent>
                    {selectOptions.map((id) => (
                      <SelectItem key={id} value={id}>{id}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button type="button" variant="outline" size="sm" className="gap-2" onClick={loadModels}>
                  <RefreshCw className="h-4 w-4" /> Atualizar lista
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                A lista vem da API do Google e mostra apenas modelos que suportam geração de
                texto. Um modelo aposentado deixa de aparecer aqui.
              </p>
              {listError && (
                <p className="text-xs text-destructive">
                  Não foi possível listar os modelos: {listError} Você ainda pode salvar o
                  modelo atual, mas confirme com o botão Testar.
                </p>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" onClick={handleSave} disabled={saving || model === savedModel} className="gap-2">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {saving ? "Salvando..." : model === savedModel ? "Salvo" : "Salvar"}
              </Button>
              <Button type="button" variant="outline" onClick={handleTest} disabled={testing} className="gap-2">
                {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {testing ? "Testando..." : "Testar conexão"}
              </Button>
            </div>

            {testResult?.ok === true && (
              <p className="flex items-center gap-2 text-sm text-emerald-600">
                <CheckCircle2 className="h-4 w-4" /> O modelo respondeu. A importação de currículo deve funcionar.
              </p>
            )}
            {testResult?.ok === false && (
              <p className="flex items-start gap-2 text-sm text-destructive">
                <XCircle className="h-4 w-4 mt-0.5 shrink-0" />
                <span>Falhou: {testResult.error}</span>
              </p>
            )}

            <p className="text-xs text-muted-foreground border-t pt-4">
              Por que isto existe: quando um modelo é aposentado pelo Google, a chamada falha e o
              sistema cai silenciosamente num leitor local mais simples. A importação não acusa
              erro — apenas passa a trazer poucos campos, como se os currículos fossem ruins.
              Trocar o modelo aqui resolve sem precisar de deploy. Em caso de dúvida, use Testar.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  )
}
