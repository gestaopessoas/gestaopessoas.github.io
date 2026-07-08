import React, { useState } from 'react';
import { DollarSign, Upload, TrendingUp, AlertCircle } from 'lucide-react';

const Custos = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);

  return (
    <div className="glass-panel p-4 fade-in">
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
        <div style={{ background: 'rgba(34, 197, 94, 0.15)', borderRadius: '50%', padding: '0.75rem', display: 'flex' }}>
          <DollarSign size={24} color="#22c55e" />
        </div>
        <div style={{ flex: 1 }}>
          <h2 style={{ margin: 0 }}>Custos Gerais (RH)</h2>
          <p style={{ margin: '0.2rem 0 0', fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
            Visão consolidada de despesas e custos com pessoal
          </p>
        </div>
        <button className="btn-primary" onClick={() => alert('Por favor, remova a senha do arquivo Excel na pasta Downloads para que possamos construir o importador definitivo.')}>
          <Upload size={16} style={{ marginRight: '0.5rem' }} /> Importar Planilha de Custos
        </button>
      </div>

      <div style={{ background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.3)', borderRadius: 'var(--radius-md)', padding: '1rem', marginBottom: '1.5rem', display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
        <AlertCircle size={20} color="#f59e0b" style={{ flexShrink: 0 }} />
        <span style={{ color: '#d97706', fontSize: '0.9rem' }}>
          <strong>Aguardando dados:</strong> O sistema está pronto para receber a tabela financeira, mas a planilha "Custos Geral" atual possui senha. Remova a senha do arquivo Excel original para prosseguirmos com a leitura automática.
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <div style={{ background: 'var(--color-surface)', padding: '1.5rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem', fontWeight: 600, textTransform: 'uppercase' }}>Custo Total Estimado</div>
          <div style={{ fontSize: '1.8rem', fontWeight: 700, margin: '0.5rem 0', color: 'var(--color-text)' }}>R$ 0,00</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: '#22c55e', fontSize: '0.85rem', fontWeight: 600 }}>
             <TrendingUp size={14} /> Aguardando importação
          </div>
        </div>
        <div style={{ background: 'var(--color-surface)', padding: '1.5rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem', fontWeight: 600, textTransform: 'uppercase' }}>Total de Rubricas</div>
          <div style={{ fontSize: '1.8rem', fontWeight: 700, margin: '0.5rem 0', color: 'var(--color-text)' }}>--</div>
        </div>
        <div style={{ background: 'var(--color-surface)', padding: '1.5rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem', fontWeight: 600, textTransform: 'uppercase' }}>Última Atualização</div>
          <div style={{ fontSize: '1.8rem', fontWeight: 700, margin: '0.5rem 0', color: 'var(--color-text)' }}>Nenhuma</div>
        </div>
      </div>

      <div style={{ background: 'var(--color-surface)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', padding: '2rem', textAlign: 'center' }}>
        <DollarSign size={48} color="var(--color-text-muted)" style={{ opacity: 0.2, marginBottom: '1rem' }} />
        <h3 style={{ color: 'var(--color-text-muted)' }}>Nenhum dado financeiro importado</h3>
        <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem', maxWidth: '400px', margin: '0.5rem auto' }}>
          Assim que a planilha for desbloqueada e lida, este espaço será transformado em uma tabela detalhada com quebra de custos por centro de custo e função.
        </p>
      </div>
    </div>
  );
};

export default Custos;
