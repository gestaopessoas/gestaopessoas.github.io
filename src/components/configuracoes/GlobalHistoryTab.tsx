"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/utils/supabase/client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Loader2, Search, RotateCcw, ShieldAlert } from "lucide-react"
import { format } from "date-fns"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"

type HistoryEntry = {
  id: string
  employee_id: string
  change_date: string
  change_type: string
  old_value: any
  new_value: any
  description: string
  column_name: string
  changed_by: string
  profiles?: { name: string }
  employees?: { name: string }
}

export function GlobalHistoryTab() {
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [revertItem, setRevertItem] = useState<HistoryEntry | null>(null)
  const [adminPassword, setAdminPassword] = useState("")
  const [reverting, setReverting] = useState(false)

  const fetchHistory = async () => {
    setLoading(true)
    const supabase = createClient()
    
    let query = supabase
      .from('employee_history')
      .select(`
        *,
        profiles!changed_by(name),
        employees!employee_id(name)
      `)
      .order('change_date', { ascending: false })
      .limit(100)

    const { data, error } = await query
    
    if (!error && data) {
      setHistory(data as any)
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchHistory()
  }, [])

  const handleRevert = async () => {
    if (!revertItem || !adminPassword) return
    setReverting(true)

    const supabase = createClient()
    
    // First, verify the admin password by fetching current user session to get email
    const { data: { user } } = await supabase.auth.getUser()
    if (!user?.email) {
      alert("Usuário não autenticado.")
      setReverting(false)
      return
    }

    // Attempt to verify password using signInWithPassword
    const { error: authError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: adminPassword
    })

    if (authError) {
      alert("A senha de administrador está incorreta.")
      setReverting(false)
      return
    }

    // Proceed to revert
    if (!revertItem.column_name) {
      alert("O registro não possui a coluna mapeada para reversão automática.")
      setReverting(false)
      return
    }

    const { error: updateError } = await supabase
      .from('employees')
      .update({ [revertItem.column_name]: revertItem.old_value })
      .eq('id', revertItem.employee_id)

    if (updateError) {
      alert("Erro ao reverter: " + updateError.message)
    } else {
      alert("Reversão concluída com sucesso.")
      setRevertItem(null)
      setAdminPassword("")
      fetchHistory() // Refresh
    }
    
    setReverting(false)
  }

  const filtered = history.filter(h => 
    h.employees?.name?.toLowerCase().includes(search.toLowerCase()) ||
    h.description?.toLowerCase().includes(search.toLowerCase()) ||
    h.change_type?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <Card className="border-border/60 shadow-sm">
      <CardHeader className="pb-4 border-b border-border/40 mb-4">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">Log Global de Histórico</CardTitle>
            <CardDescription>Auditoria de todas as alterações realizadas nos dados dos colaboradores.</CardDescription>
          </div>
          <div className="relative w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Buscar histórico..."
              className="pl-9 h-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin" /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/40 text-left">
                  <th className="py-3 px-4 font-medium">Data</th>
                  <th className="py-3 px-4 font-medium">Colaborador</th>
                  <th className="py-3 px-4 font-medium">Tipo</th>
                  <th className="py-3 px-4 font-medium">Descrição</th>
                  <th className="py-3 px-4 font-medium">Autor</th>
                  <th className="py-3 px-4 font-medium">Ação</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((item) => (
                  <tr key={item.id} className="border-b border-border/20 hover:bg-muted/10 transition-colors">
                    <td className="py-3 px-4 whitespace-nowrap">{format(new Date(item.change_date), "dd/MM/yyyy HH:mm")}</td>
                    <td className="py-3 px-4 font-medium">{item.employees?.name || 'Desconhecido'}</td>
                    <td className="py-3 px-4">
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary">
                        {item.change_type}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-muted-foreground max-w-[300px] truncate" title={item.description}>
                      {item.description}
                    </td>
                    <td className="py-3 px-4">{item.profiles?.name || 'Sistema'}</td>
                    <td className="py-3 px-4">
                      {item.column_name && (
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-8 text-orange-500 hover:text-orange-600 hover:bg-orange-100 dark:hover:bg-orange-900/20"
                          onClick={() => setRevertItem(item)}
                        >
                          <RotateCcw className="w-4 h-4 mr-1" />
                          Reverter
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-muted-foreground">Nenhum registro encontrado.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>

      <Dialog open={!!revertItem} onOpenChange={(o) => !o && setRevertItem(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-orange-500" />
              Confirmar Reversão de Dado
            </DialogTitle>
            <DialogDescription>
              Você está prestes a reverter a alteração feita por <strong>{revertItem?.profiles?.name || 'Sistema'}</strong> em <strong>{format(new Date(revertItem?.change_date || new Date()), "dd/MM/yyyy")}</strong> no perfil de <strong>{revertItem?.employees?.name}</strong>.
            </DialogDescription>
          </DialogHeader>
          
          <div className="bg-muted/30 p-4 rounded-md space-y-2 text-sm my-2">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-muted-foreground block mb-1">Como estava:</span>
                <span className="font-mono bg-background px-2 py-1 rounded border inline-block w-full">{String(revertItem?.old_value ?? 'Nada')}</span>
              </div>
              <div>
                <span className="text-muted-foreground block mb-1">Como ficou:</span>
                <span className="font-mono bg-background px-2 py-1 rounded border inline-block w-full">{String(revertItem?.new_value ?? 'Nada')}</span>
              </div>
            </div>
            <p className="pt-2 text-xs text-muted-foreground">Isso gerará um novo registro automático no histórico revertendo para o valor antigo.</p>
          </div>

          <div className="space-y-2 mt-2">
            <Label>Senha de Administrador</Label>
            <Input 
              type="password" 
              placeholder="Digite sua senha para confirmar..." 
              value={adminPassword}
              onChange={(e) => setAdminPassword(e.target.value)}
            />
          </div>

          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setRevertItem(null)} disabled={reverting}>Cancelar</Button>
            <Button variant="destructive" onClick={handleRevert} disabled={!adminPassword || reverting}>
              {reverting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RotateCcw className="w-4 h-4 mr-2" />}
              Reverter Agora
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
