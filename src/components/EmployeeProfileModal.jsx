import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../supabaseClient';
import { X, Tag, Plus, Trash2, Edit3, Archive, Save } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const BENEFITS_OPTIONS = [
  { group: 'Alimentação', items: ['Vale Refeição - Nível I (R$ 254)', 'Vale Refeição - Nível II (R$ 381)', 'Vale Refeição - Nível III (R$ 508)', 'Vale Refeição - Nível IV (R$ 635)', 'Vale Refeição - Nível V (R$ 762)', 'Vale Refeição - Nível VI (R$ 889)', 'Vale Refeição - Nível VII (R$ 1.016)', 'Vale Refeição - Nível VIII (R$ 1.143)', 'Vale Refeição - Nível IX (R$ 1.270)', 'Vale Refeição - Nível X (R$ 1.397)', 'Alimentação na empresa', 'Cesta Básica'] },
  { group: 'Transporte', items: ['Vale Transporte'] },
  { group: 'Saúde', items: ['Convênio da Sulclínica', 'Odontoprev', 'Convênio Clínica de Saúde Mental', 'Seguro de Vida'] },
  { group: 'Outros', items: ['Convênio com Farmácia', 'Convênio com Instituição de Ensino Superior'] },
];

const EmployeeProfileModal = ({ employee, onClose, onUpdate }) => {
  const { can } = useAuth();
  const [activeTab, setActiveTab] = useState('dados');
  const [loading, setLoading] = useState(false);

  // Benefícios
  const [benefits, setBenefits] = useState([]);
  const [newBenefit, setNewBenefit] = useState('');

  // Férias
  const [vacations, setVacations] = useState([]);
  const [newVacation, setNewVacation] = useState({ start_date: '', end_date: '', notes: '' });

  // Exames
  const [exams, setExams] = useState([]);
  const [newExam, setNewExam] = useState({ exam_type: 'Admissional', exam_name: '', exam_date: '', status: 'Agendado', result: 'Pendente' });

  // Edição
  const [departments, setDepartments] = useState([]);
  const [editForm, setEditForm] = useState(null);
  const [savingEdit, setSavingEdit] = useState(false);

  // Arquivamento
  const [archiving, setArchiving] = useState(false);

  const canEdit = can('colaboradores', 'edit');

  useEffect(() => {
    if (employee) {
      if (activeTab === 'ferias') fetchVacations();
      else if (activeTab === 'beneficios') fetchBenefits();
      else if (activeTab === 'exames') fetchExams();
      else if (activeTab === 'editar') {
        if (departments.length === 0) fetchDepartments();
        initEditForm();
      }
    }
  }, [employee, activeTab]);

  const fetchDepartments = async () => {
    const { data } = await supabase.from('departments').select('*').order('name');
    if (data) setDepartments(data);
  };

  const initEditForm = () => {
    setEditForm({
      name: employee.name || '',
      department_id: employee.department_id || '',
      birthday: employee.birthday || '',
      unit: employee.unit || '',
      role: employee.role || '',
      shirt_size: employee.shirt_size || '',
      gender: employee.gender || '',
      phone: employee.phone || '',
      admission_date: employee.admission_date || '',
      cpf: employee.cpf || '',
      rg: employee.rg || '',
      ctps: employee.ctps || '',
      ctps_serie: employee.ctps_serie || '',
      pis: employee.pis || '',
      marital_status: employee.marital_status || '',
      cost_center: employee.cost_center || '',
      cbo: employee.cbo || '',
      aso_date: employee.aso_date || ''
    });
  };

  const fetchVacations = async () => {
    setLoading(true);
    const { data } = await supabase.from('vacations').select('*').eq('employee_id', employee.id).order('start_date', { ascending: false });
    if (data) setVacations(data);
    setLoading(false);
  };

  const fetchBenefits = async () => {
    setLoading(true);
    const { data } = await supabase.from('employee_benefits').select('*').eq('employee_id', employee.id);
    if (data) setBenefits(data);
    setLoading(false);
  };

  const fetchExams = async () => {
    setLoading(true);
    const { data } = await supabase.from('occupational_exams').select('*').eq('employee_id', employee.id).order('exam_date', { ascending: false });
    if (data) setExams(data);
    setLoading(false);
  };

  // --- Handlers para Salvar Edição e Arquivar ---
  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!canEdit) return;
    setSavingEdit(true);
    const payload = { ...editForm, department_id: editForm.department_id || null, birthday: editForm.birthday || null, admission_date: editForm.admission_date || null, aso_date: editForm.aso_date || null };
    const { error } = await supabase.from('employees').update(payload).eq('id', employee.id);
    setSavingEdit(false);
    if (error) alert('Erro ao salvar: ' + error.message);
    else {
      if (onUpdate) onUpdate();
      onClose(); // fecha o modal para forçar re-render com os novos dados
    }
  };

  const handleArchive = async () => {
    if (!canEdit) return;
    const boxNumber = prompt(`O colaborador(a) será movido(a) para o Arquivo Morto.\n\nInforme o número ou nome da caixa de arquivo físico (deixe em branco se não houver):`);
    if (boxNumber === null) return; // cancelou
    
    setArchiving(true);
    const { error } = await supabase.from('employees').update({ 
      status: 'Arquivo Morto', 
      archive_box: boxNumber.trim(),
      dismissed_at: employee.dismissed_at || new Date().toISOString().split('T')[0] // Garante data de demissão
    }).eq('id', employee.id);
    setArchiving(false);

    if (error) alert('Erro ao arquivar: ' + error.message);
    else {
      if (onUpdate) onUpdate();
      onClose();
    }
  };

  // --- Handlers de Listas (Benefícios, Férias, Exames) ---
  const handleAddBenefit = async (e) => {
    e.preventDefault();
    if (!newBenefit.trim()) return;
    const { data, error } = await supabase.from('employee_benefits').insert([{ employee_id: employee.id, benefit_name: newBenefit.trim(), active: true }]).select();
    if (!error && data) { setBenefits(prev => [...prev, data[0]]); setNewBenefit(''); }
  };
  const handleRemoveBenefit = async (id) => {
    const { error } = await supabase.from('employee_benefits').delete().eq('id', id);
    if (!error) setBenefits(prev => prev.filter(b => b.id !== id));
  };

  const handleAddExam = async (e) => {
    e.preventDefault();
    if (!newExam.exam_date || !newExam.exam_name || !newExam.exam_type) return;
    const { data, error } = await supabase.from('occupational_exams').insert([{ employee_id: employee.id, ...newExam }]).select();
    if (!error && data) { setExams([data[0], ...exams]); setNewExam({ exam_type: 'Admissional', exam_name: '', exam_date: '', status: 'Agendado', result: 'Pendente' }); }
  };
  const handleRemoveExam = async (id) => {
    if (!window.confirm('Excluir exame?')) return;
    const { error } = await supabase.from('occupational_exams').delete().eq('id', id);
    if (!error) setExams(exams.filter(e => e.id !== id));
  };

  const handleAddVacation = async (e) => {
    e.preventDefault();
    if (!newVacation.start_date || !newVacation.end_date) return;
    const { data, error } = await supabase.from('vacations').insert([{ employee_id: employee.id, ...newVacation }]).select();
    if (!error && data) { setVacations([data[0], ...vacations]); setNewVacation({ start_date: '', end_date: '', notes: '' }); }
  };
  const handleRemoveVacation = async (id) => {
    if (!window.confirm('Excluir férias?')) return;
    const { error } = await supabase.from('vacations').delete().eq('id', id);
    if (!error) setVacations(vacations.filter(v => v.id !== id));
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
  ];
  if (canEdit) tabs.push({ id: 'editar', label: 'Editar Perfil' });

  const inputStyle = { width: '100%', padding: '0.6rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-text)' };
  const labelStyle = { display: 'block', fontSize: '0.8rem', color: 'var(--color-text-muted)', marginBottom: '0.3rem', textTransform: 'uppercase', letterSpacing: '0.05em' };

  return createPortal(
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <div className="fade-in" style={{ background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', width: '100%', maxWidth: '900px', height: '85vh', display: 'flex', border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-xl)', overflow: 'hidden' }}>
        
        {/* Sidebar */}
        <div style={{ width: '250px', background: 'var(--color-bg)', borderRight: '1px solid var(--color-border)', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--color-border)' }}>
            <h2 style={{ margin: 0, fontSize: '1.2rem', color: 'var(--color-text)', lineHeight: 1.2 }}>{employee.name}</h2>
            <div style={{ marginTop: '0.5rem', display: 'inline-flex', padding: '0.2rem 0.6rem', borderRadius: '999px', fontSize: '0.75rem', fontWeight: 600, background: employee.status === 'Ativo' ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)', color: employee.status === 'Ativo' ? '#22c55e' : '#ef4444' }}>
              {employee.status}
            </div>
          </div>
          
          <div style={{ padding: '1rem 0', flex: 1, overflowY: 'auto' }}>
            {tabs.map(t => (
              <button key={t.id} onClick={() => setActiveTab(t.id)} style={{ width: '100%', textAlign: 'left', padding: '0.75rem 1.5rem', border: 'none', background: activeTab === t.id ? 'rgba(245,174,56,0.1)' : 'transparent', color: activeTab === t.id ? 'var(--color-primary)' : 'var(--color-text-muted)', cursor: 'pointer', fontWeight: activeTab === t.id ? 600 : 500, borderRight: activeTab === t.id ? '3px solid var(--color-primary)' : '3px solid transparent', display: 'flex', alignItems: 'center', gap: '0.5rem', transition: 'all 0.2s' }}>
                {t.id === 'editar' ? <Edit3 size={16} /> : null}
                {t.label}
              </button>
            ))}
          </div>

          <div style={{ padding: '1.5rem', borderTop: '1px solid var(--color-border)' }}>
            {canEdit && (
              <button onClick={handleArchive} disabled={archiving} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', padding: '0.6rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', background: 'transparent', color: 'var(--color-text)', cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem', transition: 'background 0.2s' }} className="hover-bg-transition">
                <Archive size={16} /> {archiving ? 'Aguarde...' : 'Arquivar'}
              </button>
            )}
          </div>
        </div>

        {/* Main Content Area */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0, color: 'var(--color-text)' }}>{tabs.find(t => t.id === activeTab)?.label}</h3>
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)' }}><X size={24} /></button>
          </div>

          <div style={{ padding: '1.5rem', overflowY: 'auto', flex: 1, background: 'var(--color-surface)' }}>
            
            {/* DADOS CADASTRAIS (Cards/Glassmorphism) */}
            {activeTab === 'dados' && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '1rem' }}>
                {[
                  ['CPF', employee.cpf], ['RG', employee.rg], ['PIS', employee.pis],
                  ['CTPS / Série', employee.ctps ? `${employee.ctps} / ${employee.ctps_serie || '-'}` : null],
                  ['Nascimento', employee.birthday && typeof employee.birthday === 'string' && employee.birthday.includes('-') ? employee.birthday.split('-').reverse().join('/') : employee.birthday],
                  ['Gênero', employee.gender], ['Estado Civil', employee.marital_status],
                  ['Telefone', employee.phone], ['Data Admissão', formatDate(employee.admission_date)],
                  ['Cargo', employee.role], ['Setor', employee.departments?.name], ['Unidade', employee.unit],
                  ['Centro de Custo', employee.cost_center], ['CBO', employee.cbo], ['Camisa', employee.shirt_size]
                ].map(([label, val]) => (
                  <div key={label} className="glass-card" style={{ padding: '1rem' }}>
                    <strong style={{ display: 'block', fontSize: '0.75rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: '0.3rem' }}>{label}</strong>
                    <span style={{ color: 'var(--color-text)', fontWeight: 500, fontSize: '0.95rem' }}>{val || '—'}</span>
                  </div>
                ))}
              </div>
            )}

            {/* EDITAR PERFIL */}
            {activeTab === 'editar' && editForm && (
              <form onSubmit={handleSaveEdit}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
                  {[['name', 'Nome *', 'text'], ['role', 'Cargo', 'text'], ['phone', 'Telefone', 'text'], ['admission_date', 'Data Admissão', 'date'], ['birthday', 'Nascimento', 'date'], ['cpf', 'CPF', 'text'], ['rg', 'RG', 'text'], ['pis', 'PIS', 'text'], ['ctps', 'CTPS', 'text'], ['ctps_serie', 'Série CTPS', 'text'], ['cbo', 'CBO', 'text'], ['cost_center', 'Centro Custo', 'text'], ['aso_date', 'Data ASO', 'date']].map(([field, lbl, type]) => (
                    <div key={field}>
                      <label style={labelStyle}>{lbl}</label>
                      <input type={type} value={editForm[field]} onChange={e => setEditForm(f => ({ ...f, [field]: e.target.value }))} required={field === 'name'} style={inputStyle} />
                    </div>
                  ))}
                  <div>
                    <label style={labelStyle}>Setor</label>
                    <select value={editForm.department_id} onChange={e => setEditForm(f => ({ ...f, department_id: e.target.value }))} style={inputStyle}>
                      <option value="">Nenhum</option>
                      {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>Unidade</label>
                    <input value={editForm.unit} onChange={e => setEditForm(f => ({ ...f, unit: e.target.value }))} placeholder="Ex: Sede, Obra..." style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>Gênero</label>
                    <select value={editForm.gender} onChange={e => setEditForm(f => ({ ...f, gender: e.target.value }))} style={inputStyle}>
                      <option value="">Selecionar</option><option value="Masculino">Masculino</option><option value="Feminino">Feminino</option><option value="Outro">Outro</option>
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>Estado Civil</label>
                    <select value={editForm.marital_status} onChange={e => setEditForm(f => ({ ...f, marital_status: e.target.value }))} style={inputStyle}>
                      <option value="">Selecionar</option><option value="Solteiro(a)">Solteiro(a)</option><option value="Casado(a)">Casado(a)</option><option value="Divorciado(a)">Divorciado(a)</option><option value="Viúvo(a)">Viúvo(a)</option><option value="Outro">Outro</option>
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>Camisa</label>
                    <input value={editForm.shirt_size} onChange={e => setEditForm(f => ({ ...f, shirt_size: e.target.value }))} placeholder="P, M, G..." style={inputStyle} />
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', padding: '1rem 0', borderTop: '1px solid var(--color-border)' }}>
                  <button type="submit" disabled={savingEdit} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1.5rem' }}>
                    <Save size={18} /> {savingEdit ? 'Salvando...' : 'Salvar Alterações'}
                  </button>
                </div>
              </form>
            )}

            {/* BENEFÍCIOS */}
            {activeTab === 'beneficios' && (
              <div>
                <form onSubmit={handleAddBenefit} style={{ display: 'flex', gap: '0.5rem', marginBottom: '2rem' }}>
                  <select value={newBenefit} onChange={e => setNewBenefit(e.target.value)} style={{ flex: 1, ...inputStyle }} required>
                    <option value="">Selecione um benefício...</option>
                    {BENEFITS_OPTIONS.map(({ group, items }) => (
                      <optgroup key={group} label={group}>{items.map(item => <option key={item} value={item}>{item}</option>)}</optgroup>
                    ))}
                  </select>
                  <button type="submit" className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0 1rem' }}><Plus size={16} /> Adicionar</button>
                </form>
                {loading ? <p className="text-muted">Carregando...</p> : (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
                    {benefits.length === 0 ? <p style={{ color: 'var(--color-text-muted)' }}>Nenhum benefício cadastrado.</p> : benefits.map(b => (
                      <div key={b.id} className="badge badge-active" style={{ fontSize: '0.9rem', padding: '0.4rem 0.8rem', gap: '0.5rem', textTransform: 'none' }}>
                        <Tag size={14} /> {b.benefit_name}
                        <button onClick={() => handleRemoveBenefit(b.id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: 0 }}><X size={14} /></button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* FÉRIAS */}
            {activeTab === 'ferias' && (
              <div>
                <form onSubmit={handleAddVacation} className="glass-card" style={{ padding: '1rem', display: 'flex', gap: '0.75rem', marginBottom: '2rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                  <div style={{ flex: 1, minWidth: '130px' }}><label style={labelStyle}>Início</label><input type="date" required value={newVacation.start_date} onChange={e => setNewVacation({...newVacation, start_date: e.target.value})} style={inputStyle} /></div>
                  <div style={{ flex: 1, minWidth: '130px' }}><label style={labelStyle}>Fim</label><input type="date" required value={newVacation.end_date} onChange={e => setNewVacation({...newVacation, end_date: e.target.value})} style={inputStyle} /></div>
                  <div style={{ flex: 2, minWidth: '200px' }}><label style={labelStyle}>Observação (Opcional)</label><input type="text" placeholder="Ex: Férias proporcionais..." value={newVacation.notes} onChange={e => setNewVacation({...newVacation, notes: e.target.value})} style={inputStyle} /></div>
                  <button type="submit" className="btn-primary" style={{ padding: '0.6rem 1rem', display: 'flex', alignItems: 'center', gap: '0.4rem', height: '42px' }}><Plus size={16} /> Agendar</button>
                </form>
                {loading ? <p className="text-muted">Carregando...</p> : (
                  <div style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
                      <thead style={{ background: 'var(--color-bg)' }}><tr style={{ color: 'var(--color-text-muted)', textTransform: 'uppercase', fontSize: '0.75rem' }}><th style={{ padding: '1rem' }}>Período</th><th style={{ padding: '1rem' }}>Status</th><th style={{ padding: '1rem' }}>Notas</th><th style={{ padding: '1rem', textAlign: 'right' }}>Ações</th></tr></thead>
                      <tbody>
                        {vacations.length === 0 && <tr><td colSpan="4" style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>Nenhum registro.</td></tr>}
                        {vacations.map(v => (
                          <tr key={v.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                            <td style={{ padding: '1rem', fontWeight: 600 }}>{formatDate(v.start_date)} até {formatDate(v.end_date)}</td>
                            <td style={{ padding: '1rem' }}><span className={`badge ${v.status === 'Concluída' ? 'badge-active' : ''}`} style={v.status !== 'Concluída' ? { background: 'rgba(245,158,11,0.1)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.3)'} : {}}>{v.status}</span></td>
                            <td style={{ padding: '1rem', color: 'var(--color-text-muted)' }}>{v.notes || '—'}</td>
                            <td style={{ padding: '1rem', textAlign: 'right' }}><button onClick={() => handleRemoveVacation(v.id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}><Trash2 size={16} /></button></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* EXAMES */}
            {activeTab === 'exames' && (
              <div>
                <form onSubmit={handleAddExam} className="glass-card" style={{ padding: '1rem', display: 'flex', gap: '0.75rem', marginBottom: '2rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                  <div style={{ flex: 1, minWidth: '130px' }}><label style={labelStyle}>Tipo</label><select required value={newExam.exam_type} onChange={e => setNewExam({...newExam, exam_type: e.target.value})} style={inputStyle}><option value="Admissional">Admissional</option><option value="Periódico">Periódico</option><option value="Demissional">Demissional</option><option value="Retorno ao Trabalho">Retorno ao Trabalho</option><option value="Mudança de Função">Mudança de Função</option></select></div>
                  <div style={{ flex: 2, minWidth: '200px' }}><label style={labelStyle}>Nome do Exame</label><input type="text" required placeholder="Ex: Clínico (ASO), Audiometria..." value={newExam.exam_name} onChange={e => setNewExam({...newExam, exam_name: e.target.value})} style={inputStyle} /></div>
                  <div style={{ flex: 1, minWidth: '130px' }}><label style={labelStyle}>Data</label><input type="date" required value={newExam.exam_date} onChange={e => setNewExam({...newExam, exam_date: e.target.value})} style={inputStyle} /></div>
                  <div style={{ flex: 1, minWidth: '130px' }}><label style={labelStyle}>Resultado</label><select required value={newExam.result} onChange={e => setNewExam({...newExam, result: e.target.value, status: e.target.value === 'Pendente' ? 'Agendado' : 'Realizado'})} style={inputStyle}><option value="Pendente">Pendente</option><option value="Apto">Apto</option><option value="Apto com Restrições">Apto com Restrições</option><option value="Inapto">Inapto</option></select></div>
                  <button type="submit" className="btn-primary" style={{ padding: '0.6rem 1rem', display: 'flex', alignItems: 'center', gap: '0.4rem', height: '42px' }}><Plus size={16} /> Adicionar</button>
                </form>
                {loading ? <p className="text-muted">Carregando...</p> : (
                  <div style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
                      <thead style={{ background: 'var(--color-bg)' }}><tr style={{ color: 'var(--color-text-muted)', textTransform: 'uppercase', fontSize: '0.75rem' }}><th style={{ padding: '1rem' }}>Data</th><th style={{ padding: '1rem' }}>Exame / Tipo</th><th style={{ padding: '1rem' }}>Resultado</th><th style={{ padding: '1rem', textAlign: 'right' }}>Ações</th></tr></thead>
                      <tbody>
                        {exams.length === 0 && <tr><td colSpan="4" style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>Nenhum exame.</td></tr>}
                        {exams.map(e => (
                          <tr key={e.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                            <td style={{ padding: '1rem', fontWeight: 600 }}>{formatDate(e.exam_date)}</td>
                            <td style={{ padding: '1rem' }}><div style={{ fontWeight: 500 }}>{e.exam_name}</div><div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>{e.exam_type}</div></td>
                            <td style={{ padding: '1rem' }}><span className={`badge ${e.result.includes('Apto') ? 'badge-active' : ''}`} style={!e.result.includes('Apto') ? { background: e.result === 'Inapto' ? 'rgba(239,68,68,0.1)' : 'rgba(245,158,11,0.1)', color: e.result === 'Inapto' ? '#ef4444' : '#f59e0b', border: '1px solid transparent' } : {}}>{e.result}</span></td>
                            <td style={{ padding: '1rem', textAlign: 'right' }}><button onClick={() => handleRemoveExam(e.id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}><Trash2 size={16} /></button></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default EmployeeProfileModal;
