import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { X, Tag, Plus, Trash2 } from 'lucide-react';

const EmployeeProfileModal = ({ employee, onClose }) => {
  const [activeTab, setActiveTab] = useState('dados');
  const [benefits, setBenefits] = useState([]);
  const [newBenefit, setNewBenefit] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (employee && activeTab === 'beneficios') {
      fetchBenefits();
    }
  }, [employee, activeTab]);

  const fetchBenefits = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('employee_benefits')
      .select('*')
      .eq('employee_id', employee.id)
      .eq('active', true)
      .order('benefit_name');
    if (data) setBenefits(data);
    setLoading(false);
  };

  const handleAddBenefit = async (e) => {
    e.preventDefault();
    if (!newBenefit.trim()) return;
    
    const { data, error } = await supabase
      .from('employee_benefits')
      .insert([{ employee_id: employee.id, benefit_name: newBenefit.trim() }])
      .select();
      
    if (!error && data) {
      setBenefits([...benefits, data[0]]);
      setNewBenefit('');
    } else {
      alert('Erro ao adicionar benefício: ' + error?.message);
    }
  };

  const handleRemoveBenefit = async (id) => {
    if (!window.confirm('Remover este benefício?')) return;
    
    const { error } = await supabase
      .from('employee_benefits')
      .delete()
      .eq('id', id);
      
    if (!error) {
      setBenefits(benefits.filter(b => b.id !== id));
    }
  };

  const formatDate = (d) => {
    if (!d) return '—';
    const p = d.split('-');
    return `${p[2]}/${p[1]}/${p[0]}`;
  };

  if (!employee) return null;

  const tabs = [
    { id: 'dados', label: 'Dados Cadastrais' },
    { id: 'beneficios', label: 'Benefícios' },
    { id: 'ferias', label: 'Férias' },
    { id: 'exames', label: 'Exames (ASO)' },
    { id: 'epis', label: 'EPIs' }
  ];

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1100, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="fade-in" style={{ background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', width: '90%', maxWidth: '700px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-xl)', overflow: 'hidden' }}>
        
        {/* Header */}
        <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', background: 'var(--color-bg)' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.5rem', color: 'var(--color-text)' }}>{employee.name}</h2>
            <p style={{ margin: '0.2rem 0 0', color: 'var(--color-text-muted)' }}>{employee.role || 'Sem cargo'} · {employee.departments?.name || 'Sem setor'} · {employee.unit || 'Sem unidade'}</p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)' }}><X size={24} /></button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '1rem', padding: '0 1.5rem', borderBottom: '1px solid var(--color-border)', background: 'var(--color-bg)', overflowX: 'auto' }}>
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              style={{
                padding: '1rem 0.5rem', border: 'none', background: 'none', cursor: 'pointer', whiteSpace: 'nowrap',
                fontWeight: activeTab === t.id ? 600 : 400,
                color: activeTab === t.id ? 'var(--color-primary)' : 'var(--color-text-muted)',
                borderBottom: activeTab === t.id ? '2px solid var(--color-primary)' : '2px solid transparent',
                marginBottom: '-1px'
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{ padding: '1.5rem', overflowY: 'auto', flex: 1, background: 'var(--color-surface)' }}>
          
          {activeTab === 'dados' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1.5rem' }}>
              <div><strong style={{ display: 'block', fontSize: '0.8rem', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>CPF</strong> {employee.cpf || '—'}</div>
              <div><strong style={{ display: 'block', fontSize: '0.8rem', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>RG</strong> {employee.rg || '—'}</div>
              <div><strong style={{ display: 'block', fontSize: '0.8rem', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>CTPS / Série</strong> {employee.ctps ? `${employee.ctps} / ${employee.ctps_serie || '-'}` : '—'}</div>
              <div><strong style={{ display: 'block', fontSize: '0.8rem', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>PIS</strong> {employee.pis || '—'}</div>
              <div><strong style={{ display: 'block', fontSize: '0.8rem', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Nascimento</strong> {employee.birthday ? employee.birthday.split('-').reverse().join('/') : '—'}</div>
              <div><strong style={{ display: 'block', fontSize: '0.8rem', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Estado Civil</strong> {employee.marital_status || '—'}</div>
              <div><strong style={{ display: 'block', fontSize: '0.8rem', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Gênero</strong> {employee.gender || '—'}</div>
              <div><strong style={{ display: 'block', fontSize: '0.8rem', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Telefone</strong> {employee.phone || '—'}</div>
              <div><strong style={{ display: 'block', fontSize: '0.8rem', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Data Admissão</strong> {formatDate(employee.admission_date)}</div>
              <div><strong style={{ display: 'block', fontSize: '0.8rem', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Centro de Custo</strong> {employee.cost_center || '—'}</div>
              <div><strong style={{ display: 'block', fontSize: '0.8rem', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>CBO</strong> {employee.cbo || '—'}</div>
              <div><strong style={{ display: 'block', fontSize: '0.8rem', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Camisa</strong> {employee.shirt_size || '—'}</div>
            </div>
          )}

          {activeTab === 'beneficios' && (
            <div>
              <p style={{ margin: '0 0 1.5rem', color: 'var(--color-text-muted)' }}>Adicione tags de benefícios (Ex: Vale Transporte, Plano de Saúde Unimed, Gympass) para visualizar rapidamente o que este colaborador possui ativo.</p>
              
              <form onSubmit={handleAddBenefit} style={{ display: 'flex', gap: '0.5rem', marginBottom: '2rem' }}>
                <input 
                  type="text" 
                  value={newBenefit} 
                  onChange={e => setNewBenefit(e.target.value)} 
                  placeholder="Nome do benefício..." 
                  style={{ flex: 1, padding: '0.6rem 1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-text)' }}
                />
                <button type="submit" className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.6rem 1rem' }}>
                  <Plus size={16} /> Adicionar
                </button>
              </form>

              {loading ? <p>Carregando benefícios...</p> : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
                  {benefits.length === 0 ? <p style={{ color: 'var(--color-text-muted)' }}>Nenhum benefício ativo cadastrado.</p> : null}
                  {benefits.map(b => (
                    <div key={b.id} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: 'rgba(34,197,94,0.1)', color: '#16a34a', border: '1px solid rgba(34,197,94,0.3)', padding: '0.4rem 0.8rem', borderRadius: '999px', fontSize: '0.9rem', fontWeight: 500 }}>
                      <Tag size={14} />
                      {b.benefit_name}
                      <button onClick={() => handleRemoveBenefit(b.id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center', marginLeft: '0.2rem', padding: '0.1rem' }}>
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Placeholders for future implementations */}
          {activeTab === 'ferias' && (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-text-muted)' }}>
              <p>Módulo de Gestão de Férias em desenvolvimento.</p>
            </div>
          )}
          {activeTab === 'exames' && (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-text-muted)' }}>
              <p>Último ASO registrado no cadastro: <strong>{formatDate(employee.aso_date)}</strong></p>
              <p>Módulo completo de Exames Ocupacionais em desenvolvimento.</p>
            </div>
          )}
          {activeTab === 'epis' && (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-text-muted)' }}>
              <p>Módulo de Controle de EPIs em desenvolvimento.</p>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default EmployeeProfileModal;
