import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../supabaseClient';
import cargos from '../../data/cargos.json';
import tabelaSalarial from '../../data/tabela_salarial.json';
import './MP.css';

const UNITS = ['Sede', 'Riviera', 'Connect Duque', 'Moov', 'Moov II'];
const MODALITIES = ['CLT', 'PJ', 'Estágio', 'Aprendiz'];
const NIVEIS_ROMANOS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];

const LOGOS = {
  'Sede': '/images/logo.png',
  'Riviera': '/images/logo-riviera.png',
  'Connect Duque': '/images/logo-connect.png',
  'Moov': '/images/logo-moov.png',
  'Moov II': '/images/logo-moov.png'
};

// Lookup de salário a partir do cargo, nível (romano) e modalidade
function calcularSalario(cargo, nivel, modalidade) {
  if (!cargo || !nivel || !modalidade) return null;
  const map = tabelaSalarial.cargos[cargo];
  if (!map) return null;
  const tabela = tabelaSalarial.tabelas[map.tabela];
  if (!tabela) return null;
  // modalidade CLT ou PJ
  const mod = (modalidade === 'CLT') ? 'CLT' : (modalidade === 'PJ') ? 'PJ' : null;
  if (!mod) return null;
  const valores = tabela[mod];
  if (!valores) return null;
  const idx = NIVEIS_ROMANOS.indexOf(nivel);
  if (idx === -1 || idx >= valores.length) return null;
  return valores[idx];
}

// Lookup de VR a partir do nível
function calcularVR(nivel) {
  return tabelaSalarial.vr[nivel] || null;
}

const MPContratacao = () => {
  const navigate = useNavigate();
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
    current_benefits: '',
    requested_by: '',
    verified_by: '',
    movement_reason: '',
    justification: '',
    effective_date: '',
  });

  const set = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  // Cálculo automático — apenas visual, nunca salvo no banco
  const salarioCalculado = useMemo(() =>
    calcularSalario(form.from_role, form.current_level, form.current_modality),
    [form.from_role, form.current_level, form.current_modality]
  );

  const vrCalculado = useMemo(() =>
    calcularVR(form.current_level),
    [form.current_level]
  );

  const formatCurrency = (v) =>
    v != null ? v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '—';

  const handleSave = async () => {
    setSaving(true);
    let finalEmployeeId = form.employee_id;
    let employeeError = null;

    // Se não tem ID, é um candidato novo — cadastra o funcionário
    if (!finalEmployeeId) {
      const { data: newEmp, error: empErr } = await supabase.from('employees').insert([{
        name: form.employee_name,
        role: form.from_role,
        department: form.current_sector,
        status: 'Ativo',
        admission_date: form.effective_date || new Date().toISOString().split('T')[0],
      }]).select();
      
      employeeError = empErr;
      if (newEmp && newEmp.length > 0) {
        finalEmployeeId = newEmp[0].id;
        set('employee_id', finalEmployeeId);
      }
    }

    if (employeeError) {
      alert('Erro ao cadastrar funcionário: ' + employeeError.message);
      setSaving(false);
      return;
    }

    // Salvar Memorando — SEM salary (apenas dados de cadastro e cargo)
    const { employee_id: _eid, current_salary: _sal, ...formParaSalvar } = form;
    const { error: memoError } = await supabase.from('memos').insert([{
      ...formParaSalvar,
      employee_id: finalEmployeeId,
      type: 'contratacao',
    }]);

    // Criar card no RGS automaticamente
    const { error: rgsError } = await supabase.from('rgs_processes').insert([{
      employee_name: form.employee_name,
      process_type: 'Admissional',
      status: 'Pendente',
      role: form.from_role,
      location: form.current_location,
      sector: form.current_sector,
      process_date: new Date().toISOString().split('T')[0]
    }]);

    setSaving(false);
    
    if (memoError) {
      alert('Erro ao salvar memorando: ' + memoError.message);
    } else if (rgsError) {
      alert('Memorando salvo, mas erro ao criar RGS: ' + rgsError.message);
    } else {
      setSaved(true);
      setTimeout(() => handlePrint(), 300);
    }
  };

  const handlePrint = () => window.print();

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
            <img 
              src={LOGOS[form.unit] || '/images/logo.png'} 
              onError={(e) => { e.target.onerror = null; e.target.src="/images/logo.png" }} 
              alt={form.unit} 
              className="mp-logo" 
            />
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

        {/* Candidato */}
        <div className="mp-section">
          <div className="mp-row">
            <div className="mp-field-group" style={{flex:3}}>
              <label className="mp-label">Nome do(a) candidato(a)</label>
              <input
                placeholder="Digite o nome do candidato..."
                value={form.employee_name}
                onChange={e => set('employee_name', e.target.value)}
                className="mp-input"
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
              <select value={form.current_level} onChange={e => set('current_level', e.target.value)} className="mp-input">
                <option value="">—</option>
                {NIVEIS_ROMANOS.map(n => <option key={n} value={n}>Nível {n}</option>)}
              </select>
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
              <label className="mp-label">
                Remuneração (R$)
                {salarioCalculado != null && (
                  <span style={{marginLeft:'0.5rem', fontSize:'0.75rem', color:'#22c55e', fontWeight:600}}>
                    ↳ Tabela: {formatCurrency(salarioCalculado)}
                  </span>
                )}
              </label>
              <input
                value={salarioCalculado != null ? formatCurrency(salarioCalculado) : '—'}
                readOnly
                className="mp-input"
                style={{background:'var(--color-bg)', color: salarioCalculado ? 'var(--color-text)' : 'var(--color-text-muted)', cursor:'default'}}
              />
            </div>
            <div className="mp-field-group" style={{flex:1}}>
              <label className="mp-label">
                VR (R$)
                {vrCalculado != null && (
                  <span style={{marginLeft:'0.5rem', fontSize:'0.75rem', color:'#3b82f6', fontWeight:600}}>
                    ↳ Nível {form.current_level}
                  </span>
                )}
              </label>
              <input
                value={vrCalculado != null ? formatCurrency(vrCalculado) : '—'}
                readOnly
                className="mp-input"
                style={{background:'var(--color-bg)', color: vrCalculado ? 'var(--color-text)' : 'var(--color-text-muted)', cursor:'default'}}
              />
            </div>
            <div className="mp-field-group" style={{flex:2}}>
              <label className="mp-label">Outros Benefícios</label>
              <input value={form.current_benefits} onChange={e => set('current_benefits', e.target.value)} className="mp-input" placeholder="Ex: Cesta Básica, Odontoprev..." />
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
