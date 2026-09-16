"use client";

import React, { useState } from "react";
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from "recharts";
import { Check, X, AlertTriangle, AlertCircle, CheckCircle2, BookOpen } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { SENIORITY_OPTIONS } from "@/app/dashboard/colaboradores/lib/employeeFormRules.mjs";
import GuiaAvaliadorButton from "@/components/GuiaAvaliadorButton";

type AssessmentData = any;

interface CandidateAssessmentTabProps {
  assessmentData: AssessmentData;
  /** Repassado ao Guia do Avaliador para ele puxar as competências do cargo da candidatura. */
  candidateId?: string | null;
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

const ASSESSMENT_SENIORITY_OPTIONS = ["Estagiário", ...SENIORITY_OPTIONS.filter(Boolean), "Especialista"];

const SOFT_SKILLS = [
  { id: "communication_score", label: "Comunicação" },
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

export function CandidateAssessmentTab({ assessmentData, candidateId, isEditing, onChange }: CandidateAssessmentTabProps) {
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
        <GuiaAvaliadorButton candidateId={candidateId} label="Ver Roteiro Sugerido" />
      </div>

      {/* 1. GRÁFICOS DE RADAR E NOTAS */}
      <div className="grid gap-6 [grid-template-columns:repeat(auto-fit,minmax(20rem,1fr))]">
        {/* Hard Skills */}
        <div className="bg-card border rounded-xl p-5 shadow-sm">
          <h3 className="font-bold text-lg mb-4">Hard Skills (0 a 5)</h3>
          {isEditing ? (
            <div className="space-y-3">
              {HARD_SKILLS.map(skill => (
                <div key={skill.id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                  <label htmlFor={`skill-${skill.id}`} className="text-sm font-medium">{skill.label}</label>
                  {/* O slider precisa de largura própria: em tela estreita ele quebra para a
                      linha de baixo inteiro, em vez de encolher para 14px (issue #67). */}
                  <div className="flex w-full min-w-[9rem] flex-1 items-center gap-2 sm:w-32 sm:flex-none">
                    {/* Em tela estreita o preenchimento é por teclado: sem anel de foco não
                        dá para ver onde se está (issue #71). */}
                    <Input
                      type="range"
                      id={`skill-${skill.id}`}
                      min="0" max="5" step="1"
                      className="w-full h-2 cursor-pointer p-0 border-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                      value={assessmentData[skill.id] || "0"}
                      aria-valuetext={`${assessmentData[skill.id] || "0"} de 5`}
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
                <div key={skill.id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                  <label htmlFor={`skill-${skill.id}`} className="text-sm font-medium">{skill.label}</label>
                  {/* O slider precisa de largura própria: em tela estreita ele quebra para a
                      linha de baixo inteiro, em vez de encolher para 14px (issue #67). */}
                  <div className="flex w-full min-w-[9rem] flex-1 items-center gap-2 sm:w-32 sm:flex-none">
                    {/* Em tela estreita o preenchimento é por teclado: sem anel de foco não
                        dá para ver onde se está (issue #71). */}
                    <Input
                      type="range"
                      id={`skill-${skill.id}`}
                      min="0" max="5" step="1"
                      className="w-full h-2 cursor-pointer p-0 border-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                      value={assessmentData[skill.id] || "0"}
                      aria-valuetext={`${assessmentData[skill.id] || "0"} de 5`}
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
        <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(13rem,1fr))]">
          {[
            { id: "salary_aligned", label: "Pretensão Salarial Alinhada?" },
            { id: "immediate_start", label: "Disponibilidade de Início?" },
            { id: "open_to_travel", label: "Aceita Viagem/Mudança?" }
          ].map(item => (
            <div key={item.id} className="flex items-start gap-3 rounded-lg border bg-muted/30 p-3">
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
              <span className="text-sm font-semibold leading-tight">{item.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 3. SENIORIDADE & FIT CULTURAL */}
      <div className="grid gap-6 [grid-template-columns:repeat(auto-fit,minmax(20rem,1fr))]">
        <div className="bg-card border rounded-xl p-5 shadow-sm space-y-4">
          <h3 className="font-bold text-lg">Senioridade</h3>
          <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(9rem,1fr))]">
            <div>
              <span className="text-xs text-muted-foreground block mb-1">Esperada (Vaga)</span>
              {isEditing ? (
                <select 
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={assessmentData.seniority_expected || ""}
                  onChange={(e) => onChange('seniority_expected', e.target.value)}
                >
                  <option value="">Selecione</option>
                  {ASSESSMENT_SENIORITY_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
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
                  {ASSESSMENT_SENIORITY_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
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
      <div className="grid gap-6 [grid-template-columns:repeat(auto-fit,minmax(20rem,1fr))]">
        <div className="bg-card border border-emerald-500/20 rounded-xl p-5 shadow-sm">
          <h3 className="font-bold text-emerald-600 mb-4 flex items-center gap-2">
            <Check className="h-5 w-5" /> Pontos Fortes
          </h3>
          {isEditing ? (
            <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(10rem,1fr))]">
              {STRENGTHS_LIST.map(item => (
                <div key={item} className="flex items-start gap-2">
                  <Checkbox 
                    id={`s_${item}`} 
                    checked={strengthsArray.includes(item)}
                    onCheckedChange={(c) => handleCheckboxArrayChange('strengths', item, !!c)}
                  />
                  <label htmlFor={`s_${item}`} className="text-sm font-medium leading-tight peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
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
            <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(10rem,1fr))]">
              {IMPROVEMENTS_LIST.map(item => (
                <div key={item} className="flex items-start gap-2">
                  <Checkbox 
                    id={`i_${item}`} 
                    checked={improvementsArray.includes(item)}
                    onCheckedChange={(c) => handleCheckboxArrayChange('improvement_points', item, !!c)}
                  />
                  <label htmlFor={`i_${item}`} className="text-sm font-medium leading-tight peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
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
