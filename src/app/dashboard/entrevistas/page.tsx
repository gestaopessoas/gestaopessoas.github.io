"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/utils/supabase/client";
import { Briefcase, Calendar, CheckCircle2, Clock, Download, Search, User, Plus, X, FileText } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";

type PsychologicalTestInput = {
  test_name: string;
  score: string | number;
  factors?: {
    N?: string | number;
    E?: string | number;
    O?: string | number;
    A?: string | number;
    C?: string | number;
  }
};

type Assessment = {
  psychological_test: string;
  tests_details?: string;
  tests_list?: PsychologicalTestInput[];
  age?: string | number;
  education?: string;
  technical: string;
  communication: string;
  cultural_fit: string;
  strengths: string;
  weaknesses: string;
  observations: string;
};

type Interview = {
  id: string;
  role: string | null;
  status: string | null;
  candidate_name: string | null;
  phone: string | null;
  email: string | null;
  interview_date: string | null;
  interview_time: string | null;
  result: string | null;
  assessment: Assessment | null;
  created_at: string;
};

const statusStyle: Record<string, string> = {
  Confirmado: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  Compareceu: "bg-blue-500/10 text-blue-700 dark:text-blue-300",
  Desistente: "bg-zinc-500/10 text-zinc-600 dark:text-zinc-300",
  Aguardando: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
};

const resultStyle: Record<string, string> = {
  Aprovado: "text-emerald-600",
  Reprovado: "text-red-600",
  Desistente: "text-zinc-500",
  "N/C": "text-zinc-500",
};

const defaultAssessment: Assessment = {
  psychological_test: "Não",
  tests_details: "",
  tests_list: [],
  age: "",
  education: "Ensino Médio",
  technical: "",
  communication: "",
  cultural_fit: "",
  strengths: "",
  weaknesses: "",
  observations: "",
};

async function generateTestText(testName: string, classification: string): Promise<string> {
  const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
  const prompt = `Escreva um parágrafo curto e profissional de parecer psicológico para um candidato de emprego. O teste realizado foi '${testName}' e o resultado obtido foi '${classification}'. Não invente características adicionais, apenas explique o que esse resultado significa nesse teste específico em 2 a 3 linhas de forma objetiva.`;

  if (apiKey) {
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
      });
      const data = await res.json();
      if (data.candidates && data.candidates[0]?.content?.parts[0]?.text) {
        return data.candidates[0].content.parts[0].text;
      }
    } catch (e) {
      console.error("Erro na API do Gemini, usando fallback:", e);
    }
  }

  const levels: any = {
    "Superior": "acima da média, demonstrando excelente capacidade",
    "Médio Superior": "ligeiramente acima da média, demonstrando boa capacidade",
    "Médio": "dentro do esperado para a população geral, demonstrando capacidade adequada",
    "Médio Inferior": "abaixo da média, sugerindo alguma dificuldade",
    "Inferior": "significativamente abaixo da média, indicando dificuldade acentuada"
  };

  const levelText = levels[classification] || "com desempenho compatível com a classificação " + classification;

  switch (testName) {
    case "G36":
      return `No teste G36 (Raciocínio Lógico e Inteligência Não-Verbal), o candidato obteve classificação ${classification}. O resultado indica que o mesmo apresenta uma capacidade de raciocínio abstrato e resolução de problemas ${levelText}.`;
    case "TEALT":
      return `Na avaliação pelo TEALT (Teste de Atenção Alternada), o candidato apresentou classificação ${classification}. Isto sugere que sua capacidade de alternar o foco entre diferentes tarefas ou estímulos está ${levelText}.`;
    case "TEADI":
      return `No TEADI (Teste de Atenção Dividida), o candidato alcançou a classificação ${classification}. O resultado aponta que sua habilidade para dividir a atenção em mais de um estímulo simultâneo está ${levelText}.`;
    case "TEACO-FF":
      return `Submetido ao TEACO-FF (Teste de Atenção Concentrada), o candidato demonstrou classificação ${classification}. Evidencia-se que sua aptidão para manter o foco em tarefas sob pressão ou rotineiras encontra-se ${levelText}.`;
    case "NEO PI-R":
    case "NEO FFI":
      return `O inventário de personalidade ${testName} indicou que o candidato apresenta traços predominantemente em nível ${classification} nos fatores avaliados, sugerindo características comportamentais que requerem análise de adequação à vaga.`;
    default:
      return `No teste ${testName}, o candidato apresentou classificação ${classification}, indicando um desempenho compatível com este nível de aptidão.`;
  }
}

