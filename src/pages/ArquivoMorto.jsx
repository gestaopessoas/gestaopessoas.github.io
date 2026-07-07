import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { Search, Archive, Box } from 'lucide-react';

const ArquivoMorto = () => {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 50;

  useEffect(() => { fetchData(); }, [page]);

  const fetchData = async () => {
    setLoading(true);

    const { count } = await supabase
      .from('employees')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'Arquivo Morto');
    setTotal(count || 0);

    const { data } = await supabase
      .from('employees')
      .select('id, name, admission_date, dismissed_at, role')
      .eq('status', 'Arquivo Morto')
      .order('name')
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

    if (data) setRecords(data);
    setLoading(false);
  };

  const handleSearch = async () => {
    if (!search.trim()) { setPage(0); fetchData(); return; }
    setLoading(true);
    const { data } = await supabase
      .from('employees')
      .select('id, name, admission_date, dismissed_at, role')
      .eq('status', 'Arquivo Morto')
      .ilike('name', `%${search}%`)
      .order('name')
      .limit(100);
    if (data) setRecords(data);
    setLoading(false);
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
            Registro histórico de {total.toLocaleString('pt-BR')} ex-colaboradores
          </p>
        </div>
      </div>

      {/* Aviso informativo */}
      <div style={{ background: 'rgba(114,115,118,0.08)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '0.85rem 1rem', marginBottom: '1.25rem', fontSize: '0.85rem', color: 'var(--color-text-muted)', display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
        <Box size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
        <span>Este é o arquivo histórico importado do sistema legado (RH_ACPO). Os registros são somente para consulta. O controle físico das caixas de arquivo está disponível no módulo <strong>Caixas de Arquivo</strong>.</span>
      </div>

      {/* Busca */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem' }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <Search size={15} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
          <input
            type="text"
            placeholder="Buscar por nome..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
            style={{ width: '100%', padding: '0.6rem 1rem 0.6rem 2.25rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-text)', boxSizing: 'border-box' }}
          />
        </div>
        <button onClick={handleSearch} className="btn-primary">Buscar</button>
        {search && <button onClick={() => { setSearch(''); setPage(0); fetchData(); }} style={{ padding: '0.6rem 1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', background: 'none', cursor: 'pointer', color: '#ef4444' }}>Limpar</button>}
      </div>

      {/* Tabela */}
      {loading ? <p className="text-muted">Carregando...</p> : (
        <>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--color-border)', color: 'var(--color-text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  <th style={{ padding: '0.75rem 0.5rem', textAlign: 'left' }}>Nome</th>
                  <th style={{ padding: '0.75rem 0.5rem', textAlign: 'left' }}>Função</th>
                  <th style={{ padding: '0.75rem 0.5rem', textAlign: 'left' }}>Admissão</th>
                  <th style={{ padding: '0.75rem 0.5rem', textAlign: 'left' }}>Demissão</th>
                </tr>
              </thead>
              <tbody>
                {records.map(rec => (
                  <tr key={rec.id} style={{ borderBottom: '1px solid var(--color-border)' }}
                    onMouseOver={e => e.currentTarget.style.background = 'var(--color-bg)'}
                    onMouseOut={e => e.currentTarget.style.background = 'transparent'}>
                    <td style={{ padding: '0.65rem 0.5rem', fontWeight: 500 }}>{rec.name}</td>
                    <td style={{ padding: '0.65rem 0.5rem', color: 'var(--color-text-muted)' }}>{rec.role || '—'}</td>
                    <td style={{ padding: '0.65rem 0.5rem', color: 'var(--color-text-muted)' }}>{formatDate(rec.admission_date)}</td>
                    <td style={{ padding: '0.65rem 0.5rem', color: rec.dismissed_at ? '#ef4444' : 'var(--color-text-muted)' }}>{formatDate(rec.dismissed_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Paginação */}
          {!search && totalPages > 1 && (
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
