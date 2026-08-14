"use client";

import React, { useState } from "react";
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from "recharts";
import { Check, X, AlertTriangle, AlertCircle, CheckCircle2, BookOpen } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";

type AssessmentData = any;

interface CandidateAssessmentTabProps {
  assessmentData: AssessmentData;
  isEditing: boolean;
  onChange: (field: string, value: any) => void;
}

const HARD_SKILLS = [
  { id: "tech_domain", label: "Conhecimento Técnico" },
  { id: "practical_experience", label: "Experiência Prática" },
  { id: "tools_software", label: "Ferramentas" },
  { id: "planning_quality", label: "Planejamento / Qualidade" },
  { id: "business_vision", label: "Visão de Negócio" },
];

const SOFT_SKILLS = [
  { id: "communication", label: "Comunicação" },
  { id: "leadership", label: "Liderança" },
  { id: "emotional_intelligence", label: "Int. Emocional" },
  { id: "problem_solving", label: "Res. de Problemas" },
  { id: "teamwork", label: "Trabalho em Equipe" },
];

const STRENGTHS_LIST = [
  "Autonomia", "Trabalho em Equipe", "Foco em Resultados", "Proatividade", 
  "Organização", "Comunicação Clara", "Liderança", "Resiliência"
];

const IMPROVEMENTS_LIST = [
  "Ansiedade", "Dificuldade em Delegar", "Desorganização", "Comunicação Fechada", 
  "Falta de Foco", "Impaciência", "Baixa Flexibilidade", "Gestão de Tempo"
];

