import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { FileText, Search, Upload } from 'lucide-react';
import './ControleRGS.css';

const ControleRGS = () => {
  const [processes, setProcesses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState('Todos');
  const [filterStatus, setFilterStatus] = useState('Todos');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchProcesses();
  }, []);

  const fetchProcesses = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('rgs_processes')
      .select('*')
      .order('process_date', { ascending: false });

    if (data) setProcesses(data);
    else if (error) console.error(error);
    setLoading(false);
  };

  const handleStatusChange = async (id, currentStatus) => {
    const newStatus = currentStatus === 'Pendente' ? 'Concluído' : 'Pendente';
    await supabase.from('rgs_processes').update({ status: newStatus }).eq('id', id);
    fetchProcesses();
  };

  const filtered = processes.filter(p => {
    const matchType = filterType === 'Todos' || p.process_type === filterType;
    const matchStatus = filterStatus === 'Todos' || p.status === filterStatus;
    const matchName = p.employee_name?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchType && matchStatus && matchName;
  });

  return (
    <div className="glass-panel p-4 fade-in">
      <div className="flex-between mb-4">
        <h2>Controle RGS</h2>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="btn-secondary" onClick={() => alert('Para importar, coloque o CSV em Downloads e eu rodo o script de importação para você!')}>
            <Upload size={16} style={{ marginRight: '4px' }} /> Importar RGS (CSV)
          </button>
          <button className="btn-primary">Novo Processo RGS</button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', backgroundColor: 'var(--color-surface)', padding: '0.5rem 1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', flex: 1, minWidth: '250px' }}>
          <Search size={18} style={{ color: 'var(--color-text-muted)', marginRight: '0.5rem' }} />
          <input 
            type="text" 
            placeholder="Buscar por colaborador..." 
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            style={{ border: 'none', background: 'transparent', outline: 'none', width: '100%', color: 'var(--color-text)' }}
          />
        </div>
        <select value={filterType} onChange={e => setFilterType(e.target.value)} style={{ padding: '0.5rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface)' }}>
          <option value="Todos">Todos os Processos</option>
          <option value="Admissional">Admissional</option>
          <option value="Demissional">Demissional</option>
          <option value="Alteração de cargo">Alteração de cargo</option>
          <option value="Alteração de salário">Alteração de salário</option>
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ padding: '0.5rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface)' }}>
          <option value="Todos">Todos os Status</option>
          <option value="Pendente">Pendente</option>
          <option value="Concluído">Concluído</option>
        </select>
      </div>

      <div className="rgs-table-container">
        {loading ? (
          <p className="text-muted">Carregando...</p>
        ) : filtered.length === 0 ? (
          <p className="text-muted">Nenhum processo encontrado.</p>
        ) : (
          <table className="rgs-table">
            <thead>
              <tr>
                <th>Data</th>
                <th>Processo</th>
                <th>Colaborador</th>
                <th>Cargo / Local</th>
                <th>SST / Exame</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => (
                <tr key={p.id}>
                  <td>{p.process_date ? new Date(p.process_date).toLocaleDateString('pt-BR') : '-'}</td>
                  <td>
                    <span className={`process-badge ${p.process_type?.replace(/\s+/g, '-').toLowerCase()}`}>
                      {p.process_type}
                    </span>
                  </td>
                  <td style={{ fontWeight: 500 }}>{p.employee_name}</td>
                  <td>
                    <div style={{ fontSize: '0.85rem' }}>{p.role}</div>
                    <div className="text-muted" style={{ fontSize: '0.75rem' }}>{p.location} - {p.sector}</div>
                  </td>
                  <td>
                    <div style={{ fontSize: '0.85rem' }}>SST: {p.sst_status || '-'}</div>
                    <div className="text-muted" style={{ fontSize: '0.75rem' }}>Exame: {p.exam_date ? new Date(p.exam_date).toLocaleDateString('pt-BR') : '-'}</div>
                  </td>
                  <td>
                    <button 
                      onClick={() => handleStatusChange(p.id, p.status)}
                      className={`status-btn ${p.status === 'Concluído' ? 'status-done' : 'status-pending'}`}
                    >
                      {p.status || 'Pendente'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default ControleRGS;
