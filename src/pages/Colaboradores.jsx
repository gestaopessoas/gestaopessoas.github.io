import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { Trash2 } from 'lucide-react';

const Colaboradores = () => {
  const [employees, setEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);

  // Form state
  const [name, setName] = useState('');
  const [deptId, setDeptId] = useState('');
  const [birthday, setBirthday] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    // Fetch departments
    const { data: depts } = await supabase.from('departments').select('*');
    if (depts) setDepartments(depts);

    // Fetch employees with department relation
    const { data: emps } = await supabase
      .from('employees')
      .select(`
        *,
        departments (name)
      `)
      .order('name');
    if (emps) setEmployees(emps);
    
    setLoading(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name) return;

    const { error } = await supabase.from('employees').insert([
      { 
        name, 
        department_id: deptId || null,
        birthday: birthday || null 
      }
    ]);

    if (!error) {
      setName('');
      setDeptId('');
      setBirthday('');
      setShowForm(false);
      fetchData(); // Refresh list
    } else {
      alert("Erro ao salvar: " + error.message);
    }
  };

  const handleDelete = async (id) => {
    if(window.confirm('Tem certeza que deseja excluir?')) {
      await supabase.from('employees').delete().eq('id', id);
      fetchData();
    }
  };

  return (
    <div className="glass-panel p-4 fade-in">
      <div className="flex-between">
        <h2>Colaboradores</h2>
        <button className="btn-primary" onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Cancelar' : 'Adicionar Colaborador'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="mt-4 p-4" style={{ backgroundColor: 'var(--color-bg)', borderRadius: 'var(--radius-md)' }}>
          <div className="grid-cols-3" style={{ marginBottom: '1rem' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, fontSize: '0.9rem' }}>Nome *</label>
              <input 
                type="text" 
                value={name} 
                onChange={(e) => setName(e.target.value)} 
                required
                style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--color-border)' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, fontSize: '0.9rem' }}>Setor</label>
              <select 
                value={deptId} 
                onChange={(e) => setDeptId(e.target.value)}
                style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--color-border)' }}
              >
                <option value="">Selecione um setor...</option>
                {departments.map(d => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, fontSize: '0.9rem' }}>Data de Nascimento</label>
              <input 
                type="date" 
                value={birthday} 
                onChange={(e) => setBirthday(e.target.value)} 
                style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--color-border)' }}
              />
            </div>
          </div>
          <button type="submit" className="btn-primary">Salvar</button>
        </form>
      )}

      <div className="mt-4">
        {loading ? (
          <p className="text-muted">Carregando...</p>
        ) : employees.length === 0 ? (
          <p className="text-muted">Nenhum colaborador registrado no momento.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--color-border)', color: 'var(--color-text-muted)' }}>
                <th style={{ padding: '0.75rem 0' }}>Nome</th>
                <th style={{ padding: '0.75rem 0' }}>Setor</th>
                <th style={{ padding: '0.75rem 0' }}>Aniversário</th>
                <th style={{ padding: '0.75rem 0', textAlign: 'right' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {employees.map(emp => {
                const dateParts = emp.birthday ? emp.birthday.split('-') : null;
                const formattedDate = dateParts ? `${dateParts[2]}/${dateParts[1]}` : '-';

                return (
                  <tr key={emp.id} style={{ borderBottom: '1px solid var(--color-border-light)' }}>
                    <td style={{ padding: '0.75rem 0', fontWeight: 500 }}>{emp.name}</td>
                    <td style={{ padding: '0.75rem 0', color: 'var(--color-text-muted)' }}>
                      {emp.departments?.name || '-'}
                    </td>
                    <td style={{ padding: '0.75rem 0', color: 'var(--color-text-muted)' }}>
                      {formattedDate}
                    </td>
                    <td style={{ padding: '0.75rem 0', textAlign: 'right' }}>
                      <button 
                        onClick={() => handleDelete(emp.id)}
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

export default Colaboradores;
