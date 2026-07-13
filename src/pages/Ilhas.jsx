import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { Trash2, Plus, Monitor, Users, Map } from 'lucide-react';
import './Ilhas.css';

const Ilhas = () => {
  const [islands, setIslands] = useState([]);
  const [activeEmployees, setActiveEmployees] = useState([]);
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
    
    // Filtro estrito: apenas ATIVOS e da SEDE
    const { data: emps } = await supabase.from('employees')
      .select('id, name')
      .eq('status', 'Ativo')
      .eq('unit', 'Sede')
      .order('name');
    if (emps) setActiveEmployees(emps);

    // Fetch islands
    const { data: isls } = await supabase
      .from('islands')
      .select(`
        *,
        employees (name, status, unit)
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
    if(window.confirm('Tem certeza que deseja excluir esta mesa do mapeamento?')) {
      await supabase.from('islands').delete().eq('id', id);
      fetchData(false);
    }
  };

  const handleAssignEmployee = async (islandId, employeeId) => {
    await supabase.from('islands').update({ employee_id: employeeId || null }).eq('id', islandId);
    fetchData(false); 
  };

  return (
    <div className="ilhas-container fade-in">
      <header className="ilhas-header">
        <div>
          <h1 className="ilhas-title">Ilhas e Setores</h1>
          <p className="text-muted">Mapeamento de mesas e alocação de colaboradores da Sede.</p>
        </div>
        <button className="btn btn-primary btn-icon" onClick={() => setShowForm(!showForm)}>
          <Plus size={18} /> {showForm ? 'Cancelar' : 'Adicionar Mesa'}
        </button>
      </header>

      {showForm && (
        <div className="glass-panel form-panel fade-in">
          <h3>Nova Mesa/Posição</h3>
          <form onSubmit={handleCreate} className="ilhas-form">
            <div className="form-group">
              <label>Nome da Mesa (ex: Mesa 01)</label>
              <input 
                type="text" 
                value={name} 
                onChange={e => setName(e.target.value)} 
                required 
                placeholder="Ex: Mesa 01"
              />
            </div>
            <div className="form-group">
              <label>Setor/Ilha</label>
              <input 
                type="text" 
                value={sector} 
                onChange={e => setSector(e.target.value)} 
                placeholder="Ex: Engenharia"
              />
            </div>
            <button type="submit" className="btn btn-success">Salvar</button>
          </form>
        </div>
      )}

      <div className="ilhas-content mt-4">
        {loading ? (
          <div className="loading-state">
            <div className="spinner"></div>
            <p>Carregando mapa de ilhas...</p>
          </div>
        ) : islands.length === 0 ? (
          <div className="empty-state glass-panel">
            <Map size={48} className="text-muted mb-2" />
            <p className="text-muted">Nenhuma mesa ou ilha mapeada no momento.</p>
            <button className="btn btn-outline mt-2" onClick={() => setShowForm(true)}>Criar Primeira Mesa</button>
          </div>
        ) : (
          <div className="sectors-wrapper">
            {Object.entries(
              islands.reduce((acc, isl) => {
                const s = isl.sector || 'Outros';
                if (!acc[s]) acc[s] = [];
                acc[s].push(isl);
                return acc;
              }, {})
            ).map(([sectorName, desks]) => (
              <div key={sectorName} className="sector-block glass-panel fade-in delay-1">
                <div className="sector-header">
                  <h3 className="sector-title">
                    <Users size={20} className="sector-icon" />
                    {sectorName}
                  </h3>
                  <span className="sector-badge">{desks.filter(d => d.employee_id).length} / {desks.length} ocupadas</span>
                </div>
                
                <div className="desks-scroll-area">
                  <div className="desks-grid" style={{
                    gridTemplateColumns: `repeat(${desks.length <= 2 ? desks.length : Math.ceil(desks.length / 2)}, minmax(240px, 1fr))`
                  }}>
                    {desks.map((isl, index) => {
                      const cols = desks.length <= 2 ? desks.length : Math.ceil(desks.length / 2);
                      const isTopRow = index < cols;
                      const isOccupied = !!isl.employee_id;
                      
                      // Check se o funcionário na mesa ainda é valido.
                      const isInvalidEmployee = isOccupied && (!isl.employees || isl.employees.status !== 'Ativo' || isl.employees.unit !== 'Sede');

                      if (isl.name === 'ESPAÇO VAZIO') {
                        return <div key={isl.id} className="desk-empty-space"></div>;
                      }

                      return (
                        <div key={isl.id} className={`desk-wrapper ${isTopRow ? 'top-row' : 'bottom-row'}`}>
                          
                          {/* Ícone de Cadeira */}
                          <div className={`chair ${isOccupied ? 'occupied' : 'empty'} ${isTopRow ? 'chair-top' : 'chair-bottom'}`}></div>

                          {/* Mesa */}
                          <div className={`desk-card ${isOccupied ? 'desk-occupied' : 'desk-free'}`}>
                            <div className="desk-card-header">
                              <span className="desk-name"><Monitor size={14} /> {isl.name.split(' (')[0]}</span>
                              <button className="btn-delete-icon" onClick={() => handleDelete(isl.id)} title="Excluir Mesa">
                                <Trash2 size={14} />
                              </button>
                            </div>

                            {isInvalidEmployee && (
                              <div className="invalid-employee-warning">
                                Funcionário Inativo/Outro
                              </div>
                            )}

                            <div className="desk-assign-container">
                              <select 
                                value={isl.employee_id || ''}
                                onChange={(e) => handleAssignEmployee(isl.id, e.target.value)}
                                className={`desk-select ${isOccupied ? 'select-occupied' : 'select-empty'}`}
                              >
                                <option value="">-- Mesa Vazia --</option>
                                {/* Mapeia apenas funcionários ATIVOS e da SEDE */}
                                {activeEmployees.map(emp => (
                                  <option key={emp.id} value={emp.id}>{emp.name}</option>
                                ))}
                                {/* Mantém visualização se funcionário for inativo mas ainda estiver lotado na mesa */}
                                {isOccupied && !activeEmployees.find(e => e.id === isl.employee_id) && isl.employees && (
                                  <option value={isl.employee_id}>{isl.employees.name} (Inativo)</option>
                                )}
                              </select>
                            </div>
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
