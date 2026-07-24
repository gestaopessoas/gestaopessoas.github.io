"use client"

import { useEffect, useState, Suspense } from "react"
import { createClient } from "@/utils/supabase/client"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Clock, Activity, Loader2, Calendar } from "lucide-react"
import { format, parseISO } from "date-fns"
import { ptBR } from "date-fns/locale"
import Link from "next/link"
import { useSearchParams } from "next/navigation"

type EmployeeHistory = {
  id: string
  change_date: string
  change_type: string
  old_value: any
  new_value: any
  description: string
}

type Employee = {
  id: string
  name: string
  registration_number: string
}

function HistoricoContent() {
  const searchParams = useSearchParams()
  const id = searchParams.get("id")
  const [employee, setEmployee] = useState<Employee | null>(null)
  const [history, setHistory] = useState<EmployeeHistory[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    async function loadData() {
      if (!id) {
        setLoading(false)
        return
      }
      
      const { data: empData } = await supabase
        .from("employees")
        .select("id, name, registration_number")
        .eq("id", id)
        .single()
        
      if (empData) setEmployee(empData)

      const { data: histData } = await supabase
        .from("employee_history")
        .select("*")
        .eq("employee_id", id)
        .order("change_date", { ascending: false })

      if (histData) setHistory(histData)
      setLoading(false)
    }
    loadData()
  }, [id, supabase])

  function getChangeTypeIcon(type: string) {
    switch(type) {
      case 'SALARIO': return <Activity className="w-4 h-4 text-emerald-500" />
      case 'CARGO': return <Activity className="w-4 h-4 text-blue-500" />
      case 'STATUS': return <Activity className="w-4 h-4 text-orange-500" />
      case 'RECONTRATACAO': return <Activity className="w-4 h-4 text-green-500" />
      case 'VINCULO': return <Activity className="w-4 h-4 text-purple-500" />
      case 'BENEFICIOS': return <Activity className="w-4 h-4 text-pink-500" />
      default: return <Clock className="w-4 h-4 text-muted-foreground" />
    }
  }

  function getChangeTypeColor(type: string) {
    switch(type) {
      case 'SALARIO': return "bg-emerald-100 text-emerald-700 border-emerald-200"
      case 'CARGO': return "bg-blue-100 text-blue-700 border-blue-200"
      case 'STATUS': return "bg-orange-100 text-orange-700 border-orange-200"
      case 'RECONTRATACAO': return "bg-green-100 text-green-700 border-green-200"
      case 'VINCULO': return "bg-purple-100 text-purple-700 border-purple-200"
      case 'BENEFICIOS': return "bg-pink-100 text-pink-700 border-pink-200"
      default: return "bg-gray-100 text-gray-700 border-gray-200"
    }
  }

  function formatValue(val: any): string {
    if (val === null || val === undefined) return "N/A"
    if (typeof val === 'object') {
      return Object.entries(val).map(([k, v]) => `${k}: ${v}`).join(' | ')
    }
    return String(val)
  }

  if (loading) {
    return <div className="flex h-full items-center justify-center pt-20"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
  }

  if (!id) {
    return <div className="flex h-full items-center justify-center pt-20">ID do colaborador não informado.</div>
  }

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="p-8 max-w-4xl mx-auto w-full space-y-8">
        <header className="flex items-center gap-4">
          <Link href="/dashboard/colaboradores">
            <Button variant="outline" size="icon">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Histórico do Colaborador</h1>
            {employee && (
              <p className="text-sm text-muted-foreground mt-1">
                {employee.name} {employee.registration_number && `(Matrícula: ${employee.registration_number})`}
              </p>
            )}
          </div>
        </header>

        {history.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-center rounded-lg border border-dashed bg-muted/20">
            <Calendar className="w-10 h-10 text-muted-foreground mb-4 opacity-50" />
            <h3 className="text-lg font-medium">Nenhum registro encontrado</h3>
            <p className="text-sm text-muted-foreground mt-1">Este colaborador ainda não possui um histórico de alterações registrado.</p>
          </div>
        ) : (
          <div className="relative pl-6 border-l-2 border-muted">
            {history.map((record) => (
              <div key={record.id} className="mb-10 relative">
                <span className="absolute -left-[35px] bg-background border-2 border-muted p-1.5 rounded-full">
                  {getChangeTypeIcon(record.change_type)}
                </span>
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground font-medium">
                      {format(parseISO(record.change_date), "dd 'de' MMMM, yyyy 'às' HH:mm", { locale: ptBR })}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${getChangeTypeColor(record.change_type)}`}>
                      {record.change_type}
                    </span>
                  </div>
                  
                  <div className="bg-card border rounded-lg p-4 shadow-sm">
                    <p className="text-sm font-medium mb-3">{record.description}</p>
                    
                    <div className="grid grid-cols-2 gap-4 bg-muted/30 p-3 rounded-md text-sm border border-border/50">
                      <div>
                        <span className="text-xs text-muted-foreground uppercase font-semibold tracking-wider">Valor Anterior</span>
                        <div className="mt-1 font-mono text-xs overflow-x-auto whitespace-pre-wrap break-words">
                          {formatValue(record.old_value)}
                        </div>
                      </div>
                      <div>
                        <span className="text-xs text-muted-foreground uppercase font-semibold tracking-wider">Novo Valor</span>
                        <div className="mt-1 font-mono text-xs overflow-x-auto whitespace-pre-wrap break-words">
                          {formatValue(record.new_value)}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default function HistoricoColaboradorPage() {
  return (
    <Suspense fallback={<div className="flex h-full items-center justify-center pt-20"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>}>
      <HistoricoContent />
    </Suspense>
  )
}
