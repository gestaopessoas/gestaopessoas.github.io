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

  const fetchData = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    // Fetch employees for dropdown (somente Ativos da Sede)
    const { data: emps } = await supabase.from('employees')
      .select('id, name')
      .eq('status', 'Ativo')
      .eq('unit', 'Sede')
      .order('name');
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
    
    if (showLoading) setLoading(false);
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!name) return;

    const { error } = await supabase.from('islands').insert([{ name, sector: sector || 'Outros' }]);

    if (!error) {
      setName('');
      setSector('');
      setShowForm(false);
      fetchData(false);
    } else {
      alert("Erro ao criar ilha/setor: " + error.message);
    }
  };

  const handleDelete = async (id) => {
    if(window.confirm('Excluir este local?')) {
      await supabase.from('islands').delete().eq('id', id);
      fetchData(false);
    }
  };

  const handleAssignEmployee = async (islandId, employeeId) => {
    await supabase.from('islands').update({ employee_id: employeeId || null }).eq('id', islandId);
    fetchData(false); 
  };

  return (
    <div className="glass-panel p-4 fade-in">
      <div className="flex-between">
        <h2>Mapeamento de Ilhas / Setores / Mesas</h2>
      </div>

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
                  overflowX: 'auto',
                  paddingBottom: '1rem'
                }}>
                  <div style={{ 
                    display: 'grid', 
                    gridTemplateColumns: `repeat(${desks.length <= 2 ? desks.length : Math.ceil(desks.length / 2)}, 220px)`, 
                    gap: '2px', // Pequeno gap entre as mesas
                    width: 'max-content',
                    margin: '0 auto', // Centralizar o bloco no espaço
                    backgroundColor: 'rgba(0,0,0,0.02)',
                    padding: '2rem',
                    borderRadius: '1rem'
                  }}>
                    {desks.map((isl, index) => {
                      const cols = desks.length <= 2 ? desks.length : Math.ceil(desks.length / 2);
                      const isTopRow = index < cols;
                      const isOccupied = !!isl.employee_id;

                      if (isl.name === 'ESPAÇO VAZIO') {
                        return <div key={isl.id} style={{ visibility: 'hidden', minHeight: '185px' }}></div>;
                      }

                      return (
                        <div key={isl.id} style={{ 
                          display: 'flex', 
                          flexDirection: isTopRow ? 'column' : 'column-reverse',
                          alignItems: 'center'
                        }}>
                          {/* Ícone de Cadeira */}
                          <div style={{ 
                            width: '45px', height: '45px', 
                            backgroundColor: isOccupied ? '#94a3b8' : '#e2e8f0', 
                            borderRadius: isTopRow ? '50% 50% 40% 40%' : '40% 40% 50% 50%', 
                            border: '3px solid #cbd5e1',
                            boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                            marginBottom: isTopRow ? '-15px' : '0',
                            marginTop: !isTopRow ? '-15px' : '0',
                            zIndex: 10,
                            position: 'relative'
                          }}></div>

                          {/* Mesa (Madeira) */}
                          <div style={{
                            width: '100%',
                            minHeight: '140px',
                            backgroundColor: '#deab82', // Cor de madeira
                            backgroundImage: 'linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px)',
                            backgroundSize: '20px 20px',
                            border: '1px solid #b57a4a',
                            padding: '1rem',
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'center',
                            boxShadow: 'inset 0 0 15px rgba(139, 69, 19, 0.1)'
                          }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                              <span style={{ 
                                fontWeight: 'bold', 
                                fontSize: '0.85rem', 
                                backgroundColor: 'rgba(255,255,255,0.8)',
                                padding: '2px 8px',
                                borderRadius: '12px',
                                color: '#333'
                              }}>{isl.name.split(' (')[0]}</span>
                            </div>

                            <select 
                              value={isl.employee_id || ''}
                              onChange={(e) => handleAssignEmployee(isl.id, e.target.value)}
                              style={{ 
                                width: '100%', 
                                padding: '0.4rem', 
                                borderRadius: '4px', 
                                border: '1px solid #b57a4a', 
                                fontSize: '0.85rem',
                                backgroundColor: 'rgba(255,255,255,0.95)',
                                fontWeight: 600,
                                color: isOccupied ? '#15803d' : '#64748b',
                                cursor: 'pointer',
                                textAlign: 'center'
                              }}
                            >
                              <option value="">-- Mesa Vazia --</option>
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
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Ilhas;
