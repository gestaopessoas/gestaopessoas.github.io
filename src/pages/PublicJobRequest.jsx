import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CheckCircle2, MessageCircle, Send, Sparkles } from 'lucide-react';
import { supabase } from '../supabaseClient';

const BEHAVIORAL_TAGS = [
  'Lideranca', 'Comunicacao clara', 'Organizacao', 'Disciplina', 'Proatividade',
  'Mao na massa', 'Analitico', 'Atencao a detalhes', 'Senso de urgencia',
  'Resiliencia', 'Trabalho sob pressao', 'Autonomia', 'Colaborativo',
  'Negociacao', 'Empatia', 'Foco em resultado', 'Aprendizado rapido',
  'Postura profissional', 'Planejamento', 'Resolucao de problemas',
  'Agilidade', 'Controle emocional', 'Flexibilidade', 'Tomada de decisao'
];

const SEARCH_TAGS = [
  'Experiencia comprovada', 'Disponibilidade imediata', 'Estabilidade',
  'Potencial de crescimento', 'Perfil junior', 'Perfil pleno', 'Perfil senior',
  'Atendimento ao cliente', 'Rotina administrativa', 'Obra/campo',
  'Operacional', 'Tecnico especializado', 'Gestao de equipe',
  'CNH obrigatoria', 'Conhecimento em Excel', 'Conhecimento em sistema',
  'Boa escrita', 'Boa comunicacao verbal', 'Pontualidade', 'Comprometimento',
  'Aprende processo rapido', 'Conhece normas de seguranca', 'Experiencia no segmento',
  'Disponibilidade para horas extras', 'Mora proximo', 'Baixa rotatividade',
  'Alta produtividade', 'Relacionamento interpessoal', 'Perfil comercial',
  'Perfil financeiro', 'Perfil construcao civil', 'Perfil manutencao'
];

const initialForm = {
  requester_name: '',
  requester_area: '',
  requester_phone: '',
  profile_id: '',
  department_id: '',
  position_title: '',
  unit: '',
  quantity: 1,
  contract_type: 'CLT',
  reason: 'Substituicao',
  urgency: 'Media',
  target_date: '',
  salary_min: '',
  salary_max: '',
  salary_notes: '',
  work_schedule: '',
  behavioral_tags: [],
  search_tags: [],
  required_requirements: '',
  desired_requirements: '',
  manager_expectations: '',
  notes: ''
};

