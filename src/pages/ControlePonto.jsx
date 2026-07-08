import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { Clock, Search } from 'lucide-react';

const ControlePonto = () => {
  const [logs, setLogs] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterDate, setFilterDate] = useState(new Date().toISOString().split('T')[0]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchEmployees();
  }, []);

  useEffect(() => {
    if (employees.length > 0) {
      fetchLogs();
    }
  }, [filterDate, employees]);

  const fetchEmployees = async () => {
    const { data } = await supabase.from('employees').select('id, name').eq('status', 'Ativo').order('name');
    if (data) setEmployees(data);
  };

  const fetchLogs = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('time_logs')
      .select('*')
      .eq('log_date', filterDate);
    
    // Merge com os funcionários ativos para mostrar todos, mesmo sem ponto batido
    const merged = employees.map(emp => {
      const log = data?.find(l => l.employee_id === emp.id);
      return {
        id: log?.id || `temp-${emp.id}`,
        employee_id: emp.id,
        name: emp.name,
        entry_1: log?.entry_1 || '',
        exit_1: log?.exit_1 || '',
        entry_2: log?.entry_2 || '',
        exit_2: log?.exit_2 || '',
        notes: log?.notes || '',
        isNew: !log?.id
      };
    });
    setLogs(merged);
    setLoading(false);
  };

  const handleTimeChange = async (employeeId, field, value, isNew, logId) => {
    // Atualiza otimisticamente a tela
    setLogs(prev => prev.map(l => l.employee_id === employeeId ? { ...l, [field]: value } : l));
    
    // Atualiza no banco
    if (isNew) {
      const { data, error } = await supabase.from('time_logs').insert([{
        employee_id: employeeId,
        log_date: filterDate,
        [field]: value || null
      }]).select();
      if (!error && data) {
        setLogs(prev => prev.map(l => l.employee_id === employeeId ? { ...l, id: data[0].id, isNew: false } : l));
      }
    } else {
      await supabase.from('time_logs').update({ [field]: value || null }).eq('id', logId);
    }
  };

  const filteredLogs = logs.filter(l => l.name.toLowerCase().includes(search.toLowerCase()));

  const inputStyle = { padding: '0.4rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-text)', fontSize: '0.85rem', width: '90px' };

  return (
    <div className="fade-in glass-panel p-4">
      <div className="flex-between" style={{ marginBottom: '1.5rem' }}>
        <div>
          <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Clock /> Controle de Ponto (Gerencial)</h2>
          <p style={{ margin: '0.2rem 0 0', fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
            Visualize e ajuste os horários de entrada e saída dos colaboradores.
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: '200px' }}>
          <Search size={15} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
          <input type="text" placeholder="Buscar colaborador..." value={search} onChange={e => setSearch(e.target.value)}
            style={{ width: '100%', padding: '0.6rem 0.75rem 0.6rem 2.25rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-text)' }} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-text-muted)' }}>DATA:</label>
          <input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)}
            style={{ padding: '0.6rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)', fontWeight: 600 }} />
        </div>
      </div>

      {loading ? <p className="text-muted">Carregando...</p> : (
        <div style={{ overflowX: 'auto', background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
            <thead style={{ background: 'var(--color-bg)' }}>
              <tr style={{ borderBottom: '2px solid var(--color-border)', color: 'var(--color-text-muted)', fontSize: '0.75rem', textTransform: 'uppercase' }}>
                <th style={{ padding: '1rem 0.75rem' }}>Colaborador</th>
                <th style={{ padding: '1rem 0.75rem' }}>Entrada 1</th>
                <th style={{ padding: '1rem 0.75rem' }}>Saída 1</th>
                <th style={{ padding: '1rem 0.75rem' }}>Entrada 2</th>
                <th style={{ padding: '1rem 0.75rem' }}>Saída 2</th>
                <th style={{ padding: '1rem 0.75rem', width: '200px' }}>Observações</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.map(log => (
                <tr key={log.id} style={{ borderBottom: '1px solid var(--color-border)', transition: 'background 0.15s' }}>
                  <td style={{ padding: '0.75rem', fontWeight: 600 }}>{log.name}</td>
                  <td style={{ padding: '0.75rem' }}>
                    <input type="time" value={log.entry_1} onChange={e => handleTimeChange(log.employee_id, 'entry_1', e.target.value, log.isNew, log.id)} style={inputStyle} />
                  </td>
                  <td style={{ padding: '0.75rem' }}>
                    <input type="time" value={log.exit_1} onChange={e => handleTimeChange(log.employee_id, 'exit_1', e.target.value, log.isNew, log.id)} style={inputStyle} />
                  </td>
                  <td style={{ padding: '0.75rem' }}>
                    <input type="time" value={log.entry_2} onChange={e => handleTimeChange(log.employee_id, 'entry_2', e.target.value, log.isNew, log.id)} style={inputStyle} />
                  </td>
                  <td style={{ padding: '0.75rem' }}>
                    <input type="time" value={log.exit_2} onChange={e => handleTimeChange(log.employee_id, 'exit_2', e.target.value, log.isNew, log.id)} style={inputStyle} />
                  </td>
                  <td style={{ padding: '0.75rem' }}>
                    <input type="text" value={log.notes} onChange={e => handleTimeChange(log.employee_id, 'notes', e.target.value, log.isNew, log.id)} placeholder="Nota..." style={{ ...inputStyle, width: '100%' }} />
                  </td>
                </tr>
              ))}
              {filteredLogs.length === 0 && (
                <tr>
                  <td colSpan="6" style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                    Nenhum colaborador encontrado para a busca.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default ControlePonto;
