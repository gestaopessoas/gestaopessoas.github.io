import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Search, MoreVertical, Calendar, Briefcase, ChevronRight, X, ExternalLink } from 'lucide-react';

const STAGES = ['Nova Aplicação', 'Triagem', 'Entrevista RH', 'Entrevista Gestor', 'Proposta', 'Contratado', 'Reprovado'];

const ATSBoard = ({ jobId, onClose }) => {
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [job, setJob] = useState(null);

  useEffect(() => {
    fetchData();
  }, [jobId]);

  const fetchData = async () => {
    setLoading(true);
    // Fetch Job Info
    const { data: jobData } = await supabase.from('job_openings').select('*, job_profiles(title)').eq('id', jobId).single();
    if (jobData) setJob(jobData);

    // Fetch Applications
    const { data: appData, error } = await supabase
      .from('job_applications')
      .select('*, candidates(*)')
      .eq('job_opening_id', jobId)
      .order('created_at', { ascending: false });

    if (!error && appData) {
      setApplications(appData);
    }
    setLoading(false);
  };

  const handleDragStart = (e, appId) => {
    e.dataTransfer.setData('appId', appId);
  };

  const handleDrop = async (e, newStatus) => {
    e.preventDefault();
    const appId = e.dataTransfer.getData('appId');
    if (!appId) return;

    // Optimistic update
    setApplications(apps => apps.map(app => app.id === appId ? { ...app, status: newStatus } : app));

    // Persist
    await supabase.from('job_applications').update({ status: newStatus }).eq('id', appId);
  };

  const generateSmartLink = (candidateId) => {
    // Generate a link for the manager to review
    const url = `${window.location.origin}/review-candidato/${candidateId}?job=${jobId}`;
    navigator.clipboard.writeText(url);
    alert('Link de avaliação copiado para a área de transferência!');
  };

  if (loading) return <div style={{ padding: '4rem', textAlign: 'center' }}>Carregando ATS...</div>;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'var(--color-bg)', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <header style={{ padding: '1rem 2rem', background: 'var(--color-surface)', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ margin: '0 0 0.2rem', fontSize: '1.25rem' }}>ATS: {job?.job_profiles?.title}</h2>
          <p style={{ margin: 0, color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>Arraste os candidatos entre as colunas para atualizar o status.</p>
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)' }}><X size={24} /></button>
      </header>

      {/* Kanban Board */}
      <div style={{ flex: 1, padding: '1.5rem 2rem', overflowX: 'auto', display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
        {STAGES.map(stage => {
          const stageApps = applications.filter(app => app.status === stage);
          return (
            <div 
              key={stage}
              onDragOver={e => e.preventDefault()}
              onDrop={e => handleDrop(e, stage)}
              style={{ minWidth: '280px', width: '280px', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '8px', display: 'flex', flexDirection: 'column', maxHeight: '100%' }}
            >
              <div style={{ padding: '1rem', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600 }}>{stage}</h3>
                <span style={{ background: 'var(--color-bg)', padding: '0.2rem 0.6rem', borderRadius: '999px', fontSize: '0.75rem', fontWeight: 700 }}>{stageApps.length}</span>
              </div>
              
              <div style={{ padding: '0.75rem', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '0.75rem', minHeight: '150px' }}>
                {stageApps.map(app => (
                  <div 
                    key={app.id}
                    draggable
                    onDragStart={e => handleDragStart(e, app.id)}
                    style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: '6px', padding: '1rem', cursor: 'grab', boxShadow: 'var(--shadow-sm)' }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                      <h4 style={{ margin: 0, fontSize: '1rem' }}>{app.candidates?.full_name}</h4>
                      {/* Match Score */}
                      {app.match_score > 0 && (
                        <span style={{ background: app.match_score > 70 ? '#dcfce7' : '#fef9c3', color: app.match_score > 70 ? '#166534' : '#854d0e', fontSize: '0.7rem', padding: '0.2rem 0.4rem', borderRadius: '4px', fontWeight: 700 }}>
                          {app.match_score}% Match
                        </span>
                      )}
                    </div>
                    <p style={{ margin: '0 0 0.5rem', fontSize: '0.8rem', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                      <Briefcase size={12} /> {app.candidates?.city}/{app.candidates?.state}
                    </p>
                    
                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
                      <button className="btn-outline" style={{ flex: 1, padding: '0.3rem', fontSize: '0.75rem' }}>Ver Perfil</button>
                      {stage === 'Entrevista Gestor' && (
                        <button className="btn-primary" onClick={() => generateSmartLink(app.candidates.id)} title="Copiar link para o Gestor" style={{ padding: '0.3rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <ExternalLink size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ATSBoard;