const PublicJobRequest = () => {
  const [searchParams] = useSearchParams();
  const [profiles, setProfiles] = useState([]);
  const [departments, setDepartments] = useState([]);
  
  // Smart Link Support: Initialize form with query params
  const [form, setForm] = useState({
    ...initialForm,
    requester_name: searchParams.get('nome') || initialForm.requester_name,
    requester_area: searchParams.get('area') || initialForm.requester_area,
    department_id: searchParams.get('dept') || initialForm.department_id,
    profile_id: searchParams.get('perfil') || initialForm.profile_id,
  });
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  useEffect(() => {
    fetchOptions();
  }, []);

  const selectedProfile = useMemo(
    () => profiles.find(profile => profile.id === form.profile_id),
    [profiles, form.profile_id]
  );

  const whatsappLink = useMemo(() => {
    const digits = form.requester_phone.replace(/\D/g, '');
    if (!digits) return '';
    const phone = digits.startsWith('55') ? digits : `55${digits}`;
    return `https://wa.me/${phone}`;
  }, [form.requester_phone]);

  const fetchOptions = async () => {
    setLoading(true);
    const { data, error: optionsError } = await supabase.rpc('get_public_job_form_options');
    if (optionsError) {
      setError('Nao foi possivel carregar cargos e setores. Avise o RH.');
    } else {
      setProfiles(data?.profiles || []);
      setDepartments(data?.departments || []);
    }
    setLoading(false);
  };

  const set = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  const toggleTag = (field, tag) => {
    setForm(prev => {
      const exists = prev[field].includes(tag);
      return { ...prev, [field]: exists ? prev[field].filter(item => item !== tag) : [...prev[field], tag] };
    });
  };

  const handleProfileChange = (profileId) => {
    const profile = profiles.find(item => item.id === profileId);
    setForm(prev => ({
      ...prev,
      profile_id: profileId,
      position_title: profile?.title || prev.position_title,
      required_requirements: [
        profile?.min_education && `Escolaridade minima: ${profile.min_education}`,
        profile?.min_experience && `Experiencia minima: ${profile.min_experience}`,
        profile?.cnh && `CNH: ${profile.cnh}`
      ].filter(Boolean).join('\n'),
      desired_requirements: [
        profile?.desired_education && `Escolaridade desejavel: ${profile.desired_education}`,
        profile?.desired_experience && `Experiencia desejavel: ${profile.desired_experience}`,
        profile?.knowledge && `Conhecimentos: ${profile.knowledge}`,
        profile?.competencies && `Competencias: ${profile.competencies}`
      ].filter(Boolean).join('\n')
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setSaving(true);

    const payload = {
      ...form,
      requester_whatsapp: whatsappLink,
      department_id: form.department_id || null,
      profile_id: form.profile_id || null,
      quantity: Number(form.quantity) || 1,
      salary_min: form.salary_min ? Number(form.salary_min) : null,
      salary_max: form.salary_max ? Number(form.salary_max) : null,
      target_date: form.target_date || null
    };

    const { error: insertError } = await supabase.from('job_requests').insert([payload]);
    setSaving(false);

    if (insertError) {
      setError('Nao foi possivel enviar agora. Confira os campos e tente novamente.');
      return;
    }

    setSent(true);
    setForm(initialForm);
  };

  const inputStyle = {
    width: '100%',
    minHeight: '44px',
    padding: '0.7rem 0.85rem',
    borderRadius: '8px',
    border: '1px solid var(--color-border)',
    background: 'var(--color-surface)',
    color: 'var(--color-text)',
    boxSizing: 'border-box',
    fontSize: '0.95rem'
  };

  const labelStyle = { display: 'block', marginBottom: '0.35rem', fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-text-muted)' };

  const renderTags = (field, tags) => (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
      {tags.map(tag => {
        const selected = form[field].includes(tag);
        return (
          <button
            key={tag}
            type="button"
            onClick={() => toggleTag(field, tag)}
            style={{
              minHeight: '36px',
              padding: '0.45rem 0.75rem',
              borderRadius: '999px',
              border: `1px solid ${selected ? 'var(--color-primary)' : 'var(--color-border)'}`,
              background: selected ? 'rgba(245,174,56,0.14)' : 'var(--color-surface)',
              color: selected ? 'var(--color-primary)' : 'var(--color-text)',
              cursor: 'pointer',
              fontWeight: selected ? 700 : 500
            }}
          >
            {tag}
          </button>
        );
      })}
    </div>
  );

  if (sent) {
    return (
      <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: 'var(--color-bg)', padding: '2rem' }}>
        <section style={{ maxWidth: '520px', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '8px', padding: '2rem', textAlign: 'center', boxShadow: 'var(--shadow-lg)' }}>
          <CheckCircle2 size={42} color="#22c55e" />
          <h1 style={{ margin: '1rem 0 0.5rem' }}>Solicitacao enviada</h1>
          <p style={{ color: 'var(--color-text-muted)', lineHeight: 1.6 }}>RH recebeu sua solicitacao. Se precisar complementar, fale com o RH pelo canal interno.</p>
          <button className="btn-primary" onClick={() => setSent(false)} style={{ marginTop: '1rem' }}>Enviar outra vaga</button>
        </section>
      </main>
    );
  }

  return (
    <main style={{ minHeight: '100vh', background: 'var(--color-bg)', color: 'var(--color-text)', padding: '2rem 1rem' }}>
      <section style={{ maxWidth: '980px', margin: '0 auto' }}>
        <header style={{ marginBottom: '1.5rem' }}>
          <img src="/images/logo.png" alt="ACPO" style={{ height: '52px', marginBottom: '1.25rem' }} />
          <h1 style={{ margin: 0, fontSize: 'clamp(1.6rem, 3vw, 2.35rem)' }}>Solicitar nova vaga</h1>
          <p style={{ maxWidth: '680px', color: 'var(--color-text-muted)', lineHeight: 1.6, marginTop: '0.6rem' }}>
            Preencha o perfil desejado. Quanto mais tags e detalhes, melhor o RH consegue encontrar candidatos aderentes.
          </p>
        </header>

        <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '1rem' }}>
          {error && <div role="alert" style={{ padding: '1rem', borderRadius: '8px', background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.25)' }}>{error}</div>}

          <section style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '8px', padding: '1.25rem' }}>
            <h2 style={{ margin: '0 0 1rem', fontSize: '1.05rem' }}>Solicitante</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
              <div>
                <label style={labelStyle}>Nome *</label>
                <input required value={form.requester_name} onChange={e => set('requester_name', e.target.value)} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Area</label>
                <input value={form.requester_area} onChange={e => set('requester_area', e.target.value)} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>WhatsApp *</label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <input required type="tel" value={form.requester_phone} onChange={e => set('requester_phone', e.target.value)} placeholder="(47) 99999-9999" style={inputStyle} />
                  <a href={whatsappLink || undefined} target="_blank" rel="noreferrer" aria-label="Abrir WhatsApp do solicitante"
                    style={{ minWidth: '48px', display: 'grid', placeItems: 'center', borderRadius: '8px', border: '1px solid var(--color-border)', background: whatsappLink ? '#22c55e' : 'var(--color-border)', color: '#fff', pointerEvents: whatsappLink ? 'auto' : 'none' }}>
                    <MessageCircle size={20} />
                  </a>
                </div>
              </div>
            </div>
          </section>

          <section style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '8px', padding: '1.25rem' }}>
            <h2 style={{ margin: '0 0 1rem', fontSize: '1.05rem' }}>Vaga</h2>
            {loading ? <p className="text-muted">Carregando cargos...</p> : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={labelStyle}>Cargo do perfil de competencia *</label>
                  <select required value={form.profile_id} onChange={e => handleProfileChange(e.target.value)} style={inputStyle}>
                    <option value="">Selecione...</option>
                    {profiles.map(profile => <option key={profile.id} value={profile.id}>{profile.title} (PC: {profile.profile_code})</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Titulo da vaga *</label>
                  <input required value={form.position_title} onChange={e => set('position_title', e.target.value)} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Departamento</label>
                  <select value={form.department_id} onChange={e => set('department_id', e.target.value)} style={inputStyle}>
                    <option value="">Selecione...</option>
                    {departments.map(department => <option key={department.id} value={department.id}>{department.name}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Unidade</label>
                  <input value={form.unit} onChange={e => set('unit', e.target.value)} placeholder="Sede, Riviera..." style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Quantidade</label>
                  <input type="number" min="1" value={form.quantity} onChange={e => set('quantity', e.target.value)} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Contrato *</label>
                  <select required value={form.contract_type} onChange={e => set('contract_type', e.target.value)} style={inputStyle}>
                    {['CLT', 'Estagio', 'Jovem Aprendiz', 'Temporario', 'Terceirizado', 'PJ'].map(item => <option key={item}>{item}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Motivo *</label>
                  <select required value={form.reason} onChange={e => set('reason', e.target.value)} style={inputStyle}>
                    {['Substituicao', 'Aumento de quadro', 'Novo projeto/obra', 'Temporario', 'Banco de talentos', 'Outro'].map(item => <option key={item}>{item}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Urgencia *</label>
                  <select required value={form.urgency} onChange={e => set('urgency', e.target.value)} style={inputStyle}>
                    {['Baixa', 'Media', 'Alta', 'Critica'].map(item => <option key={item}>{item}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Data limite</label>
                  <input type="date" value={form.target_date} onChange={e => set('target_date', e.target.value)} style={inputStyle} />
                </div>
              </div>
            )}
          </section>

          {selectedProfile && (
            <section style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '8px', padding: '1.25rem' }}>
              <h2 style={{ margin: '0 0 1rem', fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Sparkles size={18} /> Requisitos do perfil cadastrado</h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem' }}>
                <div>
                  <label style={labelStyle}>Minimo para a vaga</label>
                  <textarea rows="6" value={form.required_requirements} onChange={e => set('required_requirements', e.target.value)} style={{ ...inputStyle, resize: 'vertical' }} />
                </div>
                <div>
                  <label style={labelStyle}>Desejavel para a vaga</label>
                  <textarea rows="6" value={form.desired_requirements} onChange={e => set('desired_requirements', e.target.value)} style={{ ...inputStyle, resize: 'vertical' }} />
                </div>
              </div>
            </section>
          )}

          <section style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '8px', padding: '1.25rem' }}>
            <h2 style={{ margin: '0 0 1rem', fontSize: '1.05rem' }}>Salario e horario</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
              <div>
                <label style={labelStyle}>Salario minimo</label>
                <input type="number" min="0" step="0.01" value={form.salary_min} onChange={e => set('salary_min', e.target.value)} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Salario maximo</label>
                <input type="number" min="0" step="0.01" value={form.salary_max} onChange={e => set('salary_max', e.target.value)} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Horario / escala</label>
                <input value={form.work_schedule} onChange={e => set('work_schedule', e.target.value)} placeholder="Ex: Segunda a sexta, 08h as 18h" style={inputStyle} />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={labelStyle}>Observacao de salario</label>
                <input value={form.salary_notes} onChange={e => set('salary_notes', e.target.value)} placeholder="Ex: salario conforme experiencia" style={inputStyle} />
              </div>
            </div>
          </section>

          <section style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '8px', padding: '1.25rem' }}>
            <h2 style={{ margin: '0 0 0.4rem', fontSize: '1.05rem' }}>Tags comportamentais</h2>
            <p style={{ marginTop: 0, color: 'var(--color-text-muted)' }}>Marque tudo que combina com a pessoa ideal.</p>
            {renderTags('behavioral_tags', BEHAVIORAL_TAGS)}
          </section>

          <section style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '8px', padding: '1.25rem' }}>
            <h2 style={{ margin: '0 0 0.4rem', fontSize: '1.05rem' }}>Tags de busca</h2>
            <p style={{ marginTop: 0, color: 'var(--color-text-muted)' }}>Essas tags ajudam o RH a filtrar e comparar vagas parecidas.</p>
            {renderTags('search_tags', SEARCH_TAGS)}
          </section>

          <section style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '8px', padding: '1.25rem' }}>
            <h2 style={{ margin: '0 0 1rem', fontSize: '1.05rem' }}>Expectativa do gestor</h2>
            <div style={{ display: 'grid', gap: '1rem' }}>
              <div>
                <label style={labelStyle}>O que voce busca nesse colaborador?</label>
                <textarea rows="4" value={form.manager_expectations} onChange={e => set('manager_expectations', e.target.value)} style={{ ...inputStyle, resize: 'vertical' }} />
              </div>
              <div>
                <label style={labelStyle}>Observacoes finais</label>
                <textarea rows="3" value={form.notes} onChange={e => set('notes', e.target.value)} style={{ ...inputStyle, resize: 'vertical' }} />
              </div>
            </div>
          </section>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', paddingBottom: '2rem' }}>
            <button type="submit" disabled={saving} className="btn-primary" style={{ minHeight: '46px', display: 'inline-flex', alignItems: 'center', gap: '0.5rem', opacity: saving ? 0.7 : 1 }}>
              <Send size={17} /> {saving ? 'Enviando...' : 'Enviar solicitacao'}
            </button>
          </div>
        </form>
      </section>
    </main>
  );
};

export default PublicJobRequest;
