import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../supabaseClient';
import { X, Save, AlertCircle } from 'lucide-react';

const VagaFormModal = ({ onClose, onSuccess }) => {
  const [profiles, setProfiles] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const [form, setForm] = useState({
    profile_id: '',
    department_id: '',
    cost_center: '',
    contract_type: 'CLT',
    justification: 'Aumento de Quadro',
    target_date: '',
    observations: ''
  });

  useEffect(() => {
    fetchOptions();
  }, []);

  const fetchOptions = async () => {
    setLoading(true);
    const [profRes, deptRes] = await Promise.all([
      supabase.from('job_profiles').select('id, profile_code, title').order('title'),
      supabase.from('departments').select('id, name').order('name')
    ]);
    if (profRes.data) setProfiles(profRes.data);
    if (deptRes.data) setDepartments(deptRes.data);
    setLoading(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSaving(true);
    
    const { data, error: insertError } = await supabase
      .from('job_openings')
      .insert([form]);
      
    setSaving(false);

    if (insertError) {
      setError(insertError.message);
    } else {
      onSuccess();
    }
  };

  const inputStyle = { width: '100%', padding: '0.6rem 0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-text)', boxSizing: 'border-box', fontSize: '0.9rem' };
  const labelStyle = { display: 'block', marginBottom: '0.3rem', fontWeight: 600, fontSize: '0.8rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' };

  return createPortal(
    <div 
      style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={onClose}
    >
      <div 
        className="fade-in" 
        onClick={e => e.stopPropagation()}
        style={{ background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', padding: '2rem', maxWidth: '600px', width: '90%', border: '1px solid var(--color-border)', maxHeight: '90vh', overflowY: 'auto' }}
      >
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h3 style={{ margin: 0, fontSize: '1.25rem', color: 'var(--color-text)' }}>Solicitar Nova Vaga</h3>
          <button onClick={onClose} type="button" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)' }}>
            <X size={20} />
          </button>
        </div>

        {error && (
          <div style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', padding: '1rem', borderRadius: '8px', marginBottom: '1.5rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <AlertCircle size={18} />
            <span style={{ fontSize: '0.9rem' }}>{error}</span>
          </div>
        )}

        {loading ? (
          <p className="text-muted">Carregando formulário...</p>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={labelStyle}>Cargo (Perfil de Competência) *</label>
                <select 
                  required
                  value={form.profile_id} 
                  onChange={e => setForm({...form, profile_id: e.target.value})} 
                  style={inputStyle}>
                  <option value="">Selecione um cargo/perfil...</option>
                  {profiles.map(p => (
                    <option key={p.id} value={p.id}>{p.title} (PC: {p.profile_code})</option>
                  ))}
                </select>
                <small style={{ color: 'var(--color-text-muted)', fontSize: '0.75rem', marginTop: '0.2rem', display: 'block' }}>Os requisitos e competências serão puxados automaticamente pelo sistema.</small>
              </div>

              <div>
                <label style={labelStyle}>Departamento *</label>
                <select 
                  required
                  value={form.department_id} 
                  onChange={e => setForm({...form, department_id: e.target.value})} 
                  style={inputStyle}>
                  <option value="">Selecione...</option>
                  {departments.map(d => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={labelStyle}>Tipo de Contrato *</label>
                <select 
                  required
                  value={form.contract_type} 
                  onChange={e => setForm({...form, contract_type: e.target.value})} 
                  style={inputStyle}>
                  <option value="CLT">CLT</option>
                  <option value="Estágio">Estágio</option>
                  <option value="PJ">PJ</option>
                  <option value="Jovem Aprendiz">Jovem Aprendiz</option>
                  <option value="Temporário">Temporário</option>
                  <option value="Terceirizado">Terceirizado</option>
                </select>
              </div>

              <div>
                <label style={labelStyle}>Justificativa *</label>
                <select 
                  required
                  value={form.justification} 
                  onChange={e => setForm({...form, justification: e.target.value})} 
                  style={inputStyle}>
                  <option value="Aumento de Quadro">Aumento de Quadro</option>
                  <option value="Substituição">Substituição</option>
                  <option value="Novo Projeto/Obra">Novo Projeto/Obra</option>
                  <option value="Outro">Outro</option>
                </select>
              </div>

              <div>
                <label style={labelStyle}>Data Prevista para Fechamento *</label>
                <input 
                  type="date" 
                  required
                  value={form.target_date} 
                  onChange={e => setForm({...form, target_date: e.target.value})} 
                  style={inputStyle} 
                />
              </div>

              <div style={{ gridColumn: '1 / -1' }}>
                <label style={labelStyle}>Centro de Custo</label>
                <input 
                  type="text" 
                  placeholder="Opcional"
                  value={form.cost_center} 
                  onChange={e => setForm({...form, cost_center: e.target.value})} 
                  style={inputStyle} 
                />
              </div>

              <div style={{ gridColumn: '1 / -1' }}>
                <label style={labelStyle}>Observações / Instruções Adicionais</label>
                <textarea 
                  rows="3"
                  placeholder="Especifique detalhes da vaga, salário proposto, formato de trabalho, etc."
                  value={form.observations} 
                  onChange={e => setForm({...form, observations: e.target.value})} 
                  style={{ ...inputStyle, resize: 'vertical' }} 
                />
              </div>

            </div>

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
              <button type="button" onClick={onClose} style={{ padding: '0.6rem 1.25rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', background: 'none', cursor: 'pointer', color: 'var(--color-text)', fontWeight: 600 }}>
                Cancelar
              </button>
              <button type="submit" disabled={saving} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 1.5rem', borderRadius: 'var(--radius-md)', border: 'none', background: 'var(--color-primary)', color: '#fff', fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}>
                <Save size={16} />
                {saving ? 'Enviando...' : 'Enviar Solicitação'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>,
    document.body
  );
};

export default VagaFormModal;
