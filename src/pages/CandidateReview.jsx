import React, { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { User, Briefcase, GraduationCap, MapPin, ExternalLink, ThumbsUp, ThumbsDown, MessageSquare } from 'lucide-react';

const CandidateReview = () => {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const jobId = searchParams.get('job');

  const [candidate, setCandidate] = useState(null);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState('');
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    fetchData();
  }, [id]);

  const fetchData = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('candidates')
      .select(`
        *,
        candidate_experiences(*),
        candidate_educations(*),
        job_applications(*)
      `)
      .eq('id', id)
      .single();

    if (!error && data) {
      setCandidate(data);
    }
    setLoading(false);
  };

  const handleFeedback = async (decision) => {
    setSaving(true);
    const newStatus = decision === 'Aprovado' ? 'Proposta' : 'Reprovado';
    
    // Update Application Status and append notes
    const app = candidate.job_applications.find(a => a.job_opening_id === jobId);
    if (app) {
      const updatedNotes = app.notes ? `${app.notes}\n\n[Gestor - ${decision}]: ${feedback}` : `[Gestor - ${decision}]: ${feedback}`;
      await supabase.from('job_applications').update({
        status: newStatus,
        notes: updatedNotes
      }).eq('id', app.id);
    }

    setSaving(false);
    setDone(true);
  };

  if (loading) return <div style={{ padding: '4rem', textAlign: 'center' }}>Carregando perfil...</div>;
  if (!candidate) return <div style={{ padding: '4rem', textAlign: 'center' }}>Candidato não encontrado.</div>;

  if (done) {
    return (
      <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: 'var(--color-bg)' }}>
        <div style={{ textAlign: 'center', background: 'var(--color-surface)', padding: '3rem', borderRadius: '16px', border: '1px solid var(--color-border)' }}>
          <ThumbsUp size={48} color="var(--color-primary)" style={{ margin: '0 auto 1rem' }} />
          <h2>Avaliação Registrada!</h2>
          <p style={{ color: 'var(--color-text-muted)' }}>Obrigado pelo seu feedback. O RH já foi notificado.</p>
        </div>
      </main>
    );
  }

  return (
    <main style={{ minHeight: '100vh', background: 'var(--color-bg)', padding: '2rem 1rem' }}>
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        {/* Header Profile */}
        <section style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '16px', padding: '2rem', marginBottom: '1.5rem', display: 'flex', gap: '2rem', alignItems: 'center' }}>
          <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'var(--color-primary)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem', fontWeight: 700 }}>
            {candidate.full_name.charAt(0)}
          </div>
          <div>
            <h1 style={{ margin: '0 0 0.5rem', fontSize: '1.8rem' }}>{candidate.full_name}</h1>
            <div style={{ display: 'flex', gap: '1rem', color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}><MapPin size={16} /> {candidate.city}/{candidate.state}</span>
              {candidate.linkedin_url && (
                <a href={candidate.linkedin_url} target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: '#0a66c2', textDecoration: 'none' }}>
                  <ExternalLink size={16} /> LinkedIn
                </a>
              )}
            </div>
          </div>
        </section>

        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.5rem' }}>
          {/* Left Column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            
            {/* Experiências */}
            <section style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '16px', padding: '1.5rem' }}>
              <h2 style={{ margin: '0 0 1.5rem', fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Briefcase size={20} /> Experiência Profissional</h2>
              {candidate.candidate_experiences?.length > 0 ? candidate.candidate_experiences.map(exp => (
                <div key={exp.id} style={{ marginBottom: '1.5rem', paddingBottom: '1.5rem', borderBottom: '1px solid var(--color-border)' }}>
                  <h3 style={{ margin: '0 0 0.2rem', fontSize: '1.1rem' }}>{exp.position_title}</h3>
                  <p style={{ margin: '0 0 0.5rem', fontWeight: 600, color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>{exp.company_name}</p>
                  <p style={{ margin: '0 0 0.5rem', fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
                    {new Date(exp.start_date).toLocaleDateString('pt-BR', { month: 'short', year: 'numeric'})} - {exp.is_current ? 'Atual' : new Date(exp.end_date).toLocaleDateString('pt-BR', { month: 'short', year: 'numeric'})}
                  </p>
                  <p style={{ margin: 0, fontSize: '0.95rem', lineHeight: 1.5 }}>{exp.description}</p>
                </div>
              )) : <p style={{ color: 'var(--color-text-muted)' }}>Nenhuma experiência cadastrada.</p>}
            </section>

            {/* Formação */}
            <section style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '16px', padding: '1.5rem' }}>
              <h2 style={{ margin: '0 0 1.5rem', fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><GraduationCap size={20} /> Formação Acadêmica</h2>
              {candidate.candidate_educations?.length > 0 ? candidate.candidate_educations.map(edu => (
                <div key={edu.id} style={{ marginBottom: '1rem' }}>
                  <h3 style={{ margin: '0 0 0.2rem', fontSize: '1.1rem' }}>{edu.degree} em {edu.field_of_study}</h3>
                  <p style={{ margin: '0 0 0.2rem', fontWeight: 600, color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>{edu.institution_name}</p>
                </div>
              )) : <p style={{ color: 'var(--color-text-muted)' }}>Nenhuma formação cadastrada.</p>}
            </section>
          </div>

          {/* Right Column - Decision */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <section style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '16px', padding: '1.5rem' }}>
              <h2 style={{ margin: '0 0 1rem', fontSize: '1.1rem' }}>Tags Comportamentais</h2>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                {candidate.behavioral_tags?.map(tag => (
                  <span key={tag} style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', padding: '0.3rem 0.6rem', borderRadius: '4px', fontSize: '0.8rem' }}>{tag}</span>
                ))}
              </div>
            </section>

            <section style={{ background: 'var(--color-surface)', border: '2px solid var(--color-primary)', borderRadius: '16px', padding: '1.5rem', position: 'sticky', top: '2rem' }}>
              <h2 style={{ margin: '0 0 1rem', fontSize: '1.25rem', color: 'var(--color-primary)' }}>Avaliação do Gestor</h2>
              <p style={{ fontSize: '0.9rem', color: 'var(--color-text-muted)', marginBottom: '1rem' }}>Deixe seu feedback para o RH e decida se quer avançar com este candidato.</p>
              
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem', fontWeight: 600, marginBottom: '0.5rem' }}>
                  <MessageSquare size={16} /> Comentários (Opcional)
                </label>
                <textarea 
                  rows="4"
                  value={feedback}
                  onChange={e => setFeedback(e.target.value)}
                  placeholder="O que achou do perfil? Destaque pontos fortes ou fracos..."
                  style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--color-border)', background: 'var(--color-bg)', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button 
                  onClick={() => handleFeedback('Reprovado')}
                  disabled={saving}
                  style={{ flex: 1, padding: '0.75rem', background: '#fef2f2', color: '#ef4444', border: '1px solid #fca5a5', borderRadius: '8px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                  <ThumbsDown size={18} /> Reprovar
                </button>
                <button 
                  onClick={() => handleFeedback('Aprovado')}
                  disabled={saving}
                  style={{ flex: 1, padding: '0.75rem', background: '#dcfce7', color: '#166534', border: '1px solid #86efac', borderRadius: '8px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                  <ThumbsUp size={18} /> Aprovar
                </button>
              </div>
            </section>
          </div>
        </div>
      </div>
    </main>
  );
};

export default CandidateReview;
