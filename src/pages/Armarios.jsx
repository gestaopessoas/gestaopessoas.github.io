import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';

const Armarios = () => {
  const [lockers, setLockers] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);

  // Form state for creating locker
  const [number, setNumber] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    // Fetch employees for dropdowns
    const { data: emps } = await supabase.from('employees').select('id, name').eq('status', 'Ativo').eq('unit', 'Sede').order('name');
    if (emps) setEmployees(emps);

    // Fetch lockers with employee relation
    const { data: lks } = await supabase
      .from('lockers')
      .select(`
        *,
        employees (name)
      `)
      .order('number');
    if (lks) setLockers(lks);
    
    setLoading(false);
  };

  const handleCreateLocker = async (e) => {
    e.preventDefault();
    if (!number) return;

    const { error } = await supabase.from('lockers').insert([{ number }]);

    if (!error) {
      setNumber('');
      setShowForm(false);
      fetchData();
    } else {
      alert("Erro ao criar armário: " + error.message);
    }
  };

  const handleAssignEmployee = async (lockerId, employeeId) => {
    await supabase.from('lockers').update({ employee_id: employeeId || null }).eq('id', lockerId);
    fetchData(); // refresh to show changes
  };

  return (
    <div className="glass-panel p-4 fade-in">
      <div className="flex-between">
        <h2>Controle de Armários</h2>
        <button className="btn-primary" onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Cancelar' : 'Adicionar Armário'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreateLocker} className="mt-4 p-4" style={{ backgroundColor: 'var(--color-bg)', borderRadius: 'var(--radius-md)' }}>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>Número/Identificação do Armário *</label>
            <input 
              type="text" 
              value={number} 
              onChange={(e) => setNumber(e.target.value)} 
              required
              style={{ width: '100%', maxWidth: '300px', padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--color-border)' }}
            />
          </div>
          <button type="submit" className="btn-primary">Salvar Armário</button>
        </form>
      )}

      <div className="mt-4" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        {loading ? (
          <p className="text-muted">Carregando...</p>
        ) : lockers.length === 0 ? (
          <p className="text-muted">Nenhum armário cadastrado no momento.</p>
        ) : (
          <>
            {['Vertical', 'Horizontal'].map(type => {
              const groupLockers = lockers.filter(lk => lk.number.startsWith(type));
              if (groupLockers.length === 0) return null;

              return (
                <div key={type} className="locker-group" style={{ backgroundColor: 'var(--color-surface)', padding: '1.5rem', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-sm)' }}>
                  <h3 style={{ margin: '0 0 1rem 0', color: 'var(--color-primary)', borderBottom: '2px solid var(--color-border)', paddingBottom: '0.5rem' }}>Armários {type === 'Vertical' ? 'Verticais' : 'Horizontais'}</h3>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ borderBottom: '2px solid var(--color-border)', color: 'var(--color-text-muted)' }}>
                        <th style={{ padding: '0.75rem 0', width: '20%' }}>Número</th>
                        <th style={{ padding: '0.75rem 0', width: '20%' }}>Status</th>
                        <th style={{ padding: '0.75rem 0', width: '60%' }}>Colaborador (Atribuição)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {groupLockers.map(lk => {
                        const isOccupied = !!lk.employee_id;
                        return (
                          <tr key={lk.id} style={{ borderBottom: '1px solid var(--color-border-light)' }}>
                            <td style={{ padding: '0.75rem 0', fontWeight: 600 }}>{lk.number}</td>
                            <td style={{ padding: '0.75rem 0' }}>
                              <span style={{ 
                                padding: '4px 8px', 
                                borderRadius: '12px', 
                                fontSize: '0.8rem',
                                fontWeight: 600,
                                backgroundColor: isOccupied ? 'rgba(239, 68, 68, 0.1)' : 'rgba(34, 197, 94, 0.1)',
                                color: isOccupied ? '#ef4444' : '#22c55e'
                              }}>
                                {isOccupied ? 'Ocupado' : 'Livre'}
                              </span>
                            </td>
                            <td style={{ padding: '0.75rem 0' }}>
                              <select 
                                value={lk.employee_id || ''}
                                onChange={(e) => handleAssignEmployee(lk.id, e.target.value)}
                                style={{ width: '100%', maxWidth: '250px', padding: '0.4rem', borderRadius: '4px', border: '1px solid var(--color-border)' }}
                              >
                                <option value="">-- Livre --</option>
                                {employees.map(emp => (
                                  <option key={emp.id} value={emp.id}>{emp.name}</option>
                                ))}
                              </select>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
};

export default Armarios;
