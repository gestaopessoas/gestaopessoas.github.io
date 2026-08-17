"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Plus, Trash2, GripVertical, ArrowUp, ArrowDown, Pencil, Loader2, ArrowLeft } from "lucide-react";
import Link from "next/link";
import {
  EvaluationTemplate, Question, QuestionType, QUESTION_TYPE_LABELS, newQuestionId,
} from "@/lib/evaluations/types";

function emptyQuestion(): Question {
  return { id: newQuestionId(), type: "scale", label: "", required: true };
}

function QuestionEditor({
  question, onChange, onRemove, onMoveUp, onMoveDown, isFirst, isLast,
}: {
  question: Question;
  onChange: (q: Question) => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  isFirst: boolean;
  isLast: boolean;
}) {
  return (
    <div className="rounded-md border p-4 space-y-3 bg-muted/30">
      <div className="flex items-start gap-3">
        <GripVertical className="w-4 h-4 mt-2.5 text-muted-foreground shrink-0" />
        <div className="flex-1 space-y-3">
          <Input
            placeholder="Enunciado da pergunta"
            value={question.label}
            onChange={(e) => onChange({ ...question, label: e.target.value })}
          />
          <div className="flex flex-wrap items-center gap-3">
            <Select
              value={question.type}
              onValueChange={(v) => onChange({ ...question, type: v as QuestionType, options: v === "multiple_choice" ? (question.options ?? ["", ""]) : undefined })}
            >
              <SelectTrigger className="w-56"><SelectValue placeholder="Tipo" /></SelectTrigger>
              <SelectContent>
                {Object.entries(QUESTION_TYPE_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex items-center gap-2">
              <Switch checked={question.required} onCheckedChange={(c) => onChange({ ...question, required: !!c })} />
              <Label className="text-sm">Obrigatória</Label>
            </div>
          </div>
          {question.type === "multiple_choice" && (
            <div className="space-y-2 pl-1">
              {(question.options ?? []).map((opt, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <Input
                    placeholder={`Opção ${idx + 1}`}
                    value={opt}
                    onChange={(e) => {
                      const options = [...(question.options ?? [])];
                      options[idx] = e.target.value;
                      onChange({ ...question, options });
                    }}
                  />
                  <Button
                    type="button" variant="ghost" size="icon-sm"
                    onClick={() => onChange({ ...question, options: (question.options ?? []).filter((_, i) => i !== idx) })}
                    disabled={(question.options ?? []).length <= 2}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
              <Button
                type="button" variant="outline" size="sm"
                onClick={() => onChange({ ...question, options: [...(question.options ?? []), ""] })}
              >
                <Plus className="w-3.5 h-3.5 mr-1" /> Adicionar opção
              </Button>
            </div>
          )}
        </div>
        <div className="flex flex-col gap-1">
          <Button type="button" variant="ghost" size="icon-sm" onClick={onMoveUp} disabled={isFirst}><ArrowUp className="w-4 h-4" /></Button>
          <Button type="button" variant="ghost" size="icon-sm" onClick={onMoveDown} disabled={isLast}><ArrowDown className="w-4 h-4" /></Button>
          <Button type="button" variant="ghost" size="icon-sm" onClick={onRemove}><Trash2 className="w-4 h-4 text-destructive" /></Button>
        </div>
      </div>
    </div>
  );
}

export default function TemplatesPage() {
  const supabase = createClient();
  const [templates, setTemplates] = useState<EvaluationTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [questions, setQuestions] = useState<Question[]>([]);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("evaluation_templates").select("*").order("created_at", { ascending: false });
    setTemplates((data ?? []) as EvaluationTemplate[]);
    setLoading(false);
  };

  useEffect(() => {
    const run = async () => { await load(); };
    run();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const openNew = () => {
    setEditingId(null);
    setName("");
    setDescription("");
    setQuestions([emptyQuestion()]);
    setEditorOpen(true);
  };

  const openEdit = (t: EvaluationTemplate) => {
    setEditingId(t.id);
    setName(t.name);
    setDescription(t.description ?? "");
    setQuestions(t.questions.length ? t.questions : [emptyQuestion()]);
    setEditorOpen(true);
  };

  const updateQuestion = (idx: number, q: Question) => {
    setQuestions((prev) => prev.map((p, i) => (i === idx ? q : p)));
  };

  const move = (idx: number, dir: -1 | 1) => {
    setQuestions((prev) => {
      const next = [...prev];
      const target = idx + dir;
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });
  };

  const save = async () => {
    if (!name.trim() || questions.some((q) => !q.label.trim())) return;
    setSaving(true);
    const payload = { name: name.trim(), description: description.trim() || null, questions };
    if (editingId) {
      await supabase.from("evaluation_templates").update(payload).eq("id", editingId);
    } else {
      await supabase.from("evaluation_templates").insert(payload);
    }
    setSaving(false);
    setEditorOpen(false);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Excluir este template? Ciclos que já o utilizam continuam com as respostas salvas.")) return;
    await supabase.from("evaluation_templates").delete().eq("id", id);
    load();
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/dashboard/avaliacoes" className="text-sm text-muted-foreground inline-flex items-center gap-1 hover:underline mb-1">
            <ArrowLeft className="w-3.5 h-3.5" /> Voltar para Avaliações
          </Link>
          <h1 className="text-3xl font-bold tracking-tight">Templates de Formulário</h1>
          <p className="text-muted-foreground text-sm">Monte os formulários usados nos ciclos de avaliação.</p>
        </div>
        <Button className="gap-2" onClick={openNew}><Plus className="w-4 h-4" /> Novo Template</Button>
      </div>

      {loading ? (
        <p className="text-muted-foreground">Carregando...</p>
      ) : templates.length === 0 ? (
        <div className="text-center p-8 border border-dashed rounded-md text-muted-foreground">
          Nenhum template cadastrado ainda.
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {templates.map((t) => (
            <Card key={t.id}>
              <CardHeader>
                <CardTitle className="text-lg">{t.name}</CardTitle>
                {t.description && <CardDescription>{t.description}</CardDescription>}
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{t.questions.length} pergunta{t.questions.length !== 1 ? "s" : ""}</p>
              </CardContent>
              <CardFooter className="gap-2">
                <Button variant="outline" size="sm" className="flex-1 gap-2" onClick={() => openEdit(t)}>
                  <Pencil className="w-3.5 h-3.5" /> Editar
                </Button>
                <Button variant="ghost" size="sm" onClick={() => remove(t.id)}>
                  <Trash2 className="w-3.5 h-3.5 text-destructive" />
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar Template" : "Novo Template"}</DialogTitle>
            <DialogDescription>Defina as perguntas que compõem este formulário de avaliação.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Nome do template</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Avaliação de Competências 360°" />
            </div>
            <div className="space-y-1.5">
              <Label>Descrição (opcional)</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Contexto para quem for responder" />
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Perguntas</Label>
                <Button type="button" variant="outline" size="sm" className="gap-1" onClick={() => setQuestions((prev) => [...prev, emptyQuestion()])}>
                  <Plus className="w-3.5 h-3.5" /> Adicionar pergunta
                </Button>
              </div>
              {questions.map((q, idx) => (
                <QuestionEditor
                  key={q.id}
                  question={q}
                  onChange={(nq) => updateQuestion(idx, nq)}
                  onRemove={() => setQuestions((prev) => prev.filter((_, i) => i !== idx))}
                  onMoveUp={() => move(idx, -1)}
                  onMoveDown={() => move(idx, 1)}
                  isFirst={idx === 0}
                  isLast={idx === questions.length - 1}
                />
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditorOpen(false)}>Cancelar</Button>
            <Button onClick={save} disabled={saving || !name.trim() || questions.length === 0}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Salvar Template
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
