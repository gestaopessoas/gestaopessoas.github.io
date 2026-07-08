import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../supabaseClient';
import { X, Tag, Plus, Trash2 } from 'lucide-react';

const BENEFITS_OPTIONS = [
  { group: 'Alimentação', items: [
    'Vale Refeição - Nível I (R$ 254)',
    'Vale Refeição - Nível II (R$ 381)',
    'Vale Refeição - Nível III (R$ 508)',
    'Vale Refeição - Nível IV (R$ 635)',
    'Vale Refeição - Nível V (R$ 762)',
    'Vale Refeição - Nível VI (R$ 889)',
    'Vale Refeição - Nível VII (R$ 1.016)',
    'Vale Refeição - Nível VIII (R$ 1.143)',
    'Vale Refeição - Nível IX (R$ 1.270)',
    'Vale Refeição - Nível X (R$ 1.397)',
    'Alimentação na empresa',
    'Cesta Básica',
  ]},
  { group: 'Transporte', items: ['Vale Transporte'] },
  { group: 'Saúde', items: [
    'Convênio da Sulclínica',
    'Odontoprev',
    'Convênio Clínica de Saúde Mental',
    'Seguro de Vida',
  ]},
  { group: 'Outros', items: [
    'Convênio com Farmácia',
    'Convênio com Instituição de Ensino Superior',
  ]},
];