export function CandidateAssessmentTab({ assessmentData, isEditing, onChange }: CandidateAssessmentTabProps) {
  // Radar Data
  const hardSkillsData = HARD_SKILLS.map(skill => ({
    subject: skill.label,
    A: Number(assessmentData[skill.id]) || 0,
    fullMark: 5,
  }));

  const softSkillsData = SOFT_SKILLS.map(skill => ({
    subject: skill.label,
    A: Number(assessmentData[skill.id]) || 0,
    fullMark: 5,
  }));

  const handleCheckboxArrayChange = (field: string, value: string, checked: boolean) => {
    let currentArray = [];
    try {
      if (typeof assessmentData[field] === 'string') {
        currentArray = JSON.parse(assessmentData[field] || "[]");
      } else if (Array.isArray(assessmentData[field])) {
        currentArray = assessmentData[field];
      }
    } catch (e) {
      currentArray = [];
    }

    if (checked) {
      onChange(field, JSON.stringify([...currentArray, value]));
    } else {
      onChange(field, JSON.stringify(currentArray.filter((v: string) => v !== value)));
    }
  };

  const getArrayValue = (field: string): string[] => {
    try {
      if (typeof assessmentData[field] === 'string') {
        return JSON.parse(assessmentData[field] || "[]");
      }
      if (Array.isArray(assessmentData[field])) {
        return assessmentData[field];
      }
      return [];
    } catch (e) {
      return [];
    }
  };

  const strengthsArray = getArrayValue('strengths');
  const improvementsArray = getArrayValue('improvement_points');

  return (
    <div className="space-y-6">
      
      {/* HEADER E ROTEIRO SUGERIDO */}
      <div className="flex items-center justify-between bg-primary/5 border border-primary/10 rounded-xl p-4">
        <div>
          <h3 className="font-bold text-primary flex items-center gap-2">
            <BookOpen className="h-4 w-4" />
            Guia do Avaliador
          </h3>
          <p className="text-sm text-muted-foreground mt-1">Utilize o método STAR (Situação, Tarefa, Ação, Resultado) para avaliar as competências.</p>
        </div>
        <Dialog>
          <DialogTrigger className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors bg-primary text-primary-foreground shadow hover:bg-primary/90 h-8 px-3">
            Ver Roteiro Sugerido
          </DialogTrigger>
          <DialogContent className="sm:max-w-md overflow-y-auto z-[100] sm:max-w-[500px]">
            <DialogHeader className="mb-6">
              <DialogTitle>Roteiro de Entrevista (STAR)</DialogTitle>
              <DialogDescription>
                Faça perguntas baseadas em situações passadas reais. Evite situações hipotéticas ("O que você faria se...").
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-6">
              <div className="bg-muted/30 p-4 rounded-lg border text-sm">
                <p className="font-bold mb-2">O Método STAR:</p>
                <ul className="space-y-1 list-disc pl-4 text-muted-foreground">
                  <li><strong className="text-foreground">S</strong>ituação: Qual era o contexto?</li>
                  <li><strong className="text-foreground">T</strong>arefa: Qual era o desafio ou meta?</li>
                  <li><strong className="text-foreground">A</strong>ção: O que o candidato FEZ de fato?</li>
                  <li><strong className="text-foreground">R</strong>esultado: Qual foi o impacto da ação?</li>
                </ul>
              </div>

              <div className="space-y-4">
                <div>
                  <h4 className="font-bold text-sm text-foreground flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-primary" /> Comunicação</h4>
                  <p className="text-sm text-muted-foreground mt-1 italic">"Fale sobre uma vez em que você teve que comunicar uma informação muito técnica ou difícil para pessoas que não eram da sua área."</p>
                </div>
                <div>
                  <h4 className="font-bold text-sm text-foreground flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-primary" /> Liderança</h4>
                  <p className="text-sm text-muted-foreground mt-1 italic">"Conte-me sobre um momento em que você teve que assumir a frente de um projeto ou situação sem ser formalmente o líder/chefe."</p>
                </div>
                <div>
                  <h4 className="font-bold text-sm text-foreground flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-primary" /> Inteligência Emocional</h4>
                  <p className="text-sm text-muted-foreground mt-1 italic">"Descreva uma situação em que você lidou com um colega de trabalho ou cliente extremamente difícil ou irritado. Como você agiu?"</p>
                </div>
                <div>
                  <h4 className="font-bold text-sm text-foreground flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-primary" /> Resolução de Problemas</h4>
                  <p className="text-sm text-muted-foreground mt-1 italic">"Fale sobre um problema grave e imprevisto que surgiu no seu último projeto/obra. Quais passos você tomou para resolver?"</p>
                </div>
                <div>
                  <h4 className="font-bold text-sm text-foreground flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-primary" /> Trabalho em Equipe</h4>
                  <p className="text-sm text-muted-foreground mt-1 italic">"Dê um exemplo de um projeto em que você precisou colaborar com pessoas de diferentes perfis para alcançar uma meta. Como você lidou com as diferenças?"</p>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* 1. GRÁFICOS DE RADAR E NOTAS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Hard Skills */}
        <div className="bg-card border rounded-xl p-5 shadow-sm">
          <h3 className="font-bold text-lg mb-4">Hard Skills (0 a 5)</h3>
          {isEditing ? (
            <div className="space-y-3">
              {HARD_SKILLS.map(skill => (
                <div key={skill.id} className="flex items-center justify-between">
                  <span className="text-sm font-medium">{skill.label}</span>
                  <div className="flex items-center gap-2 w-32">
                    <Input 
                      type="range" 
                      min="0" max="5" step="1"
                      className="w-full h-2 cursor-pointer p-0 border-0"
                      value={assessmentData[skill.id] || "0"} 
                      onChange={(e) => onChange(skill.id, e.target.value)} 
                    />
                    <span className="text-xs font-bold w-4 text-center">{assessmentData[skill.id] || "0"}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="h-[250px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart cx="50%" cy="50%" outerRadius="70%" data={hardSkillsData}>
                  <PolarGrid />
                  <PolarAngleAxis dataKey="subject" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} />
                  <PolarRadiusAxis angle={30} domain={[0, 5]} tick={false} axisLine={false} />
                  <Radar name="Hard Skills" dataKey="A" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.4} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Soft Skills */}
        <div className="bg-card border rounded-xl p-5 shadow-sm">
          <h3 className="font-bold text-lg mb-4">Soft Skills (0 a 5)</h3>
          {isEditing ? (
            <div className="space-y-3">
              {SOFT_SKILLS.map(skill => (
                <div key={skill.id} className="flex items-center justify-between">
                  <span className="text-sm font-medium">{skill.label}</span>
                  <div className="flex items-center gap-2 w-32">
                    <Input 
                      type="range" 
                      min="0" max="5" step="1"
                      className="w-full h-2 cursor-pointer p-0 border-0"
                      value={assessmentData[skill.id] || "0"} 
                      onChange={(e) => onChange(skill.id, e.target.value)} 
                    />
                    <span className="text-xs font-bold w-4 text-center">{assessmentData[skill.id] || "0"}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="h-[250px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart cx="50%" cy="50%" outerRadius="70%" data={softSkillsData}>
                  <PolarGrid />
                  <PolarAngleAxis dataKey="subject" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} />
                  <PolarRadiusAxis angle={30} domain={[0, 5]} tick={false} axisLine={false} />
                  <Radar name="Soft Skills" dataKey="A" stroke="#10b981" fill="#10b981" fillOpacity={0.4} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {/* 2. CHECKLIST DE PRONTIDÃO */}
      <div className="bg-card border rounded-xl p-5 shadow-sm">
        <h3 className="font-bold text-lg mb-4">Checklist de Prontidão (Realidade)</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { id: "salary_aligned", label: "Pretensão Salarial Alinhada?" },
            { id: "immediate_start", label: "Disponibilidade de Início?" },
            { id: "open_to_travel", label: "Aceita Viagem/Mudança?" }
          ].map(item => (
            <div key={item.id} className="flex items-center gap-3 p-3 border rounded-lg bg-muted/30">
              {isEditing ? (
                <Checkbox 
                  checked={assessmentData[item.id] === "sim" || assessmentData[item.id] === true}
                  onCheckedChange={(c) => onChange(item.id, c ? "sim" : "não")}
                />
              ) : (
                assessmentData[item.id] === "sim" || assessmentData[item.id] === true ? 
                  <CheckCircle2 className="h-5 w-5 text-emerald-500" /> : 
                  <X className="h-5 w-5 text-red-500" />
              )}
              <span className="text-sm font-semibold">{item.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 3. SENIORIDADE & FIT CULTURAL */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-card border rounded-xl p-5 shadow-sm space-y-4">
          <h3 className="font-bold text-lg">Senioridade</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className="text-xs text-muted-foreground block mb-1">Esperada (Vaga)</span>
              {isEditing ? (
                <select 
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={assessmentData.seniority_expected || ""}
                  onChange={(e) => onChange('seniority_expected', e.target.value)}
                >
                  <option value="">Selecione</option>
                  <option value="Estagiário">Estagiário</option>
                  <option value="Júnior">Júnior</option>
                  <option value="Pleno">Pleno</option>
                  <option value="Sênior">Sênior</option>
                  <option value="Especialista">Especialista</option>
                </select>
              ) : (
                <span className="font-semibold">{assessmentData.seniority_expected || "-"}</span>
              )}
            </div>
            <div>
              <span className="text-xs text-muted-foreground block mb-1">Avaliador Percebeu</span>
              {isEditing ? (
                <select 
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={assessmentData.seniority_evaluated || ""}
                  onChange={(e) => onChange('seniority_evaluated', e.target.value)}
                >
                  <option value="">Selecione</option>
                  <option value="Estagiário">Estagiário</option>
                  <option value="Júnior">Júnior</option>
                  <option value="Pleno">Pleno</option>
                  <option value="Sênior">Sênior</option>
                  <option value="Especialista">Especialista</option>
                </select>
              ) : (
                <span className="font-semibold">{assessmentData.seniority_evaluated || "-"}</span>
              )}
            </div>
          </div>
        </div>

        <div className="bg-card border rounded-xl p-5 shadow-sm space-y-4">
          <h3 className="font-bold text-lg">Fit Cultural (Alinhamento)</h3>
          {isEditing ? (
            <div className="space-y-3">
              <select 
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={assessmentData.culture_flag || ""}
                onChange={(e) => onChange('culture_flag', e.target.value)}
              >
                <option value="">Selecione uma Bandeira</option>
                <option value="green">🟢 Totalmente Alinhado (Green Flag)</option>
                <option value="yellow">🟡 Requer Atenção (Yellow Flag)</option>
                <option value="red">🔴 Desalinhado / Risco (Red Flag)</option>
              </select>
              <Input 
                placeholder="Breve justificativa..." 
                value={assessmentData.culture_reason || ""}
                onChange={(e) => onChange('culture_reason', e.target.value)}
              />
            </div>
          ) : (
            <div className="flex items-start gap-3">
              {assessmentData.culture_flag === 'green' && <CheckCircle2 className="h-6 w-6 text-emerald-500 mt-1" />}
              {assessmentData.culture_flag === 'yellow' && <AlertTriangle className="h-6 w-6 text-yellow-500 mt-1" />}
              {assessmentData.culture_flag === 'red' && <AlertCircle className="h-6 w-6 text-red-500 mt-1" />}
              {!assessmentData.culture_flag && <div className="h-6 w-6 rounded-full bg-muted mt-1" />}
              
              <div>
                <span className="font-semibold block">
                  {assessmentData.culture_flag === 'green' ? "Alinhado" : 
                   assessmentData.culture_flag === 'yellow' ? "Atenção" : 
                   assessmentData.culture_flag === 'red' ? "Risco Crítico" : "Não Avaliado"}
                </span>
                <span className="text-sm text-muted-foreground">{assessmentData.culture_reason || "Sem justificativa"}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 4. MÉTODO STAR: PONTOS FORTES E A DESENVOLVER */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-card border border-emerald-500/20 rounded-xl p-5 shadow-sm">
          <h3 className="font-bold text-emerald-600 mb-4 flex items-center gap-2">
            <Check className="h-5 w-5" /> Pontos Fortes
          </h3>
          {isEditing ? (
            <div className="grid grid-cols-2 gap-3">
              {STRENGTHS_LIST.map(item => (
                <div key={item} className="flex items-center space-x-2">
                  <Checkbox 
                    id={`s_${item}`} 
                    checked={strengthsArray.includes(item)}
                    onCheckedChange={(c) => handleCheckboxArrayChange('strengths', item, !!c)}
                  />
                  <label htmlFor={`s_${item}`} className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                    {item}
                  </label>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {strengthsArray.length > 0 ? strengthsArray.map((item: string) => (
                <span key={item} className="px-3 py-1 bg-emerald-500/10 text-emerald-600 text-xs font-semibold rounded-full border border-emerald-500/20">
                  {item}
                </span>
              )) : <span className="text-sm text-muted-foreground">Nenhum ponto registrado</span>}
            </div>
          )}
        </div>

        <div className="bg-card border border-orange-500/20 rounded-xl p-5 shadow-sm">
          <h3 className="font-bold text-orange-600 mb-4 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" /> Pontos a Desenvolver
          </h3>
          {isEditing ? (
            <div className="grid grid-cols-2 gap-3">
              {IMPROVEMENTS_LIST.map(item => (
                <div key={item} className="flex items-center space-x-2">
                  <Checkbox 
                    id={`i_${item}`} 
                    checked={improvementsArray.includes(item)}
                    onCheckedChange={(c) => handleCheckboxArrayChange('improvement_points', item, !!c)}
                  />
                  <label htmlFor={`i_${item}`} className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                    {item}
                  </label>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {improvementsArray.length > 0 ? improvementsArray.map((item: string) => (
                <span key={item} className="px-3 py-1 bg-orange-500/10 text-orange-600 text-xs font-semibold rounded-full border border-orange-500/20">
                  {item}
                </span>
              )) : <span className="text-sm text-muted-foreground">Nenhum ponto registrado</span>}
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
