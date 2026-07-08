import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../supabaseClient';
import { Search, Briefcase, Plus, Eye, X, Check, CheckCircle, Clock } from 'lucide-react';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import * as XLSX from 'xlsx';
import VagaFormModal from '../components/VagaFormModal';

const Vagas = () => {
  const [openings, setOpenings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [activeTab, setActiveTab] = useState('Todas');
  
  // Detalhes da vaga (Visualização)
  const [selectedOpening, setSelectedOpening] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('job_openings')
      .select('*, job_profiles(title, profile_code), departments(name)')
      .order('created_at', { ascending: false });

    if (error) {
      console.error(error);
    } else {
      setOpenings(data || []);
    }
    setLoading(false);
  };

  const handleStatusChange = async (id, newStatus) => {
    const { error } = await supabase.from('job_openings').update({ status: newStatus }).eq('id', id);
    if (!error) {
      fetchData();
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('pt-BR');
  };

  const filtered = openings.filter(o => {
    const titleMatch = !search || o.job_profiles?.title?.toLowerCase().includes(search.toLowerCase()) || o.job_profiles?.profile_code?.toLowerCase().includes(search.toLowerCase());
    const tabMatch = activeTab === 'Todas' || o.status === activeTab;
    return titleMatch && tabMatch;
  });

  const getStatusBadge = (status) => {
    let color = '#6b7280';
    let bg = 'rgba(107, 114, 128, 0.1)';
    if (status === 'Pendente') { color = '#f59e0b'; bg = 'rgba(245, 158, 11, 0.1)'; }
    if (status === 'Aberta') { color = '#3b82f6'; bg = 'rgba(59, 130, 246, 0.1)'; }
    if (status === 'Fechada') { color = '#22c55e'; bg = 'rgba(34, 197, 94, 0.1)'; }
    if (status === 'Cancelada') { color = '#ef4444'; bg = 'rgba(239, 68, 68, 0.1)'; }
    
    return (
      <span style={{ background: bg, color: color, padding: '0.25rem 0.6rem', borderRadius: '999px', fontSize: '0.75rem', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
        {status === 'Pendente' && <Clock size={12} />}
        {status === 'Fechada' && <CheckCircle size={12} />}
        {status}
      </span>
    );
  };

  const inputStyle = { width: '100%', padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-text)', boxSizing: 'border-box', fontSize: '0.9rem' };

  return (
    <div className="glass-panel p-4 fade-in">
      {/* Header */}
      <div className="flex-between" style={{ marginBottom: '1.25rem' }}>
        <div>
          <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Briefcase size={24} color="var(--color-primary)" /> Recrutamento e Vagas
          </h2>
          <p style={{ margin: '0.2rem 0 0', fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
            Gerencie as requisições de novas contratações e acompanhe o preenchimento.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="btn-primary" onClick={() => setShowForm(true)} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Plus size={16} /> Solicitar Vaga
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', borderBottom: '2px solid var(--color-border)' }}>
        {['Todas', 'Pendente', 'Aberta', 'Fechada', 'Cancelada'].map(tab => {
            const count = tab === 'Todas' ? openings.length : openings.filter(o => o.status === tab).length;
            return (
              <button key={tab} onClick={() => setActiveTab(tab)}
                style={{
                  padding: '0.6rem 1.5rem', border: 'none', background: 'none', cursor: 'pointer',
                  fontWeight: activeTab === tab ? 700 : 500,
                  color: activeTab === tab ? 'var(--color-primary)' : 'var(--color-text-muted)',
                  borderBottom: activeTab === tab ? `2px solid var(--color-primary)` : '2px solid transparent',
                  marginBottom: '-2px', fontSize: '0.9rem', transition: 'all 0.2s',
                  display: 'flex', alignItems: 'center', gap: '0.5rem'
                }}>
                {tab}
                <span style={{ background: activeTab === tab ? 'var(--color-primary)' : 'var(--color-border)', color: activeTab === tab ? '#fff' : 'var(--color-text-muted)', borderRadius: '999px', padding: '0.1rem 0.5rem', fontSize: '0.75rem', fontWeight: 700 }}>
                  {count}
                </span>
              </button>
            );
        })}
      </div>

      {/* Busca */}
      <div style={{ position: 'relative', flex: 1, marginBottom: '1.5rem', maxWidth: '400px' }}>
        <Search size={15} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
        <input type="text" placeholder="Buscar por cargo ou código do perfil..." value={search} onChange={e => setSearch(e.target.value)}
          style={{ ...inputStyle, paddingLeft: '2.25rem' }} />
      </div>

      {/* Tabela */}
      {loading ? <p className="text-muted">Carregando vagas...</p> : filtered.length === 0 ? (
        <p className="text-muted" style={{ textAlign: 'center', padding: '2rem' }}>Nenhuma vaga encontrada.</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--color-border)', color: 'var(--color-text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                <th style={{ padding: '0.75rem 0.5rem' }}>Perfil (Cargo)</th>
                <th style={{ padding: '0.75rem 0.5rem' }}>Setor</th>
                <th style={{ padding: '0.75rem 0.5rem' }}>Solicitante</th>
                <th style={{ padding: '0.75rem 0.5rem' }}>Tipo Contrato</th>
                <th style={{ padding: '0.75rem 0.5rem' }}>Previsão</th>
                <th style={{ padding: '0.75rem 0.5rem' }}>Status</th>
                <th style={{ padding: '0.75rem 0.5rem', textAlign: 'right' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(op => (
                <tr key={op.id} style={{ borderBottom: '1px solid var(--color-border)', transition: 'background 0.15s' }}
                  onMouseOver={e => e.currentTarget.style.background = 'var(--color-bg)'}
                  onMouseOut={e => e.currentTarget.style.background = 'transparent'}>
                  <td style={{ padding: '0.75rem 0.5rem', fontWeight: 600 }}>
                    {op.job_profiles?.title || '—'}
                    <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 400 }}>
                      PC: {op.job_profiles?.profile_code}
                    </span>
                  </td>
                  <td style={{ padding: '0.75rem 0.5rem', color: 'var(--color-text-muted)' }}>{op.departments?.name || '—'}</td>
                  <td style={{ padding: '0.75rem 0.5rem', color: 'var(--color-text-muted)' }}>{op.created_by || 'RH/Diretoria'}</td>
                  <td style={{ padding: '0.75rem 0.5rem', color: 'var(--color-text-muted)' }}>{op.contract_type}</td>
                  <td style={{ padding: '0.75rem 0.5rem', color: 'var(--color-text-muted)' }}>{formatDate(op.target_date)}</td>
                  <td style={{ padding: '0.75rem 0.5rem' }}>{getStatusBadge(op.status)}</td>
                  <td style={{ padding: '0.75rem 0.5rem', textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', alignItems: 'center' }}>
                      <select 
                        value={op.status}
                        onChange={(e) => handleStatusChange(op.id, e.target.value)}
                        style={{ padding: '0.3rem', borderRadius: '4px', border: '1px solid var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-text)', fontSize: '0.8rem' }}>
                        <option value="Pendente">Pendente</option>
                        <option value="Aberta">Aberta</option>
                        <option value="Fechada">Fechada</option>
                        <option value="Cancelada">Cancelada</option>
                      </select>
                      <button onClick={() => setSelectedOpening(op)}
                        style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.3rem 0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', background: 'var(--color-surface)', cursor: 'pointer', fontSize: '0.8rem' }}>
                        <Eye size={14} /> Detalhes
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal de Criação */}
      {showForm && (
        <VagaFormModal 
          onClose={() => setShowForm(false)} 
          onSuccess={() => { setShowForm(false); fetchData(); }} 
        />
      )}

      {/* Modal de Detalhes da Vaga */}
      {selectedOpening && createPortal(
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="fade-in" style={{ background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', padding: '2rem', maxWidth: '600px', width: '90%', border: '1px solid var(--color-border)', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
              <div>
                <h3 style={{ margin: '0 0 0.5rem', fontSize: '1.25rem', color: 'var(--color-text)' }}>
                  Detalhes da Solicitação
                </h3>
                {getStatusBadge(selectedOpening.status)}
              </div>
              <button onClick={() => setSelectedOpening(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)' }}>
                <X size={20} />
              </button>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', fontSize: '0.9rem' }}>
              <div>
                <strong style={{ display: 'block', color: 'var(--color-text-muted)', fontSize: '0.8rem', textTransform: 'uppercase' }}>Cargo / Perfil</strong>
                {selectedOpening.job_profiles?.title} (PC: {selectedOpening.job_profiles?.profile_code})
              </div>
              <div>
                <strong style={{ display: 'block', color: 'var(--color-text-muted)', fontSize: '0.8rem', textTransform: 'uppercase' }}>Departamento</strong>
                {selectedOpening.departments?.name}
              </div>
              <div>
                <strong style={{ display: 'block', color: 'var(--color-text-muted)', fontSize: '0.8rem', textTransform: 'uppercase' }}>Contrato</strong>
                {selectedOpening.contract_type}
              </div>
              <div>
                <strong style={{ display: 'block', color: 'var(--color-text-muted)', fontSize: '0.8rem', textTransform: 'uppercase' }}>Centro de Custo</strong>
                {selectedOpening.cost_center || '—'}
              </div>
              <div>
                <strong style={{ display: 'block', color: 'var(--color-text-muted)', fontSize: '0.8rem', textTransform: 'uppercase' }}>Justificativa</strong>
                {selectedOpening.justification}
              </div>
              <div>
                <strong style={{ display: 'block', color: 'var(--color-text-muted)', fontSize: '0.8rem', textTransform: 'uppercase' }}>Data Prevista</strong>
                {formatDate(selectedOpening.target_date)}
              </div>
              <div style={{ gridColumn: '1 / -1', background: 'var(--color-bg)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--color-border)', marginTop: '0.5rem' }}>
                <strong style={{ display: 'block', color: 'var(--color-text-muted)', fontSize: '0.8rem', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Observações da Solicitação</strong>
                <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{selectedOpening.observations || 'Nenhuma observação.'}</p>
              </div>
            </div>
            
            <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn-primary" onClick={() => setSelectedOpening(null)}>
                Fechar
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default Vagas;