const EmployeeProfileModal = ({ employee, onClose }) => {
  const [activeTab, setActiveTab] = useState('dados');

  // Benefícios — apenas em memória, não salvo no banco
  const [benefits, setBenefits] = useState([]);
  const [newBenefit, setNewBenefit] = useState('');

  // Férias
  const [vacations, setVacations] = useState([]);
  const [newVacation, setNewVacation] = useState({ start_date: '', end_date: '', notes: '' });

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (employee && activeTab === 'ferias') {
      fetchVacations();
    }
  }, [employee, activeTab]);

  const fetchVacations = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('vacations')
      .select('*')
      .eq('employee_id', employee.id)
      .order('start_date', { ascending: false });
    if (data) setVacations(data);
    setLoading(false);
  };

  // Benefícios — apenas local, sem banco de dados
  const handleAddBenefit = (e) => {
    e.preventDefault();
    if (!newBenefit.trim()) return;
    if (benefits.includes(newBenefit.trim())) {
      alert('Este benefício já foi adicionado.');
      return;
    }
    setBenefits(prev => [...prev, newBenefit.trim()]);
    setNewBenefit('');
  };

  const handleRemoveBenefit = (name) => {
    setBenefits(prev => prev.filter(b => b !== name));
  };

  const handleAddVacation = async (e) => {
    e.preventDefault();
    if (!newVacation.start_date || !newVacation.end_date) return;
    
    const { data, error } = await supabase
      .from('vacations')
      .insert([{ 
        employee_id: employee.id, 
        start_date: newVacation.start_date, 
        end_date: newVacation.end_date, 
        notes: newVacation.notes 
      }])
      .select();
      
    if (!error && data) {
      setVacations([data[0], ...vacations]);
      setNewVacation({ start_date: '', end_date: '', notes: '' });
    } else {
      alert('Erro ao agendar férias: ' + error?.message);
    }
  };

  const handleRemoveVacation = async (id) => {
    if (!window.confirm('Excluir este registro de férias?')) return;
    const { error } = await supabase.from('vacations').delete().eq('id', id);
    if (!error) {
      setVacations(vacations.filter(v => v.id !== id));
    }
  };

  const formatDate = (d) => {
    if (!d || typeof d !== 'string') return '—';
    const p = d.split('-');
    if (p.length !== 3) return d;
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

  return createPortal(
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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
              <div><strong style={{ display: 'block', fontSize: '0.8rem', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Nascimento</strong> {employee.birthday && typeof employee.birthday === 'string' && employee.birthday.includes('-') ? employee.birthday.split('-').reverse().join('/') : employee.birthday || '—'}</div>
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
              <p style={{ margin: '0 0 0.5rem', color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>
                ℹ️ Os benefícios aqui são apenas para consulta rápida durante a sessão — não são salvos no banco de dados.
              </p>

              <form onSubmit={handleAddBenefit} style={{ display: 'flex', gap: '0.5rem', marginBottom: '2rem' }}>
                <select
                  value={newBenefit}
                  onChange={e => setNewBenefit(e.target.value)}
                  style={{ flex: 1, padding: '0.6rem 1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-text)' }}
                  required
                >
                  <option value="">Selecione um benefício...</option>
                  {BENEFITS_OPTIONS.map(({ group, items }) => (
                    <optgroup key={group} label={group}>
                      {items.map(item => (
                        <option key={item} value={item}>{item}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
                <button type="submit" className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.6rem 1rem' }}>
                  <Plus size={16} /> Adicionar
                </button>
              </form>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
                {benefits.length === 0
                  ? <p style={{ color: 'var(--color-text-muted)' }}>Nenhum benefício adicionado nesta sessão.</p>
                  : benefits.map(b => (
                    <div key={b} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: 'rgba(34,197,94,0.1)', color: '#16a34a', border: '1px solid rgba(34,197,94,0.3)', padding: '0.4rem 0.8rem', borderRadius: '999px', fontSize: '0.9rem', fontWeight: 500 }}>
                      <Tag size={14} />
                      {b}
                      <button onClick={() => handleRemoveBenefit(b)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center', marginLeft: '0.2rem', padding: '0.1rem' }}>
                        <X size={14} />
                      </button>
                    </div>
                  ))
                }
              </div>
            </div>
          )}

          {/* Férias */}
          {activeTab === 'ferias' && (
            <div>
              <p style={{ margin: '0 0 1.5rem', color: 'var(--color-text-muted)' }}>Histórico e agendamento de férias do colaborador.</p>
              
              <form onSubmit={handleAddVacation} style={{ display: 'flex', gap: '0.5rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: '130px' }}>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--color-text-muted)', marginBottom: '0.3rem' }}>Início</label>
                  <input type="date" required value={newVacation.start_date} onChange={e => setNewVacation({...newVacation, start_date: e.target.value})} style={{ width: '100%', padding: '0.6rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-text)' }} />
                </div>
                <div style={{ flex: 1, minWidth: '130px' }}>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--color-text-muted)', marginBottom: '0.3rem' }}>Fim</label>
                  <input type="date" required value={newVacation.end_date} onChange={e => setNewVacation({...newVacation, end_date: e.target.value})} style={{ width: '100%', padding: '0.6rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-text)' }} />
                </div>
                <div style={{ flex: 2, minWidth: '200px' }}>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--color-text-muted)', marginBottom: '0.3rem' }}>Observação (Opcional)</label>
                  <input type="text" placeholder="Ex: Férias proporcionais..." value={newVacation.notes} onChange={e => setNewVacation({...newVacation, notes: e.target.value})} style={{ width: '100%', padding: '0.6rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-text)' }} />
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                  <button type="submit" className="btn-primary" style={{ padding: '0.6rem 1rem', display: 'flex', alignItems: 'center', gap: '0.4rem', height: '42px' }}>
                    <Plus size={16} /> Agendar
                  </button>
                </div>
              </form>

              {loading ? <p>Carregando férias...</p> : (
                <div style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
                    <thead style={{ background: 'var(--color-bg)' }}>
                      <tr style={{ color: 'var(--color-text-muted)', textTransform: 'uppercase', fontSize: '0.75rem' }}>
                        <th style={{ padding: '1rem' }}>Período</th>
                        <th style={{ padding: '1rem' }}>Status</th>
                        <th style={{ padding: '1rem' }}>Notas</th>
                        <th style={{ padding: '1rem', textAlign: 'right' }}>Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {vacations.length === 0 && (
                        <tr><td colSpan="4" style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>Nenhum registro de férias.</td></tr>
                      )}
                      {vacations.map(v => (
                        <tr key={v.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                          <td style={{ padding: '1rem', fontWeight: 600 }}>{formatDate(v.start_date)} até {formatDate(v.end_date)}</td>
                          <td style={{ padding: '1rem' }}>
                            <span style={{ padding: '0.2rem 0.6rem', borderRadius: '999px', fontSize: '0.8rem', fontWeight: 600, background: v.status === 'Concluída' ? 'rgba(34,197,94,0.1)' : 'rgba(245,158,11,0.1)', color: v.status === 'Concluída' ? '#16a34a' : '#f59e0b' }}>
                              {v.status}
                            </span>
                          </td>
                          <td style={{ padding: '1rem', color: 'var(--color-text-muted)' }}>{v.notes || '—'}</td>
                          <td style={{ padding: '1rem', textAlign: 'right' }}>
                            <button onClick={() => handleRemoveVacation(v.id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '0.2rem' }}>
                              <Trash2 size={16} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
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
    </div>,
    document.body
  );
};

export default EmployeeProfileModal;
