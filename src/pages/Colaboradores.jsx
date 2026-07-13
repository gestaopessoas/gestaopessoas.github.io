import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../supabaseClient';
import { Trash2, UserX, UserCheck, Search, Filter, FileText, Table as TableIcon, Eye, Edit3 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import * as XLSX from 'xlsx';
import EmployeeProfileModal from '../components/EmployeeProfileModal';

const EMPTY_FORM = { name: '', department_id: '', birthday: '', unit: '', role: '', shirt_size: '', gender: '', phone: '', admission_date: '', cpf: '', rg: '', ctps: '', ctps_serie: '', pis: '', marital_status: '', cost_center: '', cbo: '', aso_date: '' };

const STATUS_TABS = [
  { key: 'Ativo', label: 'Ativos', color: '#22c55e' },
  { key: 'Desligado', label: 'Desligados', color: '#ef4444' },
];

const Colaboradores = () => {
  const { can } = useAuth();
  const [employees, setEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [activeTab, setActiveTab] = useState('Ativo');
  const [counts, setCounts] = useState({ Ativo: 0, Desligado: 0 });
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);

  // Filtros
  const [search, setSearch] = useState('');
  const [filterDept, setFilterDept] = useState('');
  const [filterUnit, setFilterUnit] = useState('');
  const [filterShirt, setFilterShirt] = useState('');
  const [filterGender, setFilterGender] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  // Modal desligamento
  const [dismissModal, setDismissModal] = useState(null);
  const [dismissDate, setDismissDate] = useState('');
  const [dismissing, setDismissing] = useState(false);

  // Modal de Perfil
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [editingEmployee, setEditingEmployee] = useState(null);

  // Form
  const [form, setForm] = useState(EMPTY_FORM);

  const canCreate = can('colaboradores', 'create');
  const canEdit = can('colaboradores', 'edit');
  const canDelete = can('colaboradores', 'delete');

  useEffect(() => { fetchDepartments(); fetchCounts(); }, []);
  useEffect(() => { fetchData(); }, [activeTab]);

  const fetchDepartments = async () => {
    const { data } = await supabase.from('departments').select('*').order('name');
    if (data) setDepartments(data);
  };

  const fetchCounts = async () => {
    const [{ count: a }, { count: d }] = await Promise.all([
      supabase.from('employees').select('*', { count: 'exact', head: true }).eq('status', 'Ativo'),
      supabase.from('employees').select('*', { count: 'exact', head: true }).eq('status', 'Desligado'),
    ]);
    setCounts({ Ativo: a || 0, Desligado: d || 0 });
  };

  const fetchData = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('employees')
      .select('*, departments(name)')
      .eq('status', activeTab)
      .order('name');
    if (data) setEmployees(data);
    setLoading(false);
  };

  const closeForm = () => {
    setForm(EMPTY_FORM);
    setEditingEmployee(null);
    setShowForm(false);
  };

  const startCreate = () => {
    setForm(EMPTY_FORM);
    setEditingEmployee(null);
    setShowForm(true);
  };

  const startEdit = (employee) => {
    setForm(Object.fromEntries(Object.keys(EMPTY_FORM).map(key => [key, employee[key] || ''])));
    setEditingEmployee(employee);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const normalizedForm = () => ({
    ...form,
    department_id: form.department_id || null,
    birthday: form.birthday || null,
    admission_date: form.admission_date || null,
    aso_date: form.aso_date || null
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (editingEmployee ? !canEdit : !canCreate) return;
    const payload = normalizedForm();
    const { error } = editingEmployee
      ? await supabase.from('employees').update(payload).eq('id', editingEmployee.id)
      : await supabase.from('employees').insert([{ ...payload, status: 'Ativo' }]);
    if (!error) { closeForm(); fetchData(); fetchCounts(); }
    else alert('Erro: ' + error.message);
  };

  const handleDismissConfirm = async () => {
    if (!dismissDate) { alert('Informe a data de demissão.'); return; }
    setDismissing(true);
    const { error } = await supabase.from('employees').update({ status: 'Desligado', dismissed_at: dismissDate }).eq('id', dismissModal.id);
    setDismissing(false);
    if (!error) { setDismissModal(null); setDismissDate(''); fetchData(); fetchCounts(); }
    else alert('Erro ao desligar: ' + (error.message || JSON.stringify(error)));
  };

  const handleReactivate = async (id) => {
    if (!window.confirm('Reativar este colaborador?')) return;
    await supabase.from('employees').update({ status: 'Ativo', dismissed_at: null }).eq('id', id);
    fetchData(); fetchCounts();
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Excluir permanentemente? Esta ação não pode ser desfeita.')) return;
    await supabase.from('employees').delete().eq('id', id);
    fetchData(); fetchCounts();
  };

  const clean = (value) => String(value || '').trim();
  const key = (value) => clean(value).toLowerCase();

  // Units derived from data
  const units = [...new Set(employees.map(e => clean(e.unit)).filter(Boolean))].sort();
  const shirtSizes = [...new Set(employees.map(e => clean(e.shirt_size)).filter(Boolean))].sort();

  const filtered = employees.filter(e => {
    const term = key(search);
    const haystack = [e.name, e.role, e.departments?.name, e.unit, e.cpf, e.rg].map(key).join(' ');
    const matchSearch = !term || haystack.includes(term);
    const matchDept = !filterDept || String(e.department_id || '') === String(filterDept);
    const matchUnit = !filterUnit || key(e.unit) === key(filterUnit);
    const matchShirt = !filterShirt || key(e.shirt_size) === key(filterShirt);
    const matchGender = !filterGender || key(e.gender) === key(filterGender);
    return matchSearch && matchDept && matchUnit && matchShirt && matchGender;
  });

  const clearFilters = () => { setSearch(''); setFilterDept(''); setFilterUnit(''); setFilterShirt(''); setFilterGender(''); };
  const hasFilters = search || filterDept || filterUnit || filterShirt || filterGender;

  const formatDate = (d) => {
    if (!d || typeof d !== 'string') return '—';
    const p = d.split('-');
    if (p.length !== 3) return d;
    return `${p[2]}/${p[1]}/${p[0]}`;
  };

  const inputStyle = { width: '100%', padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-text)', boxSizing: 'border-box', fontSize: '0.9rem' };
  const labelStyle = { display: 'block', marginBottom: '0.3rem', fontWeight: 600, fontSize: '0.8rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' };

  const handleExportPDF = () => {
    const doc = new jsPDF();
    doc.text(`Relatório de Colaboradores (${activeTab}s)`, 14, 15);
    
    const tableColumn = ["Nome", "Cargo", "Setor", "Unidade", "Admissão", activeTab === 'Desligado' ? "Demissão" : "Aniversário"];
    const tableRows = [];

    filtered.forEach(emp => {
      const rowData = [
        emp.name,
        emp.role || '—',
        emp.departments?.name || '—',
        emp.unit || '—',
        formatDate(emp.admission_date),
        activeTab === 'Desligado' ? formatDate(emp.dismissed_at) : (emp.birthday && typeof emp.birthday === 'string' && emp.birthday.includes('-') ? emp.birthday.split('-').reverse().join('/') : emp.birthday || '—')
      ];
      tableRows.push(rowData);
    });

    doc.autoTable({
      head: [tableColumn],
      body: tableRows,
      startY: 20,
      theme: 'grid',
    });
    doc.save(`colaboradores_${activeTab.toLowerCase()}.pdf`);
  };

  const handleExportExcel = () => {
    const tableData = filtered.map(emp => ({
      Nome: emp.name,
      Cargo: emp.role || '—',
      Setor: emp.departments?.name || '—',
      Unidade: emp.unit || '—',
      'Data Admissão': formatDate(emp.admission_date),
      [activeTab === 'Desligado' ? 'Data Demissão' : 'Aniversário']: activeTab === 'Desligado' ? formatDate(emp.dismissed_at) : (emp.birthday && typeof emp.birthday === 'string' && emp.birthday.includes('-') ? emp.birthday.split('-').reverse().join('/') : emp.birthday || '—')
    }));

    const ws = XLSX.utils.json_to_sheet(tableData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Colaboradores");
    XLSX.writeFile(wb, `colaboradores_${activeTab.toLowerCase()}.xlsx`);
  };

  return (
    <div className="glass-panel p-4 fade-in">
      {/* Header */}
      <div className="flex-between" style={{ marginBottom: '1.25rem' }}>
        <div>
          <h2 style={{ margin: 0 }}>Colaboradores</h2>
          <p style={{ margin: '0.2rem 0 0', fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
            {counts.Ativo} ativos · {counts.Desligado} desligados
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button onClick={handleExportPDF} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: '#dc2626', cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem' }} title="Exportar PDF">
            <FileText size={16} /> PDF
          </button>
          <button onClick={handleExportExcel} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: '#16a34a', cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem' }} title="Exportar Excel">
            <TableIcon size={16} /> Excel
          </button>
          {activeTab === 'Ativo' && canCreate && (
            <button className="btn-primary" onClick={showForm ? closeForm : startCreate}>
              {showForm ? '✕ Cancelar' : '+ Novo Colaborador'}
              {showForm ? '✕ Cancelar' : '+ Novo Colaborador'}
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', borderBottom: '2px solid var(--color-border)' }}>
        {STATUS_TABS.map(tab => (
          <button key={tab.key} onClick={() => { setActiveTab(tab.key); clearFilters(); }}
            style={{
              padding: '0.6rem 1.5rem', border: 'none', background: 'none', cursor: 'pointer',
              fontWeight: activeTab === tab.key ? 700 : 500,
              color: activeTab === tab.key ? tab.color : 'var(--color-text-muted)',
              borderBottom: activeTab === tab.key ? `2px solid ${tab.color}` : '2px solid transparent',
              marginBottom: '-2px', fontSize: '0.9rem', transition: 'all 0.2s',
              display: 'flex', alignItems: 'center', gap: '0.5rem'
            }}>
            {tab.label}
            <span className={`badge ${activeTab === tab.key ? (tab.key === 'Ativo' ? 'badge-active' : 'badge-inactive') : ''}`} style={activeTab !== tab.key ? { background: 'var(--color-border)', color: 'var(--color-text-muted)' } : {}}>
              {counts[tab.key]}
            </span>
          </button>
        ))}
      </div>

      {/* Search + Filter Bar */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <Search size={15} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
          <input type="text" placeholder="Buscar por nome ou cargo..." value={search} onChange={e => setSearch(e.target.value)}
            style={{ ...inputStyle, paddingLeft: '2.25rem' }} />
        </div>
        <button onClick={() => setShowFilters(!showFilters)}
          style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 1rem', borderRadius: 'var(--radius-md)', border: `1px solid ${hasFilters ? 'var(--color-primary)' : 'var(--color-border)'}`, background: hasFilters ? 'rgba(245,174,56,0.1)' : 'var(--color-surface)', color: hasFilters ? 'var(--color-primary)' : 'var(--color-text)', cursor: 'pointer', fontWeight: hasFilters ? 700 : 400, fontSize: '0.9rem' }}>
          <Filter size={15} /> Filtros {hasFilters && '●'}
        </button>
        {hasFilters && (
          <button onClick={clearFilters} style={{ padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', background: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '0.85rem' }}>
            Limpar
          </button>
        )}
      </div>

      {/* Filter Panel */}
      {showFilters && (
        <div className="glass-card" style={{ padding: '1rem', marginBottom: '1rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '1rem' }}>
          <div>
            <label style={labelStyle}>Setor / Depto.</label>
            <select value={filterDept} onChange={e => setFilterDept(e.target.value)} style={inputStyle}>
              <option value="">Todos</option>
              {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Unidade</label>
            <select value={filterUnit} onChange={e => setFilterUnit(e.target.value)} style={inputStyle}>
              <option value="">Todas</option>
              {units.map(u => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Gênero</label>
            <select value={filterGender} onChange={e => setFilterGender(e.target.value)} style={inputStyle}>
              <option value="">Todos</option>
              <option value="Masculino">Masculino</option>
              <option value="Feminino">Feminino</option>
            </select>
          </div>
          <div>
            <label style={labelStyle}>Tamanho Camisa</label>
            <select value={filterShirt} onChange={e => setFilterShirt(e.target.value)} style={inputStyle}>
              <option value="">Todos</option>
              {shirtSizes.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>
      )}

      {/* Form Novo */}
      {showForm && (
        <form onSubmit={handleSubmit} className="glass-card" style={{ padding: '1.25rem', marginBottom: '1.25rem' }}>
          <h4 style={{ margin: '0 0 1rem' }}>{editingEmployee ? 'Editar Colaborador' : 'Novo Colaborador'}</h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
            {[['name', 'Nome *', 'text'], ['role', 'Cargo', 'text'], ['phone', 'Telefone', 'text'], ['admission_date', 'Data Admissão', 'date'], ['birthday', 'Nascimento', 'date'], ['cpf', 'CPF', 'text'], ['rg', 'RG', 'text'], ['pis', 'PIS', 'text'], ['ctps', 'CTPS', 'text'], ['ctps_serie', 'Série CTPS', 'text'], ['cbo', 'CBO', 'text'], ['cost_center', 'Centro Custo', 'text'], ['aso_date', 'Data ASO', 'date']].map(([field, lbl, type]) => (
              <div key={field}>
                <label style={labelStyle}>{lbl}</label>
                <input type={type} value={form[field]} onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))} required={field === 'name'} style={inputStyle} />
              </div>
            ))}
            <div>
              <label style={labelStyle}>Estado Civil</label>
              <select value={form.marital_status} onChange={e => setForm(f => ({ ...f, marital_status: e.target.value }))} style={inputStyle}>
                <option value="">Selecione...</option>
                <option>Solteiro(a)</option><option>Casado(a)</option><option>Divorciado(a)</option><option>Viúvo(a)</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>Setor</label>
              <select value={form.department_id} onChange={e => setForm(f => ({ ...f, department_id: e.target.value }))} style={inputStyle}>
                <option value="">Selecione...</option>
                {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Unidade</label>
              <select value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))} style={inputStyle}>
                <option value="">Selecione...</option>
                {['Sede','Riviera','Connect Duque','Moov','Moov II'].map(u => <option key={u}>{u}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Gênero</label>
              <select value={form.gender} onChange={e => setForm(f => ({ ...f, gender: e.target.value }))} style={inputStyle}>
                <option value="">Selecione...</option>
                <option>Masculino</option><option>Feminino</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>Camisa</label>
              <input value={form.shirt_size} onChange={e => setForm(f => ({ ...f, shirt_size: e.target.value }))} placeholder="P, M, G..." style={inputStyle} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button type="submit" className="btn-primary">Salvar</button>
            <button type="button" onClick={closeForm} style={{ padding: '0.6rem 1.2rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', background: 'none', cursor: 'pointer' }}>Cancelar</button>
          </div>
        </form>
      )}

      {/* Table */}
      {loading ? <p className="text-muted">Carregando...</p> : filtered.length === 0 ? (
        <p className="text-muted" style={{ textAlign: 'center', padding: '2rem' }}>Nenhum colaborador encontrado com esses filtros.</p>
      ) : (
        <>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--color-border)', color: 'var(--color-text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  <th style={{ padding: '0.75rem 0.5rem' }}>Nome</th>
                  <th style={{ padding: '0.75rem 0.5rem' }}>Cargo</th>
                  <th style={{ padding: '0.75rem 0.5rem' }}>Setor</th>
                  <th style={{ padding: '0.75rem 0.5rem' }}>Unidade</th>
                  <th style={{ padding: '0.75rem 0.5rem' }}>Observação</th>
                  <th style={{ padding: '0.75rem 0.5rem' }}>Aniversário</th>
                  {activeTab === 'Ativo' && <th style={{ padding: '0.75rem 0.5rem' }}>Admissão</th>}
                  {activeTab === 'Desligado' && <th style={{ padding: '0.75rem 0.5rem', color: '#ef4444' }}>Demissão</th>}
                  <th style={{ padding: '0.75rem 0.5rem', textAlign: 'right' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((emp, index) => (
                  <tr key={emp.id} className="stagger-row hover-bg-transition" style={{ borderBottom: '1px solid var(--color-border)', animationDelay: `${index * 0.04}s` }}>
                    <td style={{ padding: '0.75rem 0.5rem', fontWeight: 600 }}>{emp.name}</td>
                    <td style={{ padding: '0.75rem 0.5rem', color: 'var(--color-text-muted)' }}>{emp.role || '—'}</td>
                    <td style={{ padding: '0.75rem 0.5rem', color: 'var(--color-text-muted)' }}>{emp.departments?.name || '—'}</td>
                    <td style={{ padding: '0.75rem 0.5rem', color: 'var(--color-text-muted)' }}>{emp.unit || '—'}</td>
                    <td style={{ padding: '0.75rem 0.5rem', color: 'var(--color-text-muted)', fontSize: '0.8rem', fontStyle: 'italic', maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={emp.observation || ''}>{emp.observation || '—'}</td>
                    <td style={{ padding: '0.75rem 0.5rem', color: 'var(--color-text-muted)' }}>{emp.birthday && typeof emp.birthday === 'string' && emp.birthday.includes('-') ? emp.birthday.split('-').reverse().join('/') : emp.birthday || '—'}</td>
                    {activeTab === 'Ativo' && <td style={{ padding: '0.75rem 0.5rem', color: 'var(--color-text-muted)' }}>{formatDate(emp.admission_date)}</td>}
                    {activeTab === 'Desligado' && <td style={{ padding: '0.75rem 0.5rem', color: '#ef4444', fontWeight: 600 }}>{formatDate(emp.dismissed_at)}</td>}
                    <td style={{ padding: '0.75rem 0.5rem', textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '0.3rem', justifyContent: 'flex-end', alignItems: 'center' }}>
                        <button onClick={() => setSelectedEmployee(emp)} className="btn-action btn-action-view" title="Ver Perfil">
                          <Eye size={16} />
                        </button>
                        {canEdit && (
                          <button onClick={() => startEdit(emp)} className="btn-action btn-action-edit" title="Editar">
                            <Edit3 size={16} />
                          </button>
                        )}
                        {activeTab === 'Ativo' && canEdit && (
                          <button onClick={() => { setDismissModal({ id: emp.id, name: emp.name }); setDismissDate(new Date().toISOString().split('T')[0]); }} className="btn-action btn-action-dismiss" title="Desligar">
                            <UserX size={16} />
                          </button>
                        )}
                        {activeTab === 'Desligado' && canEdit && (
                          <button onClick={() => reactivateEmployee(emp.id)} className="btn-action btn-action-reactivate" title="Reativar">
                            <UserCheck size={16} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p style={{ marginTop: '0.75rem', fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
            Exibindo <strong>{filtered.length}</strong> de <strong>{employees.length}</strong> registros
          </p>
        </>
      )}

      {/* Modal Desligamento */}
      {dismissModal && createPortal(
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="fade-in" style={{ background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', padding: '2rem', maxWidth: '420px', width: '90%', border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-lg)', color: 'var(--color-text)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
              <div style={{ background: 'rgba(245,158,11,0.12)', borderRadius: '50%', padding: '0.75rem', display: 'flex' }}>
                <UserX size={24} color="#f59e0b" />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--color-text)' }}>Desligar Colaborador</h3>
                <p style={{ margin: 0, color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>{dismissModal.name}</p>
              </div>
            </div>
            <label style={labelStyle}>Data de Demissão *</label>
            <input type="date" value={dismissDate} onChange={e => setDismissDate(e.target.value)}
              style={{ ...inputStyle, marginBottom: '1.5rem' }} />
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button onClick={() => { setDismissModal(null); setDismissDate(''); }}
                style={{ padding: '0.6rem 1.25rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', background: 'none', cursor: 'pointer', color: 'var(--color-text)' }}>
                Cancelar
              </button>
              <button onClick={handleDismissConfirm} disabled={dismissing}
                style={{ padding: '0.6rem 1.5rem', borderRadius: 'var(--radius-md)', border: 'none', background: '#f59e0b', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>
                {dismissing ? 'Salvando...' : 'Confirmar Desligamento'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Modal de Perfil Completo */}
      <EmployeeProfileModal 
        employee={selectedEmployee} 
        onClose={() => setSelectedEmployee(null)} 
      />
    </div>
  );
};

export default Colaboradores;
