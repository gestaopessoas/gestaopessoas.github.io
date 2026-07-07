import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { Trash2 } from 'lucide-react';

const Uniformes = () => {
  const [uniforms, setUniforms] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);

  // Form state
  const [employeeId, setEmployeeId] = useState('');
  const [size, setSize] = useState('');
  const [items, setItems] = useState('');
  const [deliveryDate, setDeliveryDate] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    // Fetch employees for dropdown
    const { data: emps } = await supabase.from('employees').select('id, name').order('name');
    if (emps) setEmployees(emps);

    // Fetch uniforms with employee relation
    const { data: unis } = await supabase
      .from('uniforms')
      .select(`
        *,
        employees (name)
      `)
      .order('delivery_date', { ascending: false });
    if (unis) setUniforms(unis);
    
    setLoading(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!employeeId) return;

    const { error } = await supabase.from('uniforms').insert([{ 
      employee_id: employeeId,
      size: size || null,
      items: items || null,
      delivery_date: deliveryDate || null
    }]);

    if (!error) {
      setEmployeeId('');
      setSize('');
      setItems('');
      setDeliveryDate('');
      setShowForm(false);
      fetchData();
    } else {
      alert("Erro ao salvar entrega: " + error.message);
    }
  };

  const handleDelete = async (id) => {
    if(window.confirm('Excluir este registro?')) {
      await supabase.from('uniforms').delete().eq('id', id);
      fetchData();
    }
  };

  return (
    <div className="glass-panel p-4 fade-in">
      <div className="flex-between">
        <h2>Gestão de Uniformes</h2>
        <button className="btn-primary" onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Cancelar' : 'Registrar Entrega'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="mt-4 p-4" style={{ backgroundColor: 'var(--color-bg)', borderRadius: 'var(--radius-md)' }}>
          <div className="grid-cols-4" style={{ marginBottom: '1rem' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>Colaborador *</label>
              <select 
                value={employeeId} 
                onChange={(e) => setEmployeeId(e.target.value)}
                required
                style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--color-border)' }}
              >
                <option value="">Selecione...</option>
                {employees.map(emp => (
                  <option key={emp.id} value={emp.id}>{emp.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>Tamanho</label>
              <select 
                value={size} 
                onChange={(e) => setSize(e.target.value)}
                style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--color-border)' }}
              >
                <option value="">Selecione...</option>
                <option value="PP">PP</option>
                <option value="P">P</option>
                <option value="M">M</option>
                <option value="G">G</option>
                <option value="GG">GG</option>
                <option value="EXG">EXG</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>Peças (Ex: 2 calças)</label>
              <input 
                type="text" 
                value={items} 
                onChange={(e) => setItems(e.target.value)} 
                style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--color-border)' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>Data da Entrega</label>
              <input 
                type="date" 
                value={deliveryDate} 
                onChange={(e) => setDeliveryDate(e.target.value)} 
                style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--color-border)' }}
              />
            </div>
          </div>
          <button type="submit" className="btn-primary">Salvar Registro</button>
        </form>
      )}

      <div className="mt-4">
        {loading ? (
          <p className="text-muted">Carregando...</p>
        ) : uniforms.length === 0 ? (
          <p className="text-muted">Nenhum registro de uniforme no momento.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--color-border)', color: 'var(--color-text-muted)' }}>
                <th style={{ padding: '0.75rem 0' }}>Data</th>
                <th style={{ padding: '0.75rem 0' }}>Colaborador</th>
                <th style={{ padding: '0.75rem 0' }}>Tamanho</th>
                <th style={{ padding: '0.75rem 0' }}>Peças Entregues</th>
                <th style={{ padding: '0.75rem 0', textAlign: 'right' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {uniforms.map(uni => {
                const dateParts = uni.delivery_date ? uni.delivery_date.split('-') : null;
                const formattedDate = dateParts ? `${dateParts[2]}/${dateParts[1]}/${dateParts[0]}` : '-';

                return (
                  <tr key={uni.id} style={{ borderBottom: '1px solid var(--color-border-light)' }}>
                    <td style={{ padding: '0.75rem 0', fontWeight: 500 }}>{formattedDate}</td>
                    <td style={{ padding: '0.75rem 0' }}>{uni.employees?.name}</td>
                    <td style={{ padding: '0.75rem 0' }}>{uni.size || '-'}</td>
                    <td style={{ padding: '0.75rem 0', color: 'var(--color-text-muted)' }}>{uni.items || '-'}</td>
                    <td style={{ padding: '0.75rem 0', textAlign: 'right' }}>
                      <button 
                        onClick={() => handleDelete(uni.id)}
                        style={{ color: '#ef4444', padding: '0.25rem' }}
                        title="Excluir"
                      >
                        <Trash2 size={18} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default Uniformes;
