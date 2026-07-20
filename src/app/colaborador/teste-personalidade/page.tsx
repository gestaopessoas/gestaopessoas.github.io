"use client";

import { Button } from "@/components/ui/button";
import { createClient } from "@/utils/supabase/client";
import { CheckCircle2, ChevronRight, ChevronLeft, AlertCircle } from "lucide-react";
import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";

function BfiBar({ label, score, description }: { label: string, score: number, description: string }) {
  const percent = ((score - 1) / 4) * 100;
  return (
    <div className="mb-6">
      <div className="flex justify-between items-end mb-1">
        <span className="font-semibold text-foreground">{label}</span>
        <span className="font-bold text-primary">{score.toFixed(1)} / 5.0</span>
      </div>
      <div className="w-full h-3 bg-secondary rounded-full overflow-hidden mb-2">
        <div className="h-full bg-primary" style={{ width: `${Math.max(0, Math.min(100, percent))}%` }}></div>
      </div>
      <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
    </div>
  );
}

function TestContent() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session");
  
  const [questions, setQuestions] = useState<any[]>([]);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [error, setError] = useState("");
  const [sessionError, setSessionError] = useState("");
  const [results, setResults] = useState<any>(null);
  
  const [currentPage, setCurrentPage] = useState(0);
  const questionsPerPage = 20;

  useEffect(() => {
    if (!sessionId) {
      setSessionError("Link inválido. O parâmetro de sessão está ausente.");
      setLoading(false);
      return;
    }

    const init = async () => {
      const supabase = createClient();
      
      // Check session
      const { data: sessionData, error: sessErr } = await supabase
        .from("candidate_big_five_results")
        .select("*")
        .eq("id", sessionId)
        .single();
        
      if (sessErr || !sessionData) {
        setSessionError("Sessão não encontrada ou link inválido.");
        setLoading(false);
        return;
      }
      
      if (sessionData.raw_answers && Object.keys(sessionData.raw_answers).length > 0) {
        // Already filled, show results!
        setResults(sessionData);
        setCompleted(true);
        setLoading(false);
        return;
      }

      // Fetch questions
      const { data, error } = await supabase
        .from("big_five_questions")
        .select("id, item_number, item_text")
        .order("item_number", { ascending: true });

      if (error || !data || data.length === 0) {
        setError("Erro ao carregar as perguntas.");
      } else {
        setQuestions(data);
      }
      setLoading(false);
    };

    init();
  }, [sessionId]);

  const handleAnswer = (questionId: string, score: number) => {
    setAnswers((prev) => ({ ...prev, [questionId]: score }));
  };

  const submit = async () => {
    if (Object.keys(answers).length < questions.length) {
      setError("Por favor, responda todas as perguntas antes de finalizar.");
      return;
    }
    
    setError("");
    setSaving(true);
    
    const supabase = createClient();
    const { data: updatedData, error: updateError } = await supabase
      .from("candidate_big_five_results")
      .update({ raw_answers: answers })
      .eq("id", sessionId)
      .select()
      .single();
      
    setSaving(false);
    
    if (updateError) {
      setError("Houve um erro ao salvar suas respostas. Tente novamente.");
    } else {
      setResults(updatedData);
      setCompleted(true);
    }
  };

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center bg-muted/30"><p>Carregando...</p></div>;
  }

  if (sessionError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30 p-6">
         <div className="w-full max-w-md rounded-lg border bg-card p-8 text-center shadow-sm">
           <AlertCircle className="mx-auto mb-4 h-12 w-12 text-destructive" />
           <h1 className="text-xl font-semibold text-destructive">Acesso Negado</h1>
           <p className="mt-3 text-muted-foreground">{sessionError}</p>
         </div>
      </div>
    );
  }

  if (completed && results) {
    return (
      <main className="min-h-screen bg-muted/30 py-12 px-4">
        <div className="mx-auto max-w-3xl rounded-xl border bg-card p-8 shadow-sm">
          <div className="text-center mb-10">
            <CheckCircle2 className="mx-auto mb-4 h-16 w-16 text-emerald-500" />
            <h1 className="text-3xl font-bold tracking-tight">Mapeamento Concluído</h1>
            <p className="mt-3 text-muted-foreground max-w-xl mx-auto">
              Obrigado por completar o seu teste de personalidade. Abaixo você confere o seu perfil de acordo com a metodologia Big Five, que avalia 5 grandes dimensões do comportamento humano.
            </p>
          </div>
          
          <div className="bg-muted/10 p-6 rounded-lg border">
            <h2 className="text-xl font-semibold mb-6">Seus Resultados:</h2>
            
            <BfiBar 
              label="Abertura à Experiência (O)" 
              score={results.openness_score || 0} 
              description="Indica o grau de curiosidade, imaginação e preferência por novidades. Pessoas com pontuação alta costumam ser mais criativas e abertas a novas ideias. Pontuações baixas indicam preferência pela rotina e pelo que é familiar e tradicional." 
            />
            
            <BfiBar 
              label="Conscienciosidade (C)" 
              score={results.conscientiousness_score || 0} 
              description="Mede a organização, disciplina e foco em metas. Pontuações altas sugerem alguém metódico, confiável e orientado a resultados. Pontuações baixas indicam maior flexibilidade, espontaneidade e, às vezes, menor foco no planejamento." 
            />
            
            <BfiBar 
              label="Extroversão (E)" 
              score={results.extraversion_score || 0} 
              description="Reflete a energia, sociabilidade e busca por estímulos sociais. Quem pontua alto costuma ser comunicativo e ganha energia interagindo com outros. Quem pontua baixo (introvertidos) tende a ser mais reservado e ganha energia em momentos de introspecção." 
            />
            
            <BfiBar 
              label="Amabilidade (A)" 
              score={results.agreeableness_score || 0} 
              description="Avalia a tendência à cooperação, empatia e compaixão. Pontuações altas indicam pessoas amigáveis, colaborativas e que evitam conflitos. Pontuações baixas podem apontar para pessoas mais competitivas, críticas e questionadoras." 
            />
            
            <BfiBar 
              label="Neuroticismo (N)" 
              score={results.neuroticism_score || 0} 
              description="Indica a sensibilidade ao estresse e a estabilidade emocional. Pontuações altas sugerem maior reatividade emocional, preocupação e ansiedade diante de problemas. Pontuações baixas indicam pessoas calmas, resilientes e emocionalmente estáveis." 
            />
          </div>
        </div>
      </main>
    );
  }

  const totalPages = Math.ceil(questions.length / questionsPerPage);
  const currentQuestions = questions.slice(currentPage * questionsPerPage, (currentPage + 1) * questionsPerPage);
  const allAnsweredOnCurrentPage = currentQuestions.every(q => answers[q.id] !== undefined);

  return (
    <main className="min-h-screen bg-muted/30 px-4 py-8">
      <div className="mx-auto max-w-4xl">
        <header className="mb-8 text-center">
          <h1 className="text-3xl font-semibold tracking-tight">Mapeamento de Perfil Profissional</h1>
          <p className="mt-2 text-muted-foreground">
            Este questionário nos ajuda a entender melhor seu estilo de trabalho. Não há respostas certas ou erradas, seja sincero.
          </p>
          <div className="mt-4 flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <span>Progresso: {Object.keys(answers).length} de {questions.length} respondidas</span>
          </div>
          <div className="mx-auto mt-2 h-2 w-full max-w-md overflow-hidden rounded-full bg-secondary">
            <div 
              className="h-full bg-primary transition-all duration-300" 
              style={{ width: `${(Object.keys(answers).length / questions.length) * 100}%` }}
            />
          </div>
        </header>

        {error && (
          <div className="mb-6 rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-center text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="space-y-6">
          {currentQuestions.map((q, idx) => (
            <div key={q.id} className="rounded-lg border bg-card p-6 shadow-sm">
              <p className="mb-4 font-medium text-card-foreground">
                <span className="mr-2 text-muted-foreground">{q.item_number}.</span>
                {q.item_text}
              </p>
              
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <span className="hidden text-xs text-muted-foreground sm:inline-block">Discordo Totalmente</span>
                <div className="flex w-full justify-between gap-2 sm:w-auto sm:justify-center">
                  {[1, 2, 3, 4, 5].map((score) => (
                    <label 
                      key={score} 
                      className={`flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border transition-colors hover:bg-muted ${answers[q.id] === score ? 'border-primary bg-primary text-primary-foreground hover:bg-primary' : 'border-input bg-background'}`}
                    >
                      <input 
                        type="radio" 
                        name={`question-${q.id}`} 
                        value={score} 
                        className="sr-only"
                        checked={answers[q.id] === score}
                        onChange={() => handleAnswer(q.id, score)}
                      />
                      <span className={answers[q.id] === score ? 'font-bold' : ''}>{score}</span>
                    </label>
                  ))}
                </div>
                <span className="hidden text-xs text-muted-foreground sm:inline-block">Concordo Totalmente</span>
              </div>
              <div className="mt-2 flex justify-between text-xs text-muted-foreground sm:hidden">
                <span>Discordo</span>
                <span>Concordo</span>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-8 flex items-center justify-between rounded-lg border bg-card p-4">
          <Button 
            variant="outline" 
            onClick={() => setCurrentPage(p => Math.max(0, p - 1))}
            disabled={currentPage === 0}
          >
            <ChevronLeft className="mr-2 h-4 w-4" /> Anterior
          </Button>
          
          <span className="text-sm font-medium">
            Página {currentPage + 1} de {totalPages}
          </span>
          
          {currentPage < totalPages - 1 ? (
            <Button 
              onClick={() => {
                if (!allAnsweredOnCurrentPage) {
                  setError("Por favor, responda todas as perguntas desta página antes de avançar.");
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                  return;
                }
                setError("");
                setCurrentPage(p => p + 1);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
            >
              Próxima <ChevronRight className="ml-2 h-4 w-4" />
            </Button>
          ) : (
            <Button 
              onClick={submit} 
              disabled={saving}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {saving ? "Enviando..." : "Finalizar Teste"}
            </Button>
          )}
        </div>
      </div>
    </main>
  );
}

export default function ColaboradorTestePersonalidade() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center"><p>Carregando ambiente...</p></div>}>
      <TestContent />
    </Suspense>
  );
}
