import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../supabaseClient';
import cargos from '../../data/cargos.json';
import './MP.css';

const UNITS = ['Sede', 'Riviera', 'Connect Duque', 'Moov', 'Moov II'];
const MODALITIES = ['CLT', 'PJ', 'Estágio', 'Aprendiz'];

const MPContratacao = () => {
  const navigate = useNavigate();
  const [employees, setEmployees] = useState([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [form, setForm] = useState({
    unit: 'Sede',
    employee_name: '',
    employee_id: '',
    registration: '',
    file_number: '',
    phone: '',
    email: '',
    current_location: '',
    current_sector: '',
    current_cost_center: '',
    from_role: '',
    current_level: '',
    current_profile_code: '',
    current_modality: 'CLT',
    current_salary: '',
    current_benefits: '',
    requested_by: '',
    verified_by: '',
    movement_reason: '',
    justification: '',
    effective_date: '',
  });

  useEffect(() => {
    supabase.from('employees').select('id,name').eq('status','Ativo').order('name').then(({data}) => {
      if (data) setEmployees(data);
    });
  }, []);

  const set = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  const handleEmployeeChange = (id) => {
    const emp = employees.find(e => e.id === id);
    set('employee_id', id);
    if (emp) set('employee_name', emp.name);
  };

  const handleSave = async () => {
    setSaving(true);
    const { error } = await supabase.from('memos').insert([{
      ...form,
      type: 'contratacao',
      current_salary: form.current_salary ? parseFloat(form.current_salary) : null,
    }]);
    setSaving(false);
    if (!error) {
      setSaved(true);
      setTimeout(() => handlePrint(), 300);
    } else {
      alert('Erro ao salvar: ' + error.message);
    }
  };

  const handlePrint = () => window.print();

  const Field = ({ label, value, onChange, type='text', children }) => (
    <div className="mp-field">
      <label className="mp-label">{label}</label>
      {children || (
        <input
          type={type}
          value={value}
          onChange={e => onChange(e.target.value)}
          className="mp-input"
        />
      )}
    </div>
  );

  return (
    <div className="mp-wrapper">
      {/* Toolbar - hidden on print */}
      <div className="mp-toolbar no-print">
        <button className="btn-secondary" onClick={() => navigate(-1)}>← Voltar</button>
        <div style={{display:'flex', gap:'1rem', alignItems:'center'}}>
          {saved && <span style={{color:'#22c55e', fontWeight:600}}>✓ Salvo no banco!</span>}
          <button className="btn-primary" onClick={handleSave} disabled={saving || !form.employee_name}>
            {saving ? 'Salvando...' : 'Salvar e Imprimir'}
          </button>
          <button className="btn-secondary" onClick={handlePrint}>🖨️ Imprimir</button>
        </div>
      </div>

      {/* MP Document */}
      <div className="mp-document">
        {/* Header */}
        <div className="mp-header">
          <div className="mp-logo-area">
            <img src="/images/logo.png" alt="ACPO" className="mp-logo" />
          </div>
          <div className="mp-title-area">
            <h1 className="mp-title">CONTRATAÇÃO</h1>
            <p className="mp-subtitle">Memorando de Pessoal</p>
          </div>
          <div className="mp-meta">
            <div className="mp-meta-field">
              <span>Matrícula:</span>
              <input value={form.registration} onChange={e => set('registration', e.target.value)} className="mp-meta-input" />
            </div>
            <div className="mp-meta-field">
              <span>Ficha:</span>
              <input value={form.file_number} onChange={e => set('file_number', e.target.value)} className="mp-meta-input" />
            </div>
          </div>
        </div>

        {/* Unidade */}
        <div className="mp-section-row">
          <div className="mp-field-group" style={{flex:1}}>
            <label className="mp-label">Unidade</label>
            <select value={form.unit} onChange={e => set('unit', e.target.value)} className="mp-input">
              {UNITS.map(u => <option key={u}>{u}</option>)}
            </select>
          </div>
        </div>

        {/* Colaborador */}
        <div className="mp-section">
          <div className="mp-row">
            <div className="mp-field-group" style={{flex:3}}>
              <label className="mp-label">Nome do(a) colaborador(a)</label>
              <select value={form.employee_id} onChange={e => handleEmployeeChange(e.target.value)} className="mp-input">
                <option value="">Selecione ou digite abaixo...</option>
                {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
              <input
                placeholder="Ou digite o nome manualmente..."
                value={form.employee_name}
                onChange={e => set('employee_name', e.target.value)}
                className="mp-input"
                style={{marginTop:'4px'}}
              />
            </div>
            <div className="mp-field-group" style={{flex:1}}>
              <label className="mp-label">Telefone</label>
              <input value={form.phone} onChange={e => set('phone', e.target.value)} className="mp-input" />
            </div>
            <div className="mp-field-group" style={{flex:2}}>
              <label className="mp-label">E-mail</label>
              <input value={form.email} onChange={e => set('email', e.target.value)} className="mp-input" type="email" />
            </div>
          </div>
        </div>

        {/* Dados do Cargo */}
        <div className="mp-section">
          <h3 className="mp-section-title">Dados do Cargo</h3>
          <div className="mp-row">
            <div className="mp-field-group" style={{flex:2}}>
              <label className="mp-label">Local</label>
              <input value={form.current_location} onChange={e => set('current_location', e.target.value)} className="mp-input" />
            </div>
            <div className="mp-field-group" style={{flex:2}}>
              <label className="mp-label">Setor</label>
              <input value={form.current_sector} onChange={e => set('current_sector', e.target.value)} className="mp-input" />
            </div>
            <div className="mp-field-group" style={{flex:1}}>
              <label className="mp-label">Centro de Custo</label>
              <input value={form.current_cost_center} onChange={e => set('current_cost_center', e.target.value)} className="mp-input" />
            </div>
          </div>
          <div className="mp-row">
            <div className="mp-field-group" style={{flex:3}}>
              <label className="mp-label">Cargo</label>
              <select value={form.from_role} onChange={e => set('from_role', e.target.value)} className="mp-input">
                <option value="">Selecione...</option>
                {cargos.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="mp-field-group" style={{flex:1}}>
              <label className="mp-label">Nível</label>
              <input value={form.current_level} onChange={e => set('current_level', e.target.value)} className="mp-input" />
            </div>
            <div className="mp-field-group" style={{flex:1}}>
              <label className="mp-label">Cód. Perfil</label>
              <input value={form.current_profile_code} onChange={e => set('current_profile_code', e.target.value)} className="mp-input" />
            </div>
          </div>
          <div className="mp-row">
            <div className="mp-field-group" style={{flex:1}}>
              <label className="mp-label">Modalidade</label>
              <select value={form.current_modality} onChange={e => set('current_modality', e.target.value)} className="mp-input">
                {MODALITIES.map(m => <option key={m}>{m}</option>)}
              </select>
            </div>
            <div className="mp-field-group" style={{flex:1}}>
              <label className="mp-label">Remuneração (R$)</label>
              <input value={form.current_salary} onChange={e => set('current_salary', e.target.value)} className="mp-input" type="number" step="0.01" />
            </div>
            <div className="mp-field-group" style={{flex:2}}>
              <label className="mp-label">Benefícios</label>
              <input value={form.current_benefits} onChange={e => set('current_benefits', e.target.value)} className="mp-input" />
            </div>
          </div>
        </div>

        {/* Rodapé */}
        <div className="mp-section">
          <div className="mp-row">
            <div className="mp-field-group" style={{flex:2}}>
              <label className="mp-label">MP Solicitada por</label>
              <input value={form.requested_by} onChange={e => set('requested_by', e.target.value)} className="mp-input" />
            </div>
            <div className="mp-field-group" style={{flex:2}}>
              <label className="mp-label">Razão da Movimentação</label>
              <input value={form.movement_reason} onChange={e => set('movement_reason', e.target.value)} className="mp-input" />
            </div>
            <div className="mp-field-group" style={{flex:1}}>
              <label className="mp-label">Vigência</label>
              <input value={form.effective_date} onChange={e => set('effective_date', e.target.value)} className="mp-input" type="date" />
            </div>
          </div>
          <div className="mp-row">
            <div className="mp-field-group" style={{flex:2}}>
              <label className="mp-label">Verificado por</label>
              <input value={form.verified_by} onChange={e => set('verified_by', e.target.value)} className="mp-input" />
            </div>
            <div className="mp-field-group" style={{flex:3}}>
              <label className="mp-label">Justificativa / Observações</label>
              <textarea value={form.justification} onChange={e => set('justification', e.target.value)} className="mp-input" rows={2} />
            </div>
          </div>
        </div>

        {/* Assinaturas */}
        <div className="mp-signatures">
          <div className="mp-sig-box">
            <div className="mp-sig-line"></div>
            <p>Coordenador / Requisitante</p>
          </div>
          <div className="mp-sig-box">
            <div className="mp-sig-line"></div>
            <p>Diretoria</p>
          </div>
          <div className="mp-sig-box">
            <div className="mp-sig-line"></div>
            <p>Gestão de Pessoas</p>
          </div>
        </div>

        <div className="mp-footer">
          <span>MP criada em {new Date().toLocaleDateString('pt-BR')}</span>
          <span>Rev. 03</span>
        </div>
      </div>
    </div>
  );
};

export default MPContratacao;
