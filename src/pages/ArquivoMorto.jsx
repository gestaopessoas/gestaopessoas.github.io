import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { Search, Archive, Box, Filter, Save, Eye } from 'lucide-react';
import EmployeeProfileModal from '../components/EmployeeProfileModal';

const ArquivoMorto = () => {
  const [viewMode, setViewMode] = useState('boxes'); // 'boxes', 'list', 'boxDetail'
  const [boxStats, setBoxStats] = useState([]);
  const [selectedBox, setSelectedBox] = useState(null);

  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Filtros
  const [search, setSearch] = useState('');
  const [boxFilter, setBoxFilter] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  
  const [uniqueRoles, setUniqueRoles] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 50;

  // Edição em lote
  const [editingBox, setEditingBox] = useState(null);
  const [editBoxValue, setEditBoxValue] = useState('');

  // Perfil Modal
  const [selectedEmployee, setSelectedEmployee] = useState(null);

  useEffect(() => {
    fetchUniqueRoles();
  }, []);

  useEffect(() => { 
    if (viewMode === 'list' || viewMode === 'boxDetail') {
      fetchData(); 
    }
  }, [page, viewMode, selectedBox]);

  useEffect(() => {
    if (viewMode === 'boxes') {
      fetchBoxes();
    }
  }, [viewMode]);

  const fetchUniqueRoles = async () => {
    // Busca cargos únicos dos demitidos para o dropdown
    const { data } = await supabase
      .from('employees')
      .select('role')
      .eq('status', 'Arquivo Morto')
      .not('role', 'is', null)
      .limit(3000);
      
    if (data) {
      const roles = [...new Set(data.map(d => d.role))].sort();
      setUniqueRoles(roles);
    }
  };

  const fetchBoxes = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('employees')
      .select('archive_box')
      .eq('status', 'Arquivo Morto')
      .limit(10000);
      
    if (data) {
      const counts = data.reduce((acc, curr) => {
        const box = curr.archive_box ? curr.archive_box.trim() : 'Sem Caixa';
        const key = box === '' ? 'Sem Caixa' : box;
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {});
      
      const stats = Object.keys(counts).map(k => ({ name: k, count: counts[k] }));
      stats.sort((a, b) => {
        if (a.name === 'Sem Caixa') return 1;
        if (b.name === 'Sem Caixa') return -1;
        return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
      });
      setBoxStats(stats);
    }
    setLoading(false);
  };

  const buildQuery = (queryObj) => {
    let q = queryObj.eq('status', 'Arquivo Morto');
    
    if (viewMode === 'boxDetail' && selectedBox) {
      if (selectedBox === 'Sem Caixa') {
        // Syntax robusta para PostgREST (null ou string vazia)
        q = q.or('archive_box.is.null,archive_box.eq.,archive_box.eq.""');
      } else {
        q = q.eq('archive_box', selectedBox);
      }
    } else if (viewMode === 'list') {
      if (boxFilter.trim()) q = q.ilike('archive_box', `%${boxFilter}%`);
    }

    if (search.trim()) q = q.ilike('name', `%${search}%`);
    if (roleFilter) q = q.eq('role', roleFilter);
    if (startDate) q = q.gte('dismissed_at', startDate);
    if (endDate) q = q.lte('dismissed_at', endDate);
    return q;
  };

  const fetchData = async () => {
    setLoading(true);

    let countQuery = supabase.from('employees').select('*', { count: 'exact', head: true });
    countQuery = buildQuery(countQuery);
    const { count } = await countQuery;
    setTotal(count || 0);

    let dataQuery = supabase.from('employees').select('*, departments(name)');
    dataQuery = buildQuery(dataQuery)
      .order('dismissed_at', { ascending: false })
      .order('name')
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

    const { data } = await dataQuery;
    if (data) setRecords(data);
    
    setLoading(false);
  };

  const handleApplyFilters = () => {
    setPage(0);
    fetchData();
  };

  const handleClearFilters = () => {
    setSearch('');
    if (viewMode === 'list') setBoxFilter('');
    setRoleFilter('');
    setStartDate('');
    setEndDate('');
    setPage(0);
    setTimeout(() => fetchData(), 50);
  };

  const handleSaveBox = async (id) => {
    await supabase.from('employees').update({ archive_box: editBoxValue }).eq('id', id);
    setRecords(records.map(r => r.id === id ? { ...r, archive_box: editBoxValue } : r));
    setEditingBox(null);
  };

  const formatDate = (d) => {
    if (!d) return '—';
    const p = d.split('-');
    return `${p[2]}/${p[1]}/${p[0]}`;
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  const renderBoxes = () => {
    if (loading) return <p className="text-muted">Carregando caixas...</p>;
    if (boxStats.length === 0) return <p className="text-muted">Nenhuma caixa encontrada.</p>;

    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '1rem' }}>
        {boxStats.map(b => (
          <div 
            key={b.name} 
            onClick={() => { setSelectedBox(b.name); setViewMode('boxDetail'); setPage(0); }}
            style={{ 
              background: 'var(--color-surface)', 
              border: '1px solid var(--color-border)', 
              borderRadius: 'var(--radius-lg)', 
              padding: '1.5rem', 
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '0.75rem',
              transition: 'all 0.2s',
              boxShadow: 'var(--shadow-sm)'
            }}
            onMouseOver={e => e.currentTarget.style.borderColor = 'var(--color-primary)'}
            onMouseOut={e => e.currentTarget.style.borderColor = 'var(--color-border)'}
          >
            <div style={{ background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', padding: '1rem', borderRadius: '50%', display: 'flex' }}>
              <Box size={32} />
            </div>
            <h3 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--color-text)', textAlign: 'center' }}>{b.name}</h3>
            <span style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', background: 'var(--color-bg)', padding: '0.3rem 0.75rem', borderRadius: '999px', border: '1px solid var(--color-border)', fontWeight: 500 }}>
              {b.count} {b.count === 1 ? 'registro' : 'registros'}
            </span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="glass-panel p-4 fade-in">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
        <div style={{ background: 'rgba(114,115,118,0.15)', borderRadius: '50%', padding: '0.75rem', display: 'flex' }}>
          <Archive size={24} color="var(--color-text-muted)" />
        </div>
        <div>
          <h2 style={{ margin: 0 }}>Arquivo Morto</h2>
          <p style={{ margin: '0.2rem 0 0', fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
            Gerenciamento físico e digital de ex-colaboradores
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', borderBottom: '2px solid var(--color-border)' }}>
        {[
          { key: 'boxes', label: 'Por Caixa', color: '#3b82f6' },
          { key: 'list', label: 'Lista Geral', color: '#10b981' }
        ].map(tab => {
          const isActive = viewMode === tab.key || (tab.key === 'boxes' && viewMode === 'boxDetail');
          return (
            <button key={tab.key} onClick={() => { setViewMode(tab.key); if(tab.key==='boxes') setSelectedBox(null); setPage(0); }}
              style={{
                padding: '0.6rem 1.5rem', border: 'none', background: 'none', cursor: 'pointer',
                fontWeight: isActive ? 700 : 500,
                color: isActive ? tab.color : 'var(--color-text-muted)',
                borderBottom: isActive ? `2px solid ${tab.color}` : '2px solid transparent',
                marginBottom: '-2px', fontSize: '0.9rem', transition: 'all 0.2s',
                display: 'flex', alignItems: 'center', gap: '0.5rem'
              }}>
              {tab.label}
            </button>
          )
        })}
      </div>

      {viewMode === 'boxes' ? renderBoxes() : (
        <>
          {viewMode === 'boxDetail' && (
            <div style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <button onClick={() => { setViewMode('boxes'); setSelectedBox(null); }} style={{ padding: '0.5rem 1rem', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--color-text)', fontWeight: 500 }}>
                ← Voltar para Caixas
              </button>
              <h3 style={{ margin: 0, color: 'var(--color-text)' }}>Caixa: {selectedBox}</h3>
            </div>
          )}

          {/* Filtros */}
          <div style={{ background: 'var(--color-surface)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', fontWeight: 600, color: 'var(--color-text-muted)' }}>
              <Filter size={16} /> Filtros Avançados
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', marginBottom: '0.3rem', color: 'var(--color-text-muted)' }}>Nome</label>
                <input type="text" placeholder="Buscar por nome..." value={search} onChange={e => setSearch(e.target.value)}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-text)' }} />
              </div>
              {viewMode === 'list' && (
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', marginBottom: '0.3rem', color: 'var(--color-text-muted)' }}>Caixa</label>
                  <input type="text" placeholder="Ex: CX-05" value={boxFilter} onChange={e => setBoxFilter(e.target.value)}
                    style={{ width: '100%', padding: '0.5rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-text)' }} />
                </div>
              )}
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', marginBottom: '0.3rem', color: 'var(--color-text-muted)' }}>Cargo</label>
                <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-text)' }}>
                  <option value="">Todos os cargos</option>
                  {uniqueRoles.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', marginBottom: '0.3rem', color: 'var(--color-text-muted)' }}>Demissão (Início)</label>
                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-text)' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', marginBottom: '0.3rem', color: 'var(--color-text-muted)' }}>Demissão (Fim)</label>
                <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-text)' }} />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button onClick={handleClearFilters} className="btn-secondary" style={{ padding: '0.5rem 1rem' }}>Limpar Filtros</button>
              <button onClick={handleApplyFilters} className="btn-primary" style={{ padding: '0.5rem 1.5rem' }}>Aplicar Filtros</button>
            </div>
          </div>

          {/* Tabela */}
          {loading ? <p className="text-muted">Carregando registros...</p> : (
            <>
              <div style={{ overflowX: 'auto', background: 'var(--color-surface)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid var(--color-border)', color: 'var(--color-text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', background: 'rgba(0,0,0,0.02)' }}>
                      <th style={{ padding: '1rem 0.75rem', textAlign: 'left' }}>Nome</th>
                      <th style={{ padding: '1rem 0.75rem', textAlign: 'left' }}>Função</th>
                      <th style={{ padding: '1rem 0.75rem', textAlign: 'left' }}>Admissão</th>
                      <th style={{ padding: '1rem 0.75rem', textAlign: 'left' }}>Demissão</th>
                      <th style={{ padding: '1rem 0.75rem', textAlign: 'left' }}>Observação</th>
                      <th style={{ padding: '1rem 0.75rem', textAlign: 'left' }}>Caixa</th>
                      <th style={{ padding: '1rem 0.75rem', textAlign: 'right' }}>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {records.length === 0 ? (
                      <tr>
                        <td colSpan="7" style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                          Nenhum registro encontrado com os filtros atuais.
                        </td>
                      </tr>
                    ) : records.map(rec => (
                      <tr key={rec.id} style={{ borderBottom: '1px solid var(--color-border)' }}
                        onMouseOver={e => e.currentTarget.style.background = 'var(--color-bg)'}
                        onMouseOut={e => e.currentTarget.style.background = 'transparent'}>
                        <td style={{ padding: '0.75rem', fontWeight: 500 }}>{rec.name}</td>
                        <td style={{ padding: '0.75rem', color: 'var(--color-text-muted)' }}>{rec.role || '—'}</td>
                        <td style={{ padding: '0.75rem', color: 'var(--color-text-muted)' }}>{formatDate(rec.admission_date)}</td>
                        <td style={{ padding: '0.75rem', color: '#ef4444' }}>{formatDate(rec.dismissed_at)}</td>
                        <td style={{ padding: '0.75rem', fontSize: '0.8rem', color: 'var(--color-text-muted)', fontStyle: 'italic', maxWidth: '200px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={rec.observation || ''}>{rec.observation || '—'}</td>
                        <td style={{ padding: '0.75rem' }}>
                          {editingBox === rec.id ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <input 
                                autoFocus
                                type="text" 
                                value={editBoxValue} 
                                onChange={e => setEditBoxValue(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleSaveBox(rec.id)}
                                style={{ width: '80px', padding: '0.3rem', borderRadius: '4px', border: '1px solid var(--color-border)' }}
                              />
                              <button onClick={() => handleSaveBox(rec.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#22c55e' }}>
                                <Save size={16} />
                              </button>
                            </div>
                          ) : (
                            <div 
                              onClick={() => { setEditingBox(rec.id); setEditBoxValue(rec.archive_box || ''); }}
                              style={{ cursor: 'pointer', padding: '4px 8px', background: rec.archive_box ? 'rgba(59, 130, 246, 0.1)' : 'rgba(0,0,0,0.05)', color: rec.archive_box ? '#3b82f6' : 'var(--color-text-muted)', borderRadius: '4px', display: 'inline-block', fontWeight: 500 }}
                              title="Clique para editar"
                            >
                              {rec.archive_box || 'Definir...'}
                            </div>
                          )}
                        </td>
                        <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                          <button onClick={() => setSelectedEmployee(rec)}
                            style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.3rem 0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-primary)', background: 'rgba(245,174,56,0.08)', color: 'var(--color-primary)', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600, marginLeft: 'auto' }}>
                            <Eye size={14} /> Ver Perfil
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Paginação */}
              {totalPages > 1 && (
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginTop: '1rem', justifyContent: 'center' }}>
                  <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
                    style={{ padding: '0.4rem 0.9rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', background: 'none', cursor: page === 0 ? 'not-allowed' : 'pointer', opacity: page === 0 ? 0.4 : 1 }}>
                    ← Anterior
                  </button>
                  <span style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
                    Página {page + 1} de {totalPages} · {total.toLocaleString('pt-BR')} registros
                  </span>
                  <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
                    style={{ padding: '0.4rem 0.9rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', background: 'none', cursor: page >= totalPages - 1 ? 'not-allowed' : 'pointer', opacity: page >= totalPages - 1 ? 0.4 : 1 }}>
                    Próxima →
                  </button>
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* Modal de Perfil Completo */}
      <EmployeeProfileModal 
        employee={selectedEmployee} 
        onClose={() => setSelectedEmployee(null)} 
      />
    </div>
  );
};

export default ArquivoMorto;
