import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { Trash2, UserX, UserCheck, Search, ChevronDown } from 'lucide-react';

const STATUS_TABS = ['Ativo', 'Desligado', 'Arquivo Morto'];

const Colaboradores = () => {
  const [employees, setEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [activeTab, setActiveTab] = useState('Ativo');
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Modal desligamento
  const [dismissModal, setDismissModal] = useState(null); // { id, name }
  const [dismissDate, setDismissDate] = useState('');
  const [dismissing, setDismissing] = useState(false);

  // Form state
  const [name, setName] = useState('');
  const [deptId, setDeptId] = useState('');
  const [birthday, setBirthday] = useState('');

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const fetchData = async () => {
    setLoading(true);
    const { data: depts } = await supabase.from('departments').select('*').order('name');
    if (depts) setDepartments(depts);

    const { data: emps } = await supabase
      .from('employees')
      .select('*, departments(name)')
      .eq('status', activeTab)
      .order('name');
    if (emps) setEmployees(emps);
    setLoading(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name) return;
    const { error } = await supabase.from('employees').insert([{
      name,
      department_id: deptId || null,
      birthday: birthday || null,
      status: 'Ativo'
    }]);
    if (!error) {
      setName(''); setDeptId(''); setBirthday('');
      setShowForm(false);
      fetchData();
    } else {
      alert('Erro ao salvar: ' + error.message);
    }
  };

  // Confirmar desligamento
  const handleDismissConfirm = async () => {
    if (!dismissDate) { alert('Informe a data de demissão.'); return; }
    setDismissing(true);
    const { error } = await supabase
      .from('employees')
      .update({ status: 'Desligado', dismissed_at: dismissDate })
      .eq('id', dismissModal.id);
    setDismissing(false);
    if (!error) {
      setDismissModal(null);
      setDismissDate('');
      fetchData();
    } else {
      alert('Erro: ' + error.message);
    }
  };

  // Reativar colaborador
  const handleReactivate = async (id) => {
    if (!window.confirm('Reativar este colaborador?')) return;
    await supabase.from('employees').update({ status: 'Ativo', dismissed_at: null }).eq('id', id);
    fetchData();
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Excluir permanentemente?')) return;
    await supabase.from('employees').delete().eq('id', id);
    fetchData();
  };

  const filtered = employees.filter(e =>
    e.name.toLowerCase().includes(search.toLowerCase())
  );

  const formatDate = (d) => {
    if (!d) return '-';
    const p = d.split('-');
    return `${p[2]}/${p[1]}/${p[0]}`;
  };

  return (
    <div className="glass-panel p-4 fade-in">
      {/* Cabeçalho */}
      <div className="flex-between" style={{ marginBottom: '1rem' }}>
        <h2>Colaboradores</h2>
        {activeTab === 'Ativo' && (
          <button className="btn-primary" onClick={() => setShowForm(!showForm)}>
            {showForm ? 'Cancelar' : '+ Adicionar'}
          </button>
        )}
      </div>

      {/* Abas de Status */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', borderBottom: '1px solid var(--color-border)', paddingBottom: '0' }}>
        {STATUS_TABS.map(tab => (
          <button
            key={tab}
            onClick={() => { setActiveTab(tab); setSearch(''); }}
            style={{
              padding: '0.6rem 1.25rem',
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              fontWeight: activeTab === tab ? 700 : 400,
              color: activeTab === tab ? 'var(--color-primary)' : 'var(--color-text-muted)',
              borderBottom: activeTab === tab ? '2px solid var(--color-primary)' : '2px solid transparent',
              marginBottom: '-1px',
              fontSize: '0.9rem',
              transition: 'all 0.2s',
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Busca */}
      <div style={{ position: 'relative', marginBottom: '1rem' }}>
        <Search size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
        <input
          type="text"
          placeholder="Buscar por nome..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ width: '100%', padding: '0.6rem 1rem 0.6rem 2.25rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-text)', boxSizing: 'border-box' }}
        />
      </div>

      {/* Form de novo colaborador */}
      {showForm && (
        <form onSubmit={handleSubmit} className="mt-4 p-4" style={{ backgroundColor: 'var(--color-bg)', borderRadius: 'var(--radius-md)', marginBottom: '1rem' }}>
          <div className="grid-cols-3" style={{ marginBottom: '1rem' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '0.4rem', fontWeight: 600, fontSize: '0.85rem' }}>Nome *</label>
              <input type="text" value={name} onChange={e => setName(e.target.value)} required style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--color-border)', boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '0.4rem', fontWeight: 600, fontSize: '0.85rem' }}>Setor</label>
              <select value={deptId} onChange={e => setDeptId(e.target.value)} style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--color-border)' }}>
                <option value="">Selecione...</option>
                {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '0.4rem', fontWeight: 600, fontSize: '0.85rem' }}>Data de Nascimento</label>
              <input type="date" value={birthday} onChange={e => setBirthday(e.target.value)} style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--color-border)' }} />
            </div>
          </div>
          <button type="submit" className="btn-primary">Salvar</button>
        </form>
      )}

      {/* Tabela */}
      <div>
        {loading ? (
          <p className="text-muted">Carregando...</p>
        ) : filtered.length === 0 ? (
          <p className="text-muted">Nenhum colaborador encontrado.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--color-border)', color: 'var(--color-text-muted)', fontSize: '0.8rem', textTransform: 'uppercase' }}>
                <th style={{ padding: '0.75rem 0' }}>Nome</th>
                <th style={{ padding: '0.75rem 0' }}>Setor</th>
                <th style={{ padding: '0.75rem 0' }}>Aniversário</th>
                {activeTab === 'Desligado' && <th style={{ padding: '0.75rem 0' }}>Data Demissão</th>}
                {activeTab === 'Ativo' && <th style={{ padding: '0.75rem 0' }}>Admissão</th>}
                <th style={{ padding: '0.75rem 0', textAlign: 'right' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(emp => (
                <tr key={emp.id} style={{ borderBottom: '1px solid var(--color-border-light)' }}>
                  <td style={{ padding: '0.75rem 0', fontWeight: 500 }}>{emp.name}</td>
                  <td style={{ padding: '0.75rem 0', color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>{emp.departments?.name || emp.unit || '-'}</td>
                  <td style={{ padding: '0.75rem 0', color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>
                    {emp.birthday ? emp.birthday.split('-').slice(1).reverse().join('/') : '-'}
                  </td>
                  {activeTab === 'Desligado' && (
                    <td style={{ padding: '0.75rem 0', color: '#ef4444', fontSize: '0.9rem' }}>
                      {formatDate(emp.dismissed_at)}
                    </td>
                  )}
                  {activeTab === 'Ativo' && (
                    <td style={{ padding: '0.75rem 0', color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>
                      {formatDate(emp.admission_date)}
                    </td>
                  )}
                  <td style={{ padding: '0.75rem 0', textAlign: 'right', display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                    {activeTab === 'Ativo' && (
                      <button
                        onClick={() => { setDismissModal({ id: emp.id, name: emp.name }); setDismissDate(new Date().toISOString().split('T')[0]); }}
                        title="Desligar colaborador"
                        style={{ color: '#f59e0b', padding: '0.25rem', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.8rem' }}
                      >
                        <UserX size={16} /> Desligar
                      </button>
                    )}
                    {activeTab === 'Desligado' && (
                      <button
                        onClick={() => handleReactivate(emp.id)}
                        title="Reativar"
                        style={{ color: '#22c55e', padding: '0.25rem', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.8rem' }}
                      >
                        <UserCheck size={16} /> Reativar
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(emp.id)}
                      title="Excluir"
                      style={{ color: '#ef4444', padding: '0.25rem', background: 'none', border: 'none', cursor: 'pointer' }}
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p style={{ marginTop: '0.75rem', fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
          {filtered.length} registro(s) encontrado(s)
        </p>
      </div>

      {/* Modal de Desligamento */}
      {dismissModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <div style={{
            background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)',
            padding: '2rem', maxWidth: '440px', width: '90%',
            border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-lg)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
              <div style={{ background: 'rgba(245,158,11,0.15)', borderRadius: '50%', padding: '0.75rem' }}>
                <UserX size={24} color="#f59e0b" />
              </div>
              <div>
                <h3 style={{ margin: 0 }}>Desligar Colaborador</h3>
                <p style={{ margin: 0, color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>{dismissModal.name}</p>
              </div>
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.5rem', fontSize: '0.9rem' }}>
                Data de Demissão *
              </label>
              <input
                type="date"
                value={dismissDate}
                onChange={e => setDismissDate(e.target.value)}
                style={{ width: '100%', padding: '0.6rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-text)', boxSizing: 'border-box' }}
              />
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button
                onClick={() => { setDismissModal(null); setDismissDate(''); }}
                style={{ padding: '0.6rem 1.25rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', background: 'none', cursor: 'pointer', color: 'var(--color-text)' }}
              >
                Cancelar
              </button>
              <button
                onClick={handleDismissConfirm}
                disabled={dismissing}
                style={{ padding: '0.6rem 1.25rem', borderRadius: 'var(--radius-md)', border: 'none', background: '#f59e0b', color: '#fff', fontWeight: 700, cursor: 'pointer' }}
              >
                {dismissing ? 'Salvando...' : 'Confirmar Desligamento'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Colaboradores;
