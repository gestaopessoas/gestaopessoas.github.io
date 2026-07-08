import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { Trash2 } from 'lucide-react';

const Ilhas = () => {
  const [islands, setIslands] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);

  // Form state
  const [name, setName] = useState('');
  const [sector, setSector] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    // Fetch employees for dropdown
    const { data: emps } = await supabase.from('employees').select('id, name').order('name');
    if (emps) setEmployees(emps);

    // Fetch islands with employee relation
    const { data: isls } = await supabase
      .from('islands')
      .select(`
        *,
        employees (name)
      `)
      .order('sector', { ascending: true, nullsFirst: false })
      .order('position_index', { ascending: true, nullsFirst: false });
    if (isls) setIslands(isls);
    
    setLoading(false);
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!name) return;

    const { error } = await supabase.from('islands').insert([{ name, sector: sector || 'Outros' }]);

    if (!error) {
      setName('');
      setSector('');
      setShowForm(false);
      fetchData();
    } else {
      alert("Erro ao criar ilha/setor: " + error.message);
    }
  };

  const handleDelete = async (id) => {
    if(window.confirm('Excluir este local?')) {
      await supabase.from('islands').delete().eq('id', id);
      fetchData();
    }
  };

  const handleAssignEmployee = async (islandId, employeeId) => {
    await supabase.from('islands').update({ employee_id: employeeId || null }).eq('id', islandId);
    fetchData(); 
  };

  return (
    <div className="glass-panel p-4 fade-in">
      <div className="flex-between">
        <h2>Mapeamento de Ilhas / Setores / Mesas</h2>
        <button className="btn-primary" onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Cancelar' : 'Adicionar Local'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="mt-4 p-4" style={{ backgroundColor: 'var(--color-bg)', borderRadius: 'var(--radius-md)' }}>
          <div style={{ marginBottom: '1rem', display: 'flex', gap: '1rem' }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>Nome da Mesa / Ilha *</label>
              <input 
                type="text" 
                value={name} 
                onChange={(e) => setName(e.target.value)} 
                placeholder="Ex: Mesa 01, Ilha de Atendimento..."
                required
                style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--color-border)' }}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>Setor</label>
              <input 
                type="text" 
                value={sector} 
                onChange={(e) => setSector(e.target.value)} 
                placeholder="Ex: Financeiro, TI..."
                style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--color-border)' }}
              />
            </div>
          </div>
          <button type="submit" className="btn-primary">Salvar Local</button>
        </form>
      )}

      <div className="mt-4">
        {loading ? (
          <p className="text-muted">Carregando...</p>
        ) : islands.length === 0 ? (
          <p className="text-muted">Nenhum local mapeado no momento.</p>
        ) : (
          <div>
            {Object.entries(
              islands.reduce((acc, isl) => {
                const s = isl.sector || 'Outros';
                if (!acc[s]) acc[s] = [];
                acc[s].push(isl);
                return acc;
              }, {})
            ).map(([sectorName, desks]) => (
              <div key={sectorName} style={{ marginBottom: '3rem' }}>
                <h3 style={{ 
                  borderBottom: '2px solid var(--color-border)', 
                  paddingBottom: '0.5rem', 
                  marginBottom: '1.5rem',
                  color: 'var(--color-primary)'
                }}>{sectorName}</h3>
                
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: `repeat(${desks.length <= 2 ? desks.length : Math.ceil(desks.length / 2)}, minmax(200px, 1fr))`, 
                  gap: '1.5rem' 
                }}>
                  {desks.map(isl => {
                    const isOccupied = !!isl.employee_id;
                    return (
                      <div key={isl.id} style={{ 
                        backgroundColor: 'var(--color-surface)',
                        border: '1px solid var(--color-border)',
                        borderRadius: 'var(--radius-md)',
                        padding: '1.25rem',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.75rem',
                        boxShadow: 'var(--shadow-sm)'
                      }}>
                        <div className="flex-between">
                          <h3 style={{ margin: 0, fontSize: '1.1rem' }}>{isl.name}</h3>
                          <button onClick={() => handleDelete(isl.id)} style={{ color: 'var(--color-text-muted)' }}><Trash2 size={16}/></button>
                        </div>
                        
                        <div>
                          <span style={{ 
                            padding: '2px 8px', 
                            borderRadius: '12px', 
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            backgroundColor: isOccupied ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                            color: isOccupied ? '#22c55e' : '#ef4444'
                          }}>
                            {isOccupied ? 'Ocupado' : 'Disponível'}
                          </span>
                        </div>

                        <div style={{ marginTop: '0.5rem' }}>
                          <label style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>Alocado para:</label>
                          <select 
                            value={isl.employee_id || ''}
                            onChange={(e) => handleAssignEmployee(isl.id, e.target.value)}
                            style={{ width: '100%', marginTop: '0.25rem', padding: '0.4rem', borderRadius: '4px', border: '1px solid var(--color-border)', fontSize: '0.9rem' }}
                          >
                            <option value="">-- Ninguém --</option>
                            {employees.map(emp => (
                              <option key={emp.id} value={emp.id}>{emp.name}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Ilhas;