export default function EntrevistasPage() {
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [query, setQuery] = useState("");
  const [selectedMonth, setSelectedMonth] = useState(""); // YYYY-MM
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"dados" | "avaliacao">("dados");
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    candidate_name: "", role: "", phone: "", email: "", interview_date: "", interview_time: "", status: "Aguardando", result: "N/C"
  });
  const [assessmentForm, setAssessmentForm] = useState<Assessment>(defaultAssessment);
  
  // Test generation states
  const [selectedTest, setSelectedTest] = useState("G36");
  const [selectedClass, setSelectedClass] = useState("Médio");
  const [isGeneratingTest, setIsGeneratingTest] = useState(false);

  const handleGenerateTestText = async () => {
    setIsGeneratingTest(true);
    const supabase = createClient();
    
    let combinedResults = "";
    const list = assessmentForm.tests_list || [];
    
    for (const test of list) {
      if (test.test_name.includes("NEO")) {
        const factors = test.factors || {};
        let neoResults = `${test.test_name}:\n`;
        for (const [f, score] of Object.entries(factors)) {
          if (!score) continue;
          const numScore = Number(score);
          const { data } = await supabase
            .from('psychological_norms')
            .select('*')
            .eq('test_name', test.test_name)
            .eq('factor', f)
            .lte('min_score', numScore)
            .gte('max_score', numScore)
            .limit(1);
          const classification = data?.[0]?.classification || "Não classificado (Tabela não encontrada)";
          neoResults += `- Fator ${f}: Pontuação ${score} -> ${classification}\n`;
        }
        combinedResults += neoResults + "\n";
      } else {
        if (!test.score) continue;
        const numScore = Number(test.score);
        const { data } = await supabase
          .from('psychological_norms')
          .select('*')
          .eq('test_name', test.test_name)
          .lte('min_score', numScore)
          .gte('max_score', numScore)
          .limit(1);
        
        const classification = data?.[0]?.classification || "Não classificado (Tabela não encontrada)";
        combinedResults += `${test.test_name}: Pontuação ${test.score} -> ${classification}\n\n`;
      }
    }
    
    const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
    if (apiKey && combinedResults.trim() !== "") {
      const prompt = `O candidato de ${assessmentForm.age || 'idade não informada'} anos, escolaridade ${assessmentForm.education || 'não informada'}, realizou os seguintes testes psicológicos:\n${combinedResults}\nEscreva um parecer psicológico consolidado e profissional, em um parágrafo objetivo, explicando as características do candidato com base nessas classificações. O parecer deve focar estritamente nas classificações (inferior, médio, superior, etc) e no que elas significam.`;
      try {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
        });
        const data = await res.json();
        if (data.candidates && data.candidates[0]?.content?.parts[0]?.text) {
          const text = data.candidates[0].content.parts[0].text;
          setAssessmentForm({ ...assessmentForm, tests_details: "RESULTADOS DA AVALIAÇÃO:\n" + combinedResults + "\nPARECER INTEGRADO DA IA:\n" + text });
        }
      } catch (e) {
        setAssessmentForm({ ...assessmentForm, tests_details: "Erro ao comunicar com IA. Resultados brutos:\n" + combinedResults });
      }
    } else {
      setAssessmentForm({ ...assessmentForm, tests_details: "Resultados consultados (IA não configurada ou sem testes):\n" + combinedResults });
    }
    setIsGeneratingTest(false);
  };

  const loadInterviews = async () => {
    setLoading(true);
    const supabase = createClient();
    const { data, error } = await supabase
      .from("interviews")
      .select("*")
      .order("interview_date", { ascending: false, nullsFirst: false });

    setLoading(false);
    if (error) {
      setError("Não foi possível carregar as entrevistas.");
      return;
    }
    setInterviews((data ?? []) as Interview[]);
  };

  useEffect(() => {
    loadInterviews();
  }, []);

  const filtered = useMemo(() => {
    let result = interviews;
    if (selectedMonth) {
      result = result.filter(i => i.interview_date && i.interview_date.startsWith(selectedMonth));
    }
    const term = query.trim().toLowerCase();
    if (term) {
      result = result.filter((interview) => [
        interview.candidate_name,
        interview.role,
        interview.status,
        interview.result,
        interview.email,
      ].some((value) => value?.toLowerCase().includes(term)));
    }
    return result;
  }, [query, selectedMonth, interviews]);

  const confirmados = filtered.filter((i) => i.status === "Confirmado").length;
  const compareceram = filtered.filter((i) => i.status === "Compareceu" || i.result === "Aprovado" || i.result === "Reprovado").length;
  const aprovados = filtered.filter((i) => i.result === "Aprovado").length;

  const exportToCsv = () => {
    if (filtered.length === 0) return;
    const headers = ["Candidato", "Telefone", "Email", "Cargo Alvo", "Data", "Hora", "Status", "Resultado"];
    const rows = filtered.map(i => [
      `"${i.candidate_name || ''}"`, 
      `"${i.phone || ''}"`, 
      `"${i.email || ''}"`, 
      `"${i.role || ''}"`, 
      `"${i.interview_date ? new Date(i.interview_date).toLocaleDateString('pt-BR', {timeZone: 'UTC'}) : ''}"`, 
      `"${i.interview_time || ''}"`, 
      `"${i.status || ''}"`, 
      `"${i.result || ''}"`
    ].join(","));
    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + [headers.join(","), ...rows].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `entrevistas_${selectedMonth || 'todas'}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
  };
  
  const exportParecer = () => {
    const text = `PARECER DE ENTREVISTA
=============================
Candidato: ${form.candidate_name || "N/I"}
Cargo Alvo: ${form.role || "N/I"}
Data: ${form.interview_date ? new Date(form.interview_date).toLocaleDateString('pt-BR', {timeZone: 'UTC'}) : 'N/I'}

AVALIAÇÃO
=============================
Teste Psicológico Realizado? ${assessmentForm.psychological_test}
Avaliação Técnica: ${assessmentForm.technical || '-'}
Comunicação: ${assessmentForm.communication || '-'}
Fit Cultural: ${assessmentForm.cultural_fit || '-'}

PONTOS FORTES
-----------------------------
${assessmentForm.strengths || 'Nenhum registrado'}

PONTOS A DESENVOLVER
-----------------------------
${assessmentForm.weaknesses || 'Nenhum registrado'}

PARECER FINAL / OBSERVAÇÕES
-----------------------------
${assessmentForm.observations || 'Nenhum registrado'}

Resultado Final: ${form.result || "N/C"}
`.trim();

    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Parecer_${form.candidate_name?.replace(/\s+/g, '_') || 'candidato'}.txt`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const printParecer = () => {
    const candidate = form.candidate_name || 'N/I';
    const role = form.role || 'N/I';
    const date = form.interview_date ? new Date(form.interview_date).toLocaleDateString('pt-BR', {timeZone: 'UTC'}) : 'N/I';
    const result = form.result || 'N/C';
    const resultColor = result === 'Aprovado' ? '#16a34a' : result === 'Reprovado' ? '#dc2626' : '#d97706';

    const fortes = (assessmentForm.strengths || '').split(',').map(s => s.trim()).filter(Boolean);
    const fracos = (assessmentForm.weaknesses || '').split(',').map(s => s.trim()).filter(Boolean);

    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <title>Parecer de Entrevista - ${candidate}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Inter', sans-serif; background: #f8fafc; color: #1e293b; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .page { max-width: 800px; margin: 0 auto; background: #fff; }
    @media print { body { background: #fff; } .page { max-width: 100%; box-shadow: none; border: none; margin: 0; padding: 0; } .no-print { display: none !important; } }
    @media screen { .page { margin: 32px auto; padding: 0; box-shadow: 0 4px 24px rgba(0,0,0,.10); border-radius: 16px; overflow: hidden; } }
    .header { padding: 40px 48px 32px; display: flex; flex-direction: column; align-items: center; text-align: center; border-bottom: 2px solid #e2e8f0; }
    .header img { max-width: 140px; margin-bottom: 20px; }
    .header h1 { font-size: 26px; font-weight: 700; margin-bottom: 4px; color: #0f172a; }
    .header-sub { font-size: 14px; color: #64748b; font-weight: 500; }
    .result-badge { display: inline-block; margin-top: 20px; padding: 6px 18px; border-radius: 999px; font-size: 13px; font-weight: 700; letter-spacing: .5px; background: ${resultColor}15; color: ${resultColor}; border: 1.5px solid ${resultColor}40; }
    .body { padding: 40px 48px; }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 32px; }
    .info-item label { font-size: 10px; font-weight: 600; letter-spacing: 1.5px; text-transform: uppercase; color: #94a3b8; display: block; margin-bottom: 4px; }
    .info-item span { font-size: 15px; font-weight: 500; color: #1e293b; }
    .section { margin-bottom: 28px; }
    .section-title { font-size: 11px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase; color: #6366f1; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px; margin-bottom: 16px; }
    .eval-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; }
    .eval-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px 16px; }
    .eval-card label { font-size: 10px; font-weight: 600; letter-spacing: 1px; text-transform: uppercase; color: #94a3b8; display: block; margin-bottom: 6px; }
    .eval-card span { font-size: 14px; font-weight: 600; color: #1e293b; }
    .tags { display: flex; flex-wrap: wrap; gap: 8px; }
    .tag { padding: 5px 14px; border-radius: 999px; font-size: 13px; font-weight: 500; }
    .tag-green { background: #dcfce7; color: #15803d; }
    .tag-orange { background: #ffedd5; color: #c2410c; }
    .observations { background: #f8fafc; border-left: 4px solid #6366f1; border-radius: 0 8px 8px 0; padding: 18px 20px; font-size: 14px; line-height: 1.8; color: #334155; white-space: pre-wrap; }
    .footer { background: #f1f5f9; padding: 20px 48px; display: flex; justify-content: space-between; align-items: center; font-size: 12px; color: #94a3b8; }
    .print-btn { position: fixed; bottom: 32px; right: 32px; background: #6366f1; color: #fff; border: none; border-radius: 12px; padding: 14px 28px; font-family: inherit; font-size: 15px; font-weight: 600; cursor: pointer; box-shadow: 0 4px 16px rgba(99,102,241,.4); display: flex; align-items: center; gap: 8px; }
    .print-btn:hover { background: #4f46e5; }
    .psy { display: inline-block; padding: 4px 12px; border-radius: 6px; font-size: 13px; font-weight: 600; background: ${assessmentForm.psychological_test === 'Sim' ? '#dcfce7' : '#fee2e2'}; color: ${assessmentForm.psychological_test === 'Sim' ? '#15803d' : '#dc2626'}; }
  </style>
</head>
<body>
<div class="page">
  <div class="header">
    <img src="/logos/SEDE.png" alt="ACPO" />
    <h1>${candidate}</h1>
    <div class="header-sub">Parecer de Entrevista · ${role}</div>
    <div class="result-badge">Resultado: ${result}</div>
  </div>
  <div class="body">
    <div class="info-grid">
      <div class="info-item"><label>Data da Entrevista</label><span>${date}</span></div>
      <div class="info-item"><label>Cargo</label><span>${role}</span></div>
      <div class="info-item"><label>Telefone</label><span>${form.phone || '—'}</span></div>
      <div class="info-item"><label>E-mail</label><span>${form.email || '—'}</span></div>
    </div>

    <div class="section">
      <div class="section-title">Avaliação</div>
      <div class="eval-grid">
        <div class="eval-card"><label>Avaliação Técnica</label><span>${assessmentForm.technical || '—'}</span></div>
        <div class="eval-card"><label>Comunicação</label><span>${assessmentForm.communication || '—'}</span></div>
        <div class="eval-card"><label>Fit Cultural</label><span>${assessmentForm.cultural_fit || '—'}</span></div>
      </div>
      <div style="margin-top:12px"><label style="font-size:10px;font-weight:600;letter-spacing:1px;text-transform:uppercase;color:#94a3b8;display:block;margin-bottom:6px">Teste Psicológico Realizado</label><span class="psy">${assessmentForm.psychological_test || 'Não Informado'}</span></div>
      ${assessmentForm.psychological_test === 'Sim' && assessmentForm.tests_details ? `
      <div style="margin-top:16px">
        <label style="font-size:10px;font-weight:600;letter-spacing:1px;text-transform:uppercase;color:#94a3b8;display:block;margin-bottom:6px">Testes Aplicados e Resultados</label>
        <div style="font-size: 14px; line-height: 1.6; color: #334155; white-space: pre-wrap; background: #f8fafc; padding: 12px; border-radius: 8px; border: 1px solid #e2e8f0;">${assessmentForm.tests_details}</div>
      </div>` : ''}
    </div>

    ${fortes.length > 0 ? `
    <div class="section">
      <div class="section-title">Pontos Fortes</div>
      <div class="tags">${fortes.map(f => `<span class="tag tag-green">${f}</span>`).join('')}</div>
    </div>` : ''}

    ${fracos.length > 0 ? `
    <div class="section">
      <div class="section-title">Pontos a Desenvolver</div>
      <div class="tags">${fracos.map(f => `<span class="tag tag-orange">${f}</span>`).join('')}</div>
    </div>` : ''}

    ${assessmentForm.observations ? `
    <div class="section">
      <div class="section-title">Parecer Final</div>
      <div class="observations">${assessmentForm.observations}</div>
    </div>` : ''}
  </div>
  <div class="footer">
    <span>Gerado em ${new Date().toLocaleString('pt-BR')}</span>
    <span>RH · Gestão de Pessoas</span>
  </div>
</div>
<button class="print-btn no-print" onclick="window.print()">🖨️ Imprimir / Salvar PDF</button>
</body>
</html>`;

    const win = window.open('', '_blank');
    if (win) {
      win.document.write(html);
      win.document.close();
      win.onload = () => win.print();
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    const supabase = createClient();
    
    const payload = {
      ...Object.fromEntries(
        Object.entries(form).map(([key, value]) => [key, value.trim() || null])
      ),
      assessment: assessmentForm
    };
    
    if (editingId) {
      const { error: saveError } = await supabase.from("interviews").update(payload).eq("id", editingId);
      if (saveError) setError("Erro ao atualizar entrevista: " + saveError.message);
      else { setIsModalOpen(false); loadInterviews(); }
    } else {
      const { error: saveError } = await supabase.from("interviews").insert(payload);
      if (saveError) setError("Erro ao salvar entrevista: " + saveError.message);
      else { setIsModalOpen(false); loadInterviews(); }
    }
    setSaving(false);
  };

  const openNewModal = () => {
    setEditingId(null);
    setForm({ candidate_name: "", role: "", phone: "", email: "", interview_date: "", interview_time: "", status: "Aguardando", result: "N/C" });
    setAssessmentForm(defaultAssessment);
    setActiveTab("dados");
    setIsModalOpen(true);
  };
  
  const openEditModal = (interview: Interview) => {
    setEditingId(interview.id);
    setForm({
      candidate_name: interview.candidate_name || "",
      role: interview.role || "",
      phone: interview.phone || "",
      email: interview.email || "",
      interview_date: interview.interview_date || "",
      interview_time: interview.interview_time || "",
      status: interview.status || "Aguardando",
      result: interview.result || "N/C",
    });
    setAssessmentForm(interview.assessment || defaultAssessment);
    setActiveTab("dados");
    setIsModalOpen(true);
  };

  const PREDEFINED_STRENGTHS = ["Proatividade", "Boa Comunicação", "Experiência", "Trabalho em Equipe", "Organização", "Liderança", "Foco em Resultados", "Empatia", "Resiliência"];
  const PREDEFINED_WEAKNESSES = ["Timidez", "Falta de Experiência Técnica", "Insegurança", "Dificuldade com Ferramentas", "Postura", "Conhecimento Básico", "Nervosismo", "Falta de Clareza"];

  const toggleListItem = (list: string, item: string) => {
    const arr = list ? list.split(',').map(s => s.trim()).filter(Boolean) : [];
    if (arr.includes(item)) {
      return arr.filter(i => i !== item).join(', ');
    } else {
      return [...arr, item].join(', ');
    }
  };

  const generateParecerText = () => {
    const parts: string[] = [];
    if (assessmentForm.technical) parts.push(`Apresentou uma avaliação técnica ${assessmentForm.technical.toLowerCase()}.`);
    if (assessmentForm.communication) parts.push(`Sua comunicação foi avaliada como ${assessmentForm.communication.toLowerCase()}.`);
    if (assessmentForm.cultural_fit) parts.push(`Demonstrou aderência cultural ${assessmentForm.cultural_fit.toLowerCase()} com os valores da empresa.`);
    
    const fortes = assessmentForm.strengths ? assessmentForm.strengths.split(',').map(s => s.trim().toLowerCase()) : [];
    if (fortes.length > 0) {
      parts.push(`Como pontos fortes, destacou-se por apresentar ${fortes.join(', ')}.`);
    }

    const fracos = assessmentForm.weaknesses ? assessmentForm.weaknesses.split(',').map(s => s.trim().toLowerCase()) : [];
    if (fracos.length > 0) {
      parts.push(`Como pontos de atenção e desenvolvimento, notou-se: ${fracos.join(', ')}.`);
    }

    if (parts.length === 0) {
      parts.push("Nenhuma avaliação técnica ou comportamental preenchida.");
    } else {
      parts.push("Candidato(a) " + (form.result === "Aprovado" ? "recomendado(a) para a vaga." : form.result === "Reprovado" ? "não recomendado(a) para a vaga neste momento." : "aguardando definição final."));
    }

    setAssessmentForm(prev => ({
      ...prev,
      observations: parts.join(' ')
    }));
  };

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="flex-1 p-8 space-y-6 max-w-7xl mx-auto w-full">
        <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Registro de Entrevistas</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Gerenciamento de candidatos, avaliações e pareceres.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={exportToCsv} disabled={filtered.length === 0}>
              <Download className="mr-2 h-4 w-4" />
              Exportar Excel
            </Button>
            <Button onClick={openNewModal} className="gap-2">
              <Plus className="h-4 w-4" />
              Nova Entrevista
            </Button>
          </div>
        </header>

        {error && <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">{error}</div>}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Metric icon={User} label="Total Registros" value={filtered.length} />
          <Metric icon={Calendar} label="Confirmados" value={confirmados} />
          <Metric icon={CheckCircle2} label="Compareceram" value={compareceram} />
          <Metric icon={CheckCircle2} label="Aprovados" value={aprovados} />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar candidato, cargo, status..."
              className="pl-9 bg-muted/30 border-border/50 h-10 text-sm rounded-md"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-muted-foreground">Mês:</span>
            <Input 
              type="month" 
              value={selectedMonth} 
              onChange={(e) => setSelectedMonth(e.target.value)} 
              className="h-10 w-44 bg-muted/30 border-border/50"
            />
            {selectedMonth && (
              <Button variant="ghost" size="sm" onClick={() => setSelectedMonth("")} className="text-xs text-muted-foreground">
                Limpar
              </Button>
            )}
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left align-top">
              <thead className="bg-muted/50 border-b border-border">
                <tr className="text-muted-foreground font-medium">
                  <th className="px-4 py-3">Candidato</th>
                  <th className="px-4 py-3">Cargo Alvo</th>
                  <th className="px-4 py-3">Data / Hora</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Resultado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {loading && (
                  <tr><td className="px-4 py-8 text-center text-muted-foreground" colSpan={5}>Carregando entrevistas...</td></tr>
                )}
                {!loading && filtered.length === 0 && (
                  <tr><td className="px-4 py-8 text-center text-muted-foreground" colSpan={5}>Nenhum registro encontrado.</td></tr>
                )}
                {!loading && filtered.map((interview) => (
                  <tr key={interview.id} onClick={() => openEditModal(interview)} className="hover:bg-muted/30 cursor-pointer transition-colors">
                    <td className="px-4 py-3 min-w-64">
                      <div className="font-medium text-foreground">{interview.candidate_name || "Sem nome"}</div>
                      <div className="mt-1 text-xs text-muted-foreground space-y-0.5">
                        {interview.phone && <div>{interview.phone}</div>}
                        {interview.email && <div>{interview.email}</div>}
                      </div>
                    </td>
                    <td className="px-4 py-3 min-w-44 font-medium text-muted-foreground">
                      {interview.role || "Não informado"}
                    </td>
                    <td className="px-4 py-3 min-w-36 text-muted-foreground">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5" />
                        {interview.interview_date ? new Date(interview.interview_date).toLocaleDateString("pt-BR", {timeZone: "UTC"}) : "N/D"}
                      </div>
                      {interview.interview_time && (
                        <div className="flex items-center gap-1.5 mt-1 text-xs">
                          <Clock className="h-3.5 w-3.5" />
                          {interview.interview_time}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 min-w-36">
                       <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${statusStyle[interview.status || ""] || "bg-muted text-muted-foreground"}`}>
                         {interview.status || "N/A"}
                       </span>
                    </td>
                    <td className="px-4 py-3 min-w-36 font-medium">
                       <span className={resultStyle[interview.result || ""] || ""}>
                         {interview.result || "-"}
                       </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modal Entrevista */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-background w-full max-w-3xl rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between p-4 border-b shrink-0">
              <div>
                <h2 className="text-lg font-semibold">{editingId ? "Editar Entrevista & Avaliação" : "Registrar Nova Entrevista"}</h2>
                <p className="text-sm text-muted-foreground">
                  {editingId ? "Altere dados do candidato ou adicione o parecer da entrevista." : "Preencha os dados do candidato e da entrevista."}
                </p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setIsModalOpen(false)}>
                <X className="h-5 w-5" />
              </Button>
            </div>
            
            <div className="border-b px-6 flex gap-6 shrink-0">
              <button 
                onClick={() => setActiveTab("dados")}
                className={`py-3 text-sm font-medium border-b-2 transition-colors -mb-px ${activeTab === "dados" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
              >
                Dados Básicos
              </button>
              <button 
                onClick={() => setActiveTab("avaliacao")}
                className={`py-3 text-sm font-medium border-b-2 transition-colors -mb-px ${activeTab === "avaliacao" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
              >
                Parecer / Avaliação
              </button>
            </div>

            <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-6 space-y-6 flex flex-col">
              {activeTab === "dados" && (
                <div className="grid grid-cols-2 gap-4 flex-1">
                  <div className="space-y-1 col-span-2">
                    <Label>Nome do Candidato <span className="text-red-500">*</span></Label>
                    <Input 
                      required 
                      value={form.candidate_name} 
                      onChange={e => setForm({...form, candidate_name: e.target.value})} 
                      placeholder="Ex: João da Silva" 
                    />
                  </div>
                  
                  <div className="space-y-1 col-span-2 md:col-span-1">
                    <Label>Cargo Alvo</Label>
                    <Input 
                      value={form.role} 
                      onChange={e => setForm({...form, role: e.target.value})} 
                      placeholder="Ex: Pedreiro" 
                    />
                  </div>

                  <div className="space-y-1 col-span-2 md:col-span-1">
                    <Label>Telefone</Label>
                    <Input 
                      value={form.phone} 
                      onChange={e => setForm({...form, phone: e.target.value})} 
                      placeholder="(XX) XXXXX-XXXX" 
                    />
                  </div>

                  <div className="space-y-1 col-span-2">
                    <Label>E-mail</Label>
                    <Input 
                      type="email"
                      value={form.email} 
                      onChange={e => setForm({...form, email: e.target.value})} 
                      placeholder="joao@email.com" 
                    />
                  </div>

                  <div className="space-y-1">
                    <Label>Data da Entrevista <span className="text-red-500">*</span></Label>
                    <Input 
                      type="date"
                      required
                      value={form.interview_date} 
                      onChange={e => setForm({...form, interview_date: e.target.value})} 
                    />
                  </div>

                  <div className="space-y-1">
                    <Label>Horário</Label>
                    <Input 
                      type="time"
                      value={form.interview_time} 
                      onChange={e => setForm({...form, interview_time: e.target.value})} 
                    />
                  </div>

                  <div className="space-y-1">
                    <Label>Status</Label>
                    <select 
                      value={form.status} 
                      onChange={e => setForm({...form, status: e.target.value})}
                      className="flex h-9 w-full items-center justify-between whitespace-nowrap rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <option value="Aguardando">Aguardando</option>
                      <option value="Confirmado">Confirmado</option>
                      <option value="Compareceu">Compareceu</option>
                      <option value="Desistente">Desistente</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <Label>Resultado Final</Label>
                    <select 
                      value={form.result} 
                      onChange={e => setForm({...form, result: e.target.value})}
                      className="flex h-9 w-full items-center justify-between whitespace-nowrap rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <option value="N/C">N/C (Não Concluído)</option>
                      <option value="Aprovado">Aprovado</option>
                      <option value="Reprovado">Reprovado</option>
                      <option value="Desistente">Desistente</option>
                      <option value="Banco de Talentos">Banco de Talentos</option>
                    </select>
                  </div>
                </div>
              )}

              {activeTab === "avaliacao" && (
                <div className="space-y-5 flex-1">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <Label>Teste Psicológico Realizado?</Label>
                      <select 
                        value={assessmentForm.psychological_test} 
                        onChange={e => setAssessmentForm({...assessmentForm, psychological_test: e.target.value})}
                        className="flex h-9 w-full items-center justify-between whitespace-nowrap rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background focus:outline-none focus:ring-1 focus:ring-ring"
                      >
                        <option value="Não">Não</option>
                        <option value="Sim">Sim</option>
                      </select>
                    </div>

                                        {assessmentForm.psychological_test === "Sim" && (
                      <div className="space-y-4 md:col-span-2 p-5 bg-muted/30 rounded-lg border border-border/50">
                        <div className="flex items-center justify-between">
                          <Label className="text-base font-semibold">Testes Psicológicos</Label>
                          <Button type="button" size="sm" variant="outline" onClick={() => setAssessmentForm(p => ({...p, tests_list: [...(p.tests_list || []), { test_name: "G36", score: "" }]}))}>
                            <Plus className="h-4 w-4 mr-2" /> Adicionar Teste
                          </Button>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4 border-b border-border/50 pb-4">
                          <div className="space-y-1">
                            <Label>Idade do Candidato</Label>
                            <Input type="number" placeholder="Ex: 25" value={assessmentForm.age || ''} onChange={e => setAssessmentForm({...assessmentForm, age: e.target.value})} />
                          </div>
                          <div className="space-y-1">
                            <Label>Escolaridade</Label>
                            <select value={assessmentForm.education || 'Ensino Médio'} onChange={e => setAssessmentForm({...assessmentForm, education: e.target.value})} className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm">
                              <option value="Ensino Fundamental">Ensino Fundamental</option>
                              <option value="Ensino Médio">Ensino Médio</option>
                              <option value="Ensino Superior">Ensino Superior</option>
                              <option value="Pós-graduação">Pós-graduação</option>
                            </select>
                          </div>
                        </div>

                        <div className="space-y-3">
                          {(assessmentForm.tests_list || []).map((t, index) => {
                            const isNeo = t.test_name.includes("NEO");
                            return (
                            <div key={index} className="flex flex-col space-y-3 p-3 border border-border/50 bg-background rounded-md relative">
                              <Button type="button" variant="ghost" size="icon" className="absolute top-2 right-2 h-6 w-6 text-red-500 hover:text-red-700 hover:bg-red-100" onClick={() => {
                                const list = [...(assessmentForm.tests_list || [])];
                                list.splice(index, 1);
                                setAssessmentForm(p => ({...p, tests_list: list}));
                              }}>
                                <X className="h-4 w-4" />
                              </Button>
                              <div className="flex flex-col md:flex-row gap-3 pr-8">
                                <div className="flex-1 space-y-1">
                                  <Label>Nome do Teste</Label>
                                  <select value={t.test_name} onChange={e => {
                                      const list = [...(assessmentForm.tests_list || [])];
                                      list[index] = { ...list[index], test_name: e.target.value };
                                      if (e.target.value.includes("NEO")) list[index].factors = {N:"", E:"", O:"", A:"", C:""};
                                      setAssessmentForm(p => ({...p, tests_list: list}));
                                    }}
                                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm">
                                    <option value="G36">G36 (Inteligência/Lógico)</option>
                                    <option value="TEALT">TEALT (Atenção Alternada)</option>
                                    <option value="TEADI">TEADI (Atenção Dividida)</option>
                                    <option value="TEACO-FF">TEACO-FF (Atenção Concentrada)</option>
                                    <option value="NEO PI-R">NEO PI-R (Personalidade)</option>
                                    <option value="NEO FFI">NEO FFI (Personalidade)</option>
                                    <option value="Palográfico">Palográfico</option>
                                  </select>
                                </div>
                                {!isNeo && (
                                  <div className="flex-1 space-y-1">
                                    <Label>Pontuação (Acertos)</Label>
                                    <Input type="number" placeholder="Ex: 45" value={t.score} onChange={e => {
                                      const list = [...(assessmentForm.tests_list || [])];
                                      list[index].score = e.target.value;
                                      setAssessmentForm(p => ({...p, tests_list: list}));
                                    }} />
                                  </div>
                                )}
                              </div>
                              {isNeo && (
                                <div className="grid grid-cols-5 gap-2 mt-2 pt-2 border-t border-border/30">
                                  {["N", "E", "O", "A", "C"].map(f => (
                                    <div key={f} className="space-y-1">
                                      <Label title={f === 'N' ? 'Neuroticismo' : f === 'E' ? 'Extroversão' : f === 'O' ? 'Abertura' : f === 'A' ? 'Amabilidade' : 'Conscienciosidade'} className="cursor-help">Fator {f}</Label>
                                      <Input type="number" placeholder="0" value={t.factors?.[f as keyof typeof t.factors] || ''} onChange={e => {
                                        const list = [...(assessmentForm.tests_list || [])];
                                        if(!list[index].factors) list[index].factors = {};
                                        // @ts-ignore
                                        list[index].factors[f] = e.target.value;
                                        setAssessmentForm(p => ({...p, tests_list: list}));
                                      }} className="h-8 px-2" />
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )})}
                          {(assessmentForm.tests_list || []).length === 0 && (
                            <div className="text-sm text-muted-foreground text-center py-4 border-2 border-dashed rounded-md">
                              Nenhum teste adicionado. Clique no botão acima para adicionar.
                            </div>
                          )}
                        </div>

                        <div className="flex items-end pt-2">
                          <Button type="button" onClick={handleGenerateTestText} disabled={isGeneratingTest || (assessmentForm.tests_list || []).length === 0} className="w-full font-medium">
                            {isGeneratingTest ? "Calculando e Gerando Parecer..." : "Calcular Classificação & Gerar Parecer (IA)"}
                          </Button>
                        </div>

                        <div className="space-y-1 pt-2">
                          <Label>Resultado Final dos Testes (Gerado)</Label>
                          <Textarea 
                            placeholder="O parecer detalhado aparecerá aqui após o cálculo..."
                            value={assessmentForm.tests_details || ''}
                            onChange={(e) => setAssessmentForm({ ...assessmentForm, tests_details: e.target.value })}
                            className="min-h-[120px]"
                          />
                        </div>
                      </div>
                    )}

                    <div className="space-y-1">
                      <Label>Avaliação Técnica</Label>
                      <select 
                        value={assessmentForm.technical} 
                        onChange={e => setAssessmentForm({...assessmentForm, technical: e.target.value})}
                        className="flex h-9 w-full items-center justify-between whitespace-nowrap rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background focus:outline-none focus:ring-1 focus:ring-ring"
                      >
                        <option value="">Selecione...</option>
                        <option value="Excelente">Excelente (Domina o assunto)</option>
                        <option value="Boa">Boa (Tem conhecimento sólido)</option>
                        <option value="Básica">Básica (Precisa de treinamento)</option>
                        <option value="Insuficiente">Insuficiente (Não atende aos requisitos)</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <Label>Comunicação</Label>
                      <select 
                        value={assessmentForm.communication} 
                        onChange={e => setAssessmentForm({...assessmentForm, communication: e.target.value})}
                        className="flex h-9 w-full items-center justify-between whitespace-nowrap rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background focus:outline-none focus:ring-1 focus:ring-ring"
                      >
                        <option value="">Selecione...</option>
                        <option value="Excelente">Excelente (Articulado e claro)</option>
                        <option value="Boa">Boa (Comunica-se bem)</option>
                        <option value="Razoável">Razoável (Um pouco retraído)</option>
                        <option value="Ruim">Ruim (Dificuldade de expressão)</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <Label>Fit Cultural (Aderência)</Label>
                      <select 
                        value={assessmentForm.cultural_fit} 
                        onChange={e => setAssessmentForm({...assessmentForm, cultural_fit: e.target.value})}
                        className="flex h-9 w-full items-center justify-between whitespace-nowrap rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background focus:outline-none focus:ring-1 focus:ring-ring"
                      >
                        <option value="">Selecione...</option>
                        <option value="Alta">Alta (Total aderência aos valores)</option>
                        <option value="Média">Média (Aderência parcial)</option>
                        <option value="Baixa">Baixa (Pouca aderência aos valores)</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <Label className="text-base font-medium">Pontos Fortes</Label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {PREDEFINED_STRENGTHS.map(item => {
                        const checked = (assessmentForm.strengths || "").includes(item);
                        return (
                          <div key={item} className="flex items-center space-x-2">
                            <Checkbox 
                              id={`strength-${item}`} 
                              checked={checked}
                              onCheckedChange={() => setAssessmentForm(prev => ({...prev, strengths: toggleListItem(prev.strengths, item)}))}
                            />
                            <Label htmlFor={`strength-${item}`} className="text-sm font-normal cursor-pointer leading-tight">{item}</Label>
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <Label className="text-base font-medium">Pontos a Desenvolver</Label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {PREDEFINED_WEAKNESSES.map(item => {
                        const checked = (assessmentForm.weaknesses || "").includes(item);
                        return (
                          <div key={item} className="flex items-center space-x-2">
                            <Checkbox 
                              id={`weakness-${item}`} 
                              checked={checked}
                              onCheckedChange={() => setAssessmentForm(prev => ({...prev, weaknesses: toggleListItem(prev.weaknesses, item)}))}
                            />
                            <Label htmlFor={`weakness-${item}`} className="text-sm font-normal cursor-pointer leading-tight">{item}</Label>
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  <div className="space-y-2 border-t pt-4 mt-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-base font-medium">Parecer Final / Observações</Label>
                      <Button type="button" size="sm" variant="outline" onClick={generateParecerText} className="gap-2 text-primary border-primary/50 hover:bg-primary/10">
                        <span className="text-lg leading-none">🪄</span> Gerar Parecer
                      </Button>
                    </div>
                    <Textarea 
                      value={assessmentForm.observations} 
                      onChange={e => setAssessmentForm({...assessmentForm, observations: e.target.value})}
                      placeholder="O texto gerado aparecerá aqui. Você também pode digitar manualmente..."
                      className="resize-none min-h-[100px]"
                    />
                  </div>
                </div>
              )}

              <div className="flex justify-between items-center gap-2 pt-4 border-t mt-auto shrink-0">
                {editingId && activeTab === "avaliacao" ? (
                  <div className="flex gap-2">
                    <Button type="button" variant="secondary" onClick={exportParecer} className="gap-2">
                      <FileText className="h-4 w-4" />
                      Exportar .txt
                    </Button>
                    <Button type="button" variant="outline" onClick={printParecer} className="gap-2 text-primary border-primary/50 hover:bg-primary/10">
                      🖨️ Imprimir / PDF
                    </Button>
                  </div>
                ) : <div />}
                <div className="flex gap-2">
                  <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)}>Cancelar</Button>
                  <Button type="submit" disabled={saving}>
                    {saving ? "Salvando..." : "Salvar Entrevista"}
                  </Button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function Metric({ icon: Icon, label, value }: { icon: typeof Briefcase; label: string; value: number }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4 flex items-center gap-3">
      <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
        <Icon className="h-4 w-4 text-primary" />
      </div>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-xl font-bold">{value}</p>
      </div>
    </div>
  );
}
