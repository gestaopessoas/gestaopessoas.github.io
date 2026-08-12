"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, BarChart3, ShieldCheck, Loader2, MessageSquare, Lock, Unlock, Send } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

type Feedback = { id?: string; feedback: string; created_at?: string };
type Survey = {
  id: string;
  title: string;
  description?: string;
  status?: string;
  created_at: string;
  responsesCount: number;
  enps: number;
  promoters: number;
  neutrals: number;
  detractors: number;
  feedbacks: Feedback[];
};

export default function ClimaPage() {
  const supabase = createClient();
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedSurvey, setSelectedSurvey] = useState<Survey | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [surveyToAnswer, setSurveyToAnswer] = useState<Survey | null>(null);
  const [selectedScore, setSelectedScore] = useState<number | null>(null);
  const [feedbackText, setFeedbackText] = useState("");
  const [submittingAnswer, setSubmittingAnswer] = useState(false);
  const [answerError, setAnswerError] = useState<string | null>(null);

  const handleAnswerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!surveyToAnswer || selectedScore === null) return;
    setSubmittingAnswer(true);
    setAnswerError(null);

    const { error: insertError } = await supabase.from('climate_survey_responses').insert([
      {
        survey_id: surveyToAnswer.id,
        score: selectedScore,
        feedback: feedbackText.trim() || null,
        employee_id: null,
      },
    ]);

    setSubmittingAnswer(false);
    if (insertError) {
      setAnswerError(insertError.message);
      return;
    }

    setSurveyToAnswer(null);
    setSelectedScore(null);
    setFeedbackText("");
    fetchData();
  };

  async function fetchData() {
    setLoading(true);
    const { data: srvs } = await supabase.from('climate_surveys').select('*').order('created_at', { ascending: false });
    const { data: resps } = await supabase.from('climate_survey_responses').select('*');

    const parsed = (srvs || []).map((s) => {
      const sr = (resps || []).filter((r) => r.survey_id === s.id);
      
      let enps = 0;
      let promoters = 0;
      let detractors = 0;
      let neutrals = 0;
      if (sr.length > 0) {
        promoters = sr.filter((r) => r.score != null && Number(r.score) >= 9).length;
        detractors = sr.filter((r) => r.score != null && Number(r.score) <= 6).length;
        neutrals = sr.length - promoters - detractors;
        enps = Math.round(((promoters - detractors) / sr.length) * 100);
      }

      const feedbacks = sr.filter((r) => r.feedback && String(r.feedback).trim().length > 0);

      return { ...s, responsesCount: sr.length, enps, promoters, neutrals, detractors, feedbacks };
    });

    setSurveys(parsed);
    setLoading(false);
  }

  const handleToggleStatus = async (survey: Survey) => {
    const isActive = !survey.status || survey.status === 'ACTIVE' || survey.status === 'Ativo';
    const nextStatus = isActive ? 'CLOSED' : 'ACTIVE';
    setUpdatingId(survey.id);
    await supabase.from('climate_surveys').update({ status: nextStatus }).eq('id', survey.id);
    setUpdatingId(null);
    if (selectedSurvey && selectedSurvey.id === survey.id) {
      setSelectedSurvey((prev) => prev ? { ...prev, status: nextStatus } : null);
    }
    fetchData();
  };

  useEffect(() => {
    fetchData();
  }, [supabase]);

  const handleCreateSurvey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    setError(null);

    const { error: insertError } = await supabase.from('climate_surveys').insert([
      {
        title: title.trim(),
        description: description.trim() || null,
        status: 'ACTIVE',
        survey_date: new Date().toISOString().split('T')[0],
      }
    ]);

    setSaving(false);
    if (insertError) {
      setError(insertError.message);
      return;
    }

    setTitle("");
    setDescription("");
    setIsModalOpen(false);
    fetchData();
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Pesquisa de Clima (eNPS)</h1>
          <p className="text-muted-foreground text-sm flex items-center gap-1 mt-1">
            <ShieldCheck className="w-4 h-4 text-green-500" /> Todas as pesquisas são 100% anônimas. O ID do funcionário nunca é gravado.
          </p>
        </div>
        <Button className="gap-2" onClick={() => setIsModalOpen(true)}><Plus className="w-4 h-4" /> Nova Pesquisa</Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><BarChart3 className="w-5 h-5"/> Histórico de Pesquisas</CardTitle>
          <CardDescription>Acompanhe o termômetro da empresa e a satisfação geral.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? <p>Carregando...</p> : (
            <div className="space-y-4">
              {surveys.map(survey => (
                <div key={survey.id} className="flex flex-col md:flex-row md:items-center justify-between border p-4 rounded-md hover:border-primary">
                  <div className="space-y-1">
                    <h3 className="font-semibold text-lg flex items-center gap-2">
                      {survey.title}
                      {!(!survey.status || survey.status === 'ACTIVE' || survey.status === 'Ativo') && <span className="text-xs bg-muted px-2 py-0.5 rounded-full uppercase">Encerrada</span>}
                    </h3>
                    {survey.description && (
                      <p className="text-sm text-muted-foreground">{survey.description}</p>
                    )}
                    <div className="text-sm text-muted-foreground">
                      Publicada em {format(new Date(survey.created_at), 'dd/MM/yyyy')}
                    </div>
                  </div>
                  <div className="mt-4 md:mt-0 flex flex-wrap items-center gap-4">
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground uppercase">Respostas</p>
                      <p className="font-bold text-xl">{survey.responsesCount}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground uppercase">eNPS</p>
                      <p className={`font-bold text-xl ${survey.enps > 50 ? 'text-green-500' : survey.enps > 0 ? 'text-amber-500' : 'text-red-500'}`}>
                        {survey.enps}
                      </p>
                    </div>
                    {(!survey.status || survey.status === 'ACTIVE' || survey.status === 'Ativo') ? (
                      <Button size="sm" onClick={() => setSurveyToAnswer(survey)} className="gap-1.5">
                        <Send className="w-3.5 h-3.5" />
                        Responder Pesquisa
                      </Button>
                    ) : (
                      <Button size="sm" variant="secondary" disabled className="gap-1.5">
                        Encerrada para Respostas
                      </Button>
                    )}
                    <Button variant="outline" size="sm" onClick={() => setSelectedSurvey(survey)}>
                      Ver Relatório Analítico
                    </Button>
                    <Button
                      variant={(!survey.status || survey.status === 'ACTIVE' || survey.status === 'Ativo') ? "outline" : "default"}
                      size="sm"
                      onClick={() => handleToggleStatus(survey)}
                      disabled={updatingId === survey.id}
                      className="gap-1.5"
                    >
                      {updatingId === survey.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (!survey.status || survey.status === 'ACTIVE' || survey.status === 'Ativo') ? (
                        <>
                          <Lock className="w-3.5 h-3.5" />
                          Encerrar
                        </>
                      ) : (
                        <>
                          <Unlock className="w-3.5 h-3.5" />
                          Reabrir
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              ))}
              {surveys.length === 0 && (
                <div className="text-center p-8 border border-dashed rounded-md text-muted-foreground">
                  Nenhuma pesquisa de clima rodou ainda.
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Nova Pesquisa de Clima</DialogTitle>
            <DialogDescription>
              Lance uma nova pesquisa (eNPS) para avaliar o clima e a satisfação no trabalho.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateSurvey} className="space-y-4 mt-4">
            {error && (
              <div className="bg-destructive/10 text-destructive p-3 rounded-md text-sm">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="title">Título *</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="ex: Pesquisa de Clima Q3 2026"
                disabled={saving}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Descrição / Objetivo</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="ex: Avaliação trimestral do clima e satisfação no trabalho"
                disabled={saving}
                rows={3}
              />
            </div>

            <div className="flex justify-end pt-4 gap-2">
              <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)} disabled={saving}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saving || !title.trim()}>
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                Criar Pesquisa
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedSurvey} onOpenChange={(open) => !open && setSelectedSurvey(null)}>
        <DialogContent className="sm:max-w-[650px] max-h-[85vh] overflow-y-auto">
          {selectedSurvey && (
            <>
              <DialogHeader>
                <div className="flex items-center justify-between gap-2 pr-6">
                  <DialogTitle className="text-xl font-bold flex items-center gap-2">
                    {selectedSurvey.title}
                    <span className={`text-xs px-2 py-0.5 rounded-full uppercase font-normal ${(!selectedSurvey.status || selectedSurvey.status === 'ACTIVE' || selectedSurvey.status === 'Ativo') ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : 'bg-muted text-muted-foreground'}`}>
                      {(!selectedSurvey.status || selectedSurvey.status === 'ACTIVE' || selectedSurvey.status === 'Ativo') ? 'Ativo' : 'Encerrado'}
                    </span>
                  </DialogTitle>
                </div>
                <DialogDescription>
                  Relatório Analítico de Clima • Publicada em {format(new Date(selectedSurvey.created_at), 'dd/MM/yyyy')}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-6 my-2">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 bg-muted/40 rounded-lg border">
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground uppercase">Respostas</p>
                    <p className="font-bold text-2xl mt-1">{selectedSurvey.responsesCount}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground uppercase">eNPS</p>
                    <p className={`font-bold text-2xl mt-1 ${selectedSurvey.enps > 50 ? 'text-green-500' : selectedSurvey.enps > 0 ? 'text-amber-500' : 'text-red-500'}`}>
                      {selectedSurvey.enps}
                    </p>
                  </div>
                  <div className="col-span-2 flex justify-around items-center border-t sm:border-t-0 sm:border-l pt-3 sm:pt-0 mt-2 sm:mt-0">
                    <div className="text-center">
                      <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 mr-1" />
                      <span className="text-xs text-muted-foreground uppercase">Promotores (9-10)</span>
                      <p className="font-semibold text-emerald-500 text-lg">
                        {selectedSurvey.promoters} <span className="text-xs text-muted-foreground">({selectedSurvey.responsesCount ? Math.round((selectedSurvey.promoters / selectedSurvey.responsesCount) * 100) : 0}%)</span>
                      </p>
                    </div>
                    <div className="text-center">
                      <span className="inline-block w-2 h-2 rounded-full bg-amber-500 mr-1" />
                      <span className="text-xs text-muted-foreground uppercase">Neutros (7-8)</span>
                      <p className="font-semibold text-amber-500 text-lg">
                        {selectedSurvey.neutrals} <span className="text-xs text-muted-foreground">({selectedSurvey.responsesCount ? Math.round((selectedSurvey.neutrals / selectedSurvey.responsesCount) * 100) : 0}%)</span>
                      </p>
                    </div>
                    <div className="text-center">
                      <span className="inline-block w-2 h-2 rounded-full bg-red-500 mr-1" />
                      <span className="text-xs text-muted-foreground uppercase">Detratores (0-6)</span>
                      <p className="font-semibold text-red-500 text-lg">
                        {selectedSurvey.detractors} <span className="text-xs text-muted-foreground">({selectedSurvey.responsesCount ? Math.round((selectedSurvey.detractors / selectedSurvey.responsesCount) * 100) : 0}%)</span>
                      </p>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="font-semibold text-sm mb-3 flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-primary" />
                    Feedbacks Anônimos ({selectedSurvey.feedbacks.length})
                  </h4>
                  {selectedSurvey.feedbacks.length > 0 ? (
                    <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                      {selectedSurvey.feedbacks.map((fb, index) => (
                        <div key={fb.id || index} className="p-3 bg-card border rounded-md text-sm space-y-1">
                          <p className="text-foreground italic">&ldquo;{fb.feedback}&rdquo;</p>
                          {fb.created_at && (
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(fb.created_at), 'dd/MM/yyyy HH:mm')}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground italic border p-4 rounded-md text-center bg-muted/20">
                      Nenhum comentário por extenso foi deixado nas respostas desta pesquisa
                    </p>
                  )}
                </div>
              </div>

              <div className="flex justify-between items-center pt-4 border-t">
                <Button
                  variant={(!selectedSurvey.status || selectedSurvey.status === 'ACTIVE' || selectedSurvey.status === 'Ativo') ? "outline" : "default"}
                  size="sm"
                  onClick={() => handleToggleStatus(selectedSurvey)}
                  disabled={updatingId === selectedSurvey.id}
                  className="gap-2"
                >
                  {updatingId === selectedSurvey.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (!selectedSurvey.status || selectedSurvey.status === 'ACTIVE' || selectedSurvey.status === 'Ativo') ? (
                    <>
                      <Lock className="w-4 h-4" />
                      Encerrar Pesquisa
                    </>
                  ) : (
                    <>
                      <Unlock className="w-4 h-4" />
                      Reabrir Pesquisa
                    </>
                  )}
                </Button>
                <Button variant="outline" size="sm" onClick={() => setSelectedSurvey(null)}>
                  Fechar
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!surveyToAnswer}
        onOpenChange={(open) => {
          if (!open) {
            setSurveyToAnswer(null);
            setSelectedScore(null);
            setFeedbackText("");
            setAnswerError(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-[520px]">
          {surveyToAnswer && (
            <>
              <DialogHeader>
                <DialogTitle>{surveyToAnswer.title}</DialogTitle>
                <DialogDescription className="flex items-center gap-1.5 pt-1 text-xs text-muted-foreground">
                  <ShieldCheck className="w-4 h-4 text-green-500 shrink-0" />
                  Sua resposta é 100% anônima e confidencial. O ID do funcionário nunca é gravado.
                </DialogDescription>
              </DialogHeader>

              <form onSubmit={handleAnswerSubmit} className="space-y-4 mt-2">
                {answerError && (
                  <div className="bg-destructive/10 text-destructive p-3 rounded-md text-sm">
                    {answerError}
                  </div>
                )}

                <div className="space-y-2">
                  <Label className="font-semibold text-sm">
                    Em uma escala de 0 a 10, o quanto você recomendaria a empresa como um bom lugar para trabalhar? *
                  </Label>
                  <div className="grid grid-cols-11 gap-1 pt-2">
                    {Array.from({ length: 11 }, (_, i) => i).map((score) => {
                      const isSelected = selectedScore === score;
                      let colorClass = "hover:bg-muted";
                      if (isSelected) {
                        if (score <= 6) colorClass = "bg-red-500 text-white hover:bg-red-600";
                        else if (score <= 8) colorClass = "bg-amber-500 text-white hover:bg-amber-600";
                        else colorClass = "bg-green-500 text-white hover:bg-green-600";
                      }
                      return (
                        <button
                          key={score}
                          type="button"
                          disabled={submittingAnswer}
                          onClick={() => setSelectedScore(score)}
                          className={`h-10 rounded-md font-medium text-sm border transition-colors ${colorClass} ${
                            isSelected ? "border-transparent ring-2 ring-offset-1 ring-primary font-bold" : "border-input bg-background"
                          }`}
                        >
                          {score}
                        </button>
                      );
                    })}
                  </div>
                  <div className="flex justify-between text-[10px] text-muted-foreground pt-1">
                    <span>0 - Não recomendaria de jeito nenhum</span>
                    <span>10 - Recomendaria com certeza</span>
                  </div>
                </div>

                <div className="space-y-2 pt-2">
                  <Label htmlFor="feedback" className="font-semibold text-sm">
                    O que motivou a sua nota? <span className="font-normal text-muted-foreground">(Opcional, 100% anônimo)</span>
                  </Label>
                  <Textarea
                    id="feedback"
                    value={feedbackText}
                    onChange={(e) => setFeedbackText(e.target.value)}
                    placeholder="Deixe comentários, sugestões ou críticas construtivas..."
                    disabled={submittingAnswer}
                    rows={3}
                  />
                </div>

                <div className="flex justify-end pt-2 gap-2">
                  <Button type="button" variant="outline" onClick={() => setSurveyToAnswer(null)} disabled={submittingAnswer}>
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={submittingAnswer || selectedScore === null}>
                    {submittingAnswer ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                    Registrar Resposta
                  </Button>
                </div>
              </form>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
