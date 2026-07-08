import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { Search, Archive, Box, Filter, Save } from 'lucide-react';

const ArquivoMorto = () => {
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

  useEffect(() => {
    fetchUniqueRoles();
  }, []);

  useEffect(() => { 
    fetchData(); 
  }, [page]);

  const fetchUniqueRoles = async () => {
    // Busca cargos únicos dos demitidos para o dropdown (gambiarra rápida com limit grande)
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

  const buildQuery = (queryObj) => {
    let q = queryObj.eq('status', 'Arquivo Morto');
    if (search.trim()) q = q.ilike('name', `%${search}%`);
    if (boxFilter.trim()) q = q.ilike('archive_box', `%${boxFilter}%`);
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

    let dataQuery = supabase.from('employees').select('id, name, admission_date, dismissed_at, role, archive_box');
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
    setBoxFilter('');
    setRoleFilter('');
    setStartDate('');
    setEndDate('');
    setPage(0);
    // fetchData será chamado pelo useEffect quando a pagina for pra 0 (mas se já for 0, forçamos o fetch)
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
            Gerenciamento físico e digital de {total.toLocaleString('pt-BR')} ex-colaboradores
          </p>
        </div>
      </div>

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
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', marginBottom: '0.3rem', color: 'var(--color-text-muted)' }}>Caixa</label>
            <input type="text" placeholder="Ex: CX-05" value={boxFilter} onChange={e => setBoxFilter(e.target.value)}
              style={{ width: '100%', padding: '0.5rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-text)' }} />
          </div>
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
                  <th style={{ padding: '1rem 0.75rem', textAlign: 'left' }}>Caixa</th>
                </tr>
              </thead>
              <tbody>
                {records.length === 0 ? (
                  <tr>
                    <td colSpan="5" style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>
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
    </div>
  );
};

export default ArquivoMorto;
