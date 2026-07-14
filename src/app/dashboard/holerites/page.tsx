"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, FileText, Download } from "lucide-react";
import { format } from "date-fns";

export default function HoleritesPage() {
  const supabase = createClient();
  const [employees, setEmployees] = useState<any[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [myPayslips, setMyPayslips] = useState<any[]>([]);
  const [isHR, setIsHR] = useState(false);

  useEffect(() => {
    async function init() {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;

      const { data: profile } = await supabase.from('profiles').select('role').eq('id', userData.user.id).single();
      const isUserHR = profile?.role === 'admin' || profile?.role === 'rh';
      setIsHR(isUserHR);

      if (isUserHR) {
        const { data: emps } = await supabase.from('employees').select('id, name, cpf').eq('status', 'ACTIVE');
        setEmployees(emps || []);
      }

      // Fetch my payslips (from my folder)
      // First find my employee record
      const { data: me } = await supabase.from('employees').select('id').eq('user_id', userData.user.id).single();
      if (me) {
        const { data: files } = await supabase.storage.from('payslips').list(me.id);
        if (files) {
          setMyPayslips(files.map(f => ({ ...f, employee_id: me.id })));
        }
      }
    }
    init();
  }, [supabase]);

  const handleUpload = async () => {
    if (!file || !selectedEmployee) return alert("Selecione um funcionário e um arquivo.");
    setUploading(true);
    const filePath = `${selectedEmployee}/${file.name}`;
    const { error } = await supabase.storage.from('payslips').upload(filePath, file, { upsert: true });
    setUploading(false);
    if (error) {
      alert("Erro no upload: " + error.message);
    } else {
      alert("Holerite enviado com sucesso!");
      setFile(null);
    }
  };

  const handleDownload = async (path: string, fileName: string) => {
    const { data, error } = await supabase.storage.from('payslips').createSignedUrl(`${path}/${fileName}`, 60);
    if (error || !data) {
      alert("Erro ao baixar arquivo: Você não tem permissão.");
      return;
    }
    window.open(data.signedUrl, '_blank');
  };

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Holerites e Comprovantes</h1>
        <p className="text-muted-foreground text-sm">Distribuição segura de demonstrativos de pagamento.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><FileText className="w-5 h-5"/> Meus Holerites</CardTitle>
            <CardDescription>Documentos disponíveis para o seu usuário.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {myPayslips.map((p, i) => (
                <div key={i} className="flex items-center justify-between p-3 border rounded-md">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-blue-500" />
                    <span className="text-sm font-medium">{p.name}</span>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => handleDownload(p.employee_id, p.name)}>
                    <Download className="w-4 h-4" />
                  </Button>
                </div>
              ))}
              {myPayslips.length === 0 && (
                <p className="text-sm text-muted-foreground">Nenhum documento disponível no momento.</p>
              )}
            </div>
          </CardContent>
        </Card>

        {isHR && (
          <Card className="border-primary/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-primary"><Upload className="w-5 h-5"/> Enviar Holerite (Apenas RH)</CardTitle>
              <CardDescription>Faça upload de um arquivo PDF vinculando ao colaborador.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Colaborador</Label>
                <select 
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={selectedEmployee} 
                  onChange={e => setSelectedEmployee(e.target.value)}
                >
                  <option value="">Selecione...</option>
                  {employees.map(e => (
                    <option key={e.id} value={e.id}>{e.name} (CPF: {e.cpf || 'N/D'})</option>
                  ))}
                </select>
              </div>
              
              <div className="space-y-2">
                <Label>Arquivo PDF</Label>
                <Input type="file" accept=".pdf" onChange={e => setFile(e.target.files?.[0] || null)} />
              </div>

              <Button className="w-full gap-2" disabled={uploading || !file || !selectedEmployee} onClick={handleUpload}>
                {uploading ? "Enviando..." : <><Upload className="w-4 h-4" /> Realizar Upload</>}
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
