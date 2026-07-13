import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { CheckCircle2, ChevronRight, ChevronLeft, Briefcase, GraduationCap, User, Sparkles } from 'lucide-react';

const BEHAVIORAL_TAGS = [
  'Lideranca', 'Comunicacao clara', 'Organizacao', 'Disciplina', 'Proatividade',
  'Mao na massa', 'Analitico', 'Atencao a detalhes', 'Senso de urgencia',
  'Resiliencia', 'Trabalho sob pressao', 'Autonomia', 'Colaborativo',
  'Negociacao', 'Empatia', 'Foco em resultado', 'Aprendizado rapido',
  'Postura profissional', 'Planejamento', 'Resolucao de problemas'
];

const CandidateApplicationForm = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [job, setJob] = useState(null);
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  // Form State
  const [personal, setPersonal] = useState({ full_name: '', email: '', phone: '', linkedin_url: '', city: '', state: '' });
  const [experiences, setExperiences] = useState([]);
  const [educations, setEducations] = useState([]);
  const [tags, setTags] = useState([]);

  useEffect(() => {
    fetchJobDetails();
  }, [id]);

  const fetchJobDetails = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('job_openings')
      .select('*, job_profiles(title)')
      .eq('id', id)
      .single();
      
    if (!error && data) setJob(data);
    setLoading(false);
  };

  const addExperience = () => setExperiences([...experiences, { company_name: '', position_title: '', start_date: '', end_date: '', is_current: false, description: '' }]);
  const updateExp = (index, field, value) => {
    const newExp = [...experiences];
    newExp[index][field] = value;
    setExperiences(newExp);
  };
  const removeExp = (index) => setExperiences(experiences.filter((_, i) => i !== index));

  const addEducation = () => setEducations([...educations, { institution_name: '', degree: 'Graduação', field_of_study: '', start_date: '', end_date: '' }]);
  const updateEdu = (index, field, value) => {
    const newEdu = [...educations];
    newEdu[index][field] = value;
    setEducations(newEdu);
  };
  const removeEdu = (index) => setEducations(educations.filter((_, i) => i !== index));

  const toggleTag = (tag) => {
    setTags(tags.includes(tag) ? tags.filter(t => t !== tag) : [...tags, tag]);
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    
    // 1. Insert Candidate
    const { data: candData, error: candError } = await supabase
      .from('candidates')
      .insert([{ ...personal, behavioral_tags: tags }])
      .select('id')
      .single();

    if (candError) {
      console.error(candError);
      setSubmitting(false);
      return;
    }

    const candidateId = candData.id;

    // 2. Insert Experiences
    if (experiences.length > 0) {
      const expPayload = experiences.map(exp => ({ ...exp, candidate_id: candidateId }));
      await supabase.from('candidate_experiences').insert(expPayload);
    }

    // 3. Insert Educations
    if (educations.length > 0) {
      const eduPayload = educations.map(edu => ({ ...edu, candidate_id: candidateId }));
      await supabase.from('candidate_educations').insert(eduPayload);
    }

    // 4. Insert Job Application
    await supabase.from('job_applications').insert([{ candidate_id: candidateId, job_opening_id: id }]);

    setSubmitting(false);
    setSuccess(true);
  };

  const inputStyle = { width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--color-border)', background: 'var(--color-bg)', marginBottom: '1rem' };
  const labelStyle = { display: 'block', marginBottom: '0.3rem', fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-text-muted)' };

  if (loading) return <div style={{ padding: '4rem', textAlign: 'center' }}>Carregando vaga...</div>;
  if (!job) return <div style={{ padding: '4rem', textAlign: 'center' }}>Vaga não encontrada.</div>;

  if (success) {
    return (
      <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: 'var(--color-bg)', padding: '2rem' }}>
        <section style={{ maxWidth: '520px', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '16px', padding: '3rem', textAlign: 'center', boxShadow: 'var(--shadow-lg)' }}>
          <CheckCircle2 size={64} color="#22c55e" style={{ margin: '0 auto 1.5rem' }} />
          <h1 style={{ margin: '0 0 1rem', fontSize: '1.8rem' }}>Inscrição Concluída!</h1>
          <p style={{ color: 'var(--color-text-muted)', lineHeight: 1.6, marginBottom: '2rem' }}>
            Seu perfil foi enviado com sucesso para a vaga de <strong>{job.job_profiles?.title}</strong>. Acompanhe seu e-mail para próximos passos.
          </p>
          <button className="btn-primary" onClick={() => navigate('/carreiras')} style={{ width: '100%' }}>Ver mais vagas</button>
        </section>
      </main>
    );
  }

  return (
    <main style={{ minHeight: '100vh', background: 'var(--color-bg)', padding: '2rem 1rem' }}>
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        {/* Header */}
        <header style={{ marginBottom: '2rem', textAlign: 'center' }}>
          <h1 style={{ margin: '0 0 0.5rem', fontSize: '2rem' }}>{job.job_profiles?.title}</h1>
          <p style={{ color: 'var(--color-text-muted)' }}>Complete seu perfil para se candidatar</p>
        </header>

        {/* Progress Bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2rem', position: 'relative' }}>
          <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, height: '2px', background: 'var(--color-border)', zIndex: 0 }}></div>
          {[
            { num: 1, icon: User, label: 'Pessoal' },
            { num: 2, icon: Briefcase, label: 'Experiência' },
            { num: 3, icon: GraduationCap, label: 'Formação' },
            { num: 4, icon: Sparkles, label: 'Perfil' }
          ].map(s => (
            <div key={s.num} style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
              <div style={{ 
                width: '40px', height: '40px', borderRadius: '50%', display: 'grid', placeItems: 'center',
                background: step >= s.num ? 'var(--color-primary)' : 'var(--color-surface)',
                color: step >= s.num ? '#fff' : 'var(--color-text-muted)',
                border: `2px solid ${step >= s.num ? 'var(--color-primary)' : 'var(--color-border)'}`,
                transition: 'all 0.3s'
              }}>
                <s.icon size={18} />
              </div>
              <span style={{ fontSize: '0.8rem', fontWeight: step >= s.num ? 700 : 500, color: step >= s.num ? 'var(--color-text)' : 'var(--color-text-muted)' }}>{s.label}</span>
            </div>
          ))}
        </div>

        {/* Form Container */}
        <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '16px', padding: '2rem', boxShadow: 'var(--shadow-sm)' }}>
          {step === 1 && (
            <div className="fade-in">
              <h2 style={{ margin: '0 0 1.5rem', fontSize: '1.25rem' }}>Dados Pessoais</h2>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 1rem' }}>
                <div style={{ gridColumn: '1 / -1' }}><label style={labelStyle}>Nome Completo *</label><input required style={inputStyle} value={personal.full_name} onChange={e => setPersonal({...personal, full_name: e.target.value})} /></div>
                <div><label style={labelStyle}>E-mail *</label><input type="email" required style={inputStyle} value={personal.email} onChange={e => setPersonal({...personal, email: e.target.value})} /></div>
                <div><label style={labelStyle}>WhatsApp *</label><input type="tel" required style={inputStyle} value={personal.phone} onChange={e => setPersonal({...personal, phone: e.target.value})} /></div>
                <div><label style={labelStyle}>Cidade</label><input style={inputStyle} value={personal.city} onChange={e => setPersonal({...personal, city: e.target.value})} /></div>
                <div><label style={labelStyle}>Estado (UF)</label><input style={inputStyle} value={personal.state} onChange={e => setPersonal({...personal, state: e.target.value})} /></div>
                <div style={{ gridColumn: '1 / -1' }}><label style={labelStyle}>LinkedIn URL</label><input type="url" style={inputStyle} value={personal.linkedin_url} onChange={e => setPersonal({...personal, linkedin_url: e.target.value})} /></div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="fade-in">
              <h2 style={{ margin: '0 0 1.5rem', fontSize: '1.25rem' }}>Experiência Profissional</h2>
              {experiences.map((exp, index) => (
                <div key={index} style={{ border: '1px solid var(--color-border)', padding: '1.5rem', borderRadius: '12px', marginBottom: '1.5rem', position: 'relative' }}>
                  <button onClick={() => removeExp(index)} style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '0.85rem' }}>Remover</button>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 1rem' }}>
                    <div style={{ gridColumn: '1 / -1' }}><label style={labelStyle}>Empresa</label><input style={inputStyle} value={exp.company_name} onChange={e => updateExp(index, 'company_name', e.target.value)} /></div>
                    <div style={{ gridColumn: '1 / -1' }}><label style={labelStyle}>Cargo</label><input style={inputStyle} value={exp.position_title} onChange={e => updateExp(index, 'position_title', e.target.value)} /></div>
                    <div><label style={labelStyle}>Data Início</label><input type="date" style={inputStyle} value={exp.start_date} onChange={e => updateExp(index, 'start_date', e.target.value)} /></div>
                    <div><label style={labelStyle}>Data Fim</label><input type="date" style={inputStyle} value={exp.end_date} onChange={e => updateExp(index, 'end_date', e.target.value)} disabled={exp.is_current} /></div>
                    <div style={{ gridColumn: '1 / -1' }}><label style={labelStyle}>Resumo das Atividades</label><textarea rows="3" style={inputStyle} value={exp.description} onChange={e => updateExp(index, 'description', e.target.value)} /></div>
                  </div>
                </div>
              ))}
              <button onClick={addExperience} style={{ background: 'rgba(245,174,56,0.1)', color: 'var(--color-primary)', border: '1px dashed var(--color-primary)', padding: '1rem', width: '100%', borderRadius: '12px', cursor: 'pointer', fontWeight: 600 }}>+ Adicionar Experiência</button>
            </div>
          )}

          {step === 3 && (
            <div className="fade-in">
              <h2 style={{ margin: '0 0 1.5rem', fontSize: '1.25rem' }}>Formação Acadêmica</h2>
              {educations.map((edu, index) => (
                <div key={index} style={{ border: '1px solid var(--color-border)', padding: '1.5rem', borderRadius: '12px', marginBottom: '1.5rem', position: 'relative' }}>
                  <button onClick={() => removeEdu(index)} style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '0.85rem' }}>Remover</button>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 1rem' }}>
                    <div style={{ gridColumn: '1 / -1' }}><label style={labelStyle}>Instituição</label><input style={inputStyle} value={edu.institution_name} onChange={e => updateEdu(index, 'institution_name', e.target.value)} /></div>
                    <div><label style={labelStyle}>Nível (Grau)</label><input style={inputStyle} value={edu.degree} onChange={e => updateEdu(index, 'degree', e.target.value)} placeholder="Ex: Bacharelado, Técnico" /></div>
                    <div><label style={labelStyle}>Curso / Área</label><input style={inputStyle} value={edu.field_of_study} onChange={e => updateEdu(index, 'field_of_study', e.target.value)} /></div>
                  </div>
                </div>
              ))}
              <button onClick={addEducation} style={{ background: 'rgba(245,174,56,0.1)', color: 'var(--color-primary)', border: '1px dashed var(--color-primary)', padding: '1rem', width: '100%', borderRadius: '12px', cursor: 'pointer', fontWeight: 600 }}>+ Adicionar Formação</button>
            </div>
          )}

          {step === 4 && (
            <div className="fade-in">
              <h2 style={{ margin: '0 0 1.5rem', fontSize: '1.25rem' }}>Perfil e Comportamento</h2>
              <p style={{ color: 'var(--color-text-muted)', marginBottom: '1rem' }}>Selecione as tags que melhor descrevem seu perfil profissional (máximo 8 recomendadas).</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                {BEHAVIORAL_TAGS.map(tag => {
                  const selected = tags.includes(tag);
                  return (
                    <button
                      key={tag}
                      onClick={() => toggleTag(tag)}
                      style={{
                        padding: '0.5rem 1rem', borderRadius: '999px',
                        border: `1px solid ${selected ? 'var(--color-primary)' : 'var(--color-border)'}`,
                        background: selected ? 'var(--color-primary)' : 'transparent',
                        color: selected ? '#fff' : 'var(--color-text)',
                        cursor: 'pointer', fontWeight: selected ? 600 : 400,
                        transition: 'all 0.2s'
                      }}
                    >
                      {tag}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Navigation */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2rem', paddingTop: '1.5rem', borderTop: '1px solid var(--color-border)' }}>
            <button 
              className="btn-outline" 
              onClick={() => setStep(s => s - 1)} 
              style={{ opacity: step === 1 ? 0 : 1, pointerEvents: step === 1 ? 'none' : 'auto', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <ChevronLeft size={18} /> Voltar
            </button>
            
            {step < 4 ? (
              <button 
                className="btn-primary" 
                onClick={() => { if (step === 1 && (!personal.full_name || !personal.email)) { alert('Preencha nome e e-mail!'); return; } setStep(s => s + 1); }}
                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                Próximo <ChevronRight size={18} />
              </button>
            ) : (
              <button 
                className="btn-primary" 
                onClick={handleSubmit}
                disabled={submitting}
                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                {submitting ? 'Enviando...' : 'Concluir Inscrição'} <CheckCircle2 size={18} />
              </button>
            )}
          </div>
        </div>
      </div>
    </main>
  );
};

export default CandidateApplicationForm;
