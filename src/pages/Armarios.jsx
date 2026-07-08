import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { X, Lock, Unlock } from 'lucide-react';

const Armarios = () => {
  const [lockers, setLockers] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);

  const [selectedLocker, setSelectedLocker] = useState(null);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    // Fetch active employees
    const { data: emps } = await supabase.from('employees').select('id, name').eq('status', 'Ativo').order('name');
    if (emps) setEmployees(emps);

    // Fetch lockers
    const { data: lks } = await supabase
      .from('lockers')
      .select(`*, employees (name)`)
      .order('number');
    if (lks) setLockers(lks);
    
    if (showLoading) setLoading(false);
  };

  const handleAssign = async () => {
    if (!selectedLocker) return;
    await supabase.from('lockers').update({ employee_id: selectedEmployeeId || null }).eq('id', selectedLocker.id);
    setSelectedLocker(null);
    fetchData(false);
  };

  const openLocker = (lk) => {
    setSelectedLocker(lk);
    setSelectedEmployeeId(lk.employee_id || '');
  };

  // Helpers to get locker by exact number string
  const getVertical = (num) => lockers.find(l => l.number === `Vertical ${String(num).padStart(2, '0')}`);
  const getHorizontal = (num) => lockers.find(l => l.number === `Horizontal ${String(num).padStart(2, '0')}`);

  const renderLockerBox = (lk, labelNum) => {
    if (!lk) return <div style={{ width: '60px', height: '60px', background: 'transparent' }} />;
    const isOccupied = !!lk.employee_id;
    return (
      <div 
        key={lk.id} 
        onClick={() => openLocker(lk)}
        style={{
          width: '60px', 
          height: '60px', 
          backgroundColor: isOccupied ? 'rgba(239, 68, 68, 0.15)' : 'rgba(34, 197, 94, 0.15)',
          border: `2px solid ${isOccupied ? '#ef4444' : '#22c55e'}`,
          borderRadius: '6px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          transition: 'transform 0.1s',
          title: isOccupied ? lk.employees?.name : 'Livre'
        }}
        onMouseOver={e => e.currentTarget.style.transform = 'scale(1.05)'}
        onMouseOut={e => e.currentTarget.style.transform = 'scale(1)'}
      >
        <span style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--color-text)' }}>{labelNum}</span>
        {isOccupied ? <Lock size={14} color="#ef4444" style={{ marginTop: '2px' }} /> : <Unlock size={14} color="#22c55e" style={{ marginTop: '2px' }} />}
      </div>
    );
  };

  // Rendering blocks of vertical lockers (each block is 2x4)
  const renderVerticalBlock = (startNum) => {
    const nums = [];
    for (let i = 0; i < 8; i++) nums.push(startNum + i);
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px', background: 'var(--color-surface)', padding: '12px', borderRadius: '8px', border: '1px solid var(--color-border)' }}>
        {nums.map(n => renderLockerBox(getVertical(n), n))}
      </div>
    );
  };

  // Rendering horizontal block (7x2)
  const renderHorizontalBlock = () => {
    const nums = [];
    for (let i = 1; i <= 14; i++) nums.push(i);
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '8px', background: 'var(--color-surface)', padding: '12px', borderRadius: '8px', border: '1px solid var(--color-border)', width: 'fit-content' }}>
        {nums.map(n => renderLockerBox(getHorizontal(n), n))}
      </div>
    );
  };

  return (
    <div className="fade-in" style={{ padding: '1rem 0' }}>
      <div className="flex-between" style={{ marginBottom: '2rem' }}>
        <h2>Gestão de Armários</h2>
      </div>

      {loading ? (
        <p className="text-muted">Carregando estrutura dos armários...</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '3rem' }}>
          
          {/* VERTICAIS */}
          <div>
            <h3 style={{ color: 'var(--color-primary)', marginBottom: '1rem' }}>Armários Verticais</h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2rem' }}>
              {renderVerticalBlock(1)}
              {renderVerticalBlock(9)}
              {renderVerticalBlock(17)}
              {renderVerticalBlock(25)}
            </div>
          </div>

          {/* HORIZONTAIS */}
          <div>
            <h3 style={{ color: 'var(--color-primary)', marginBottom: '1rem' }}>Armários Horizontais</h3>
            {renderHorizontalBlock()}
          </div>

        </div>
      )}

      {/* Modal de Atribuição */}
      {selectedLocker && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1100, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="fade-in" style={{ background: 'var(--color-surface)', padding: '2rem', borderRadius: 'var(--radius-lg)', width: '90%', maxWidth: '400px', border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-xl)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3 style={{ margin: 0 }}>{selectedLocker.number}</h3>
              <button onClick={() => setSelectedLocker(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)' }}><X size={20} /></button>
            </div>
            
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', fontSize: '0.9rem', color: 'var(--color-text-muted)', marginBottom: '0.5rem' }}>Ocupante Atual / Atribuir para:</label>
              <select 
                value={selectedEmployeeId}
                onChange={(e) => setSelectedEmployeeId(e.target.value)}
                style={{ width: '100%', padding: '0.8rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-text)', fontSize: '1rem' }}
              >
                <option value="">-- LIVRE (Desocupado) --</option>
                {employees.map(emp => (
                  <option key={emp.id} value={emp.id}>{emp.name}</option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
              <button onClick={() => setSelectedLocker(null)} className="btn-secondary" style={{ padding: '0.6rem 1rem' }}>Cancelar</button>
              <button onClick={handleAssign} className="btn-primary" style={{ padding: '0.6rem 1.5rem' }}>Salvar Alterações</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Armarios;
