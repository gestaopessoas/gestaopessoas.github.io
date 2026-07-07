import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { Gift } from 'lucide-react';

const Aniversarios = () => {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    // Fetch employees with birthdays
    const { data: emps } = await supabase
      .from('employees')
      .select('id, name, birthday')
      .not('birthday', 'is', null);
      
    if (emps) {
      // Sort by upcoming birthday in the current year
      const currentMonth = new Date().getMonth() + 1;
      const currentDay = new Date().getDate();

      const sorted = emps.sort((a, b) => {
        const dateA = a.birthday.split('-');
        const dateB = b.birthday.split('-');
        const monthA = parseInt(dateA[1]);
        const monthB = parseInt(dateB[1]);
        const dayA = parseInt(dateA[2]);
        const dayB = parseInt(dateB[2]);

        const aHasPassed = monthA < currentMonth || (monthA === currentMonth && dayA < currentDay);
        const bHasPassed = monthB < currentMonth || (monthB === currentMonth && dayB < currentDay);

        // Se um já passou e o outro não, o que não passou vem primeiro
        if (aHasPassed && !bHasPassed) return 1;
        if (!aHasPassed && bHasPassed) return -1;

        // Se estão no mesmo estado (ambos passaram ou ambos não passaram), ordena por mês e dia
        if (monthA !== monthB) return monthA - monthB;
        return dayA - dayB;
      });

      setEmployees(sorted);
    }
    
    setLoading(false);
  };

  const getMonthName = (monthStr) => {
    const months = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    return months[parseInt(monthStr) - 1];
  };

  return (
    <div className="glass-panel p-4 fade-in">
      <div className="flex-between" style={{ marginBottom: '1.5rem' }}>
        <h2>Calendário de Aniversários</h2>
      </div>

      <div className="mt-4">
        {loading ? (
          <p className="text-muted">Carregando...</p>
        ) : employees.length === 0 ? (
          <p className="text-muted">Nenhum colaborador com aniversário registrado.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {employees.map((emp) => {
              const dateParts = emp.birthday.split('-');
              const isToday = 
                parseInt(dateParts[1]) === new Date().getMonth() + 1 && 
                parseInt(dateParts[2]) === new Date().getDate();
                
              return (
                <div key={emp.id} style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '1.5rem',
                  padding: '1.5rem',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: isToday ? 'var(--color-primary-light)' : 'var(--color-bg)',
                  border: isToday ? '1px solid var(--color-primary)' : '1px solid var(--color-border)'
                }}>
                  <div style={{ 
                    backgroundColor: isToday ? 'var(--color-primary)' : 'var(--color-surface)',
                    color: isToday ? '#fff' : 'var(--color-primary)',
                    width: '60px',
                    height: '60px',
                    borderRadius: 'var(--radius-md)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: 'var(--shadow-sm)'
                  }}>
                    <span style={{ fontSize: '1.5rem', fontWeight: 700, lineHeight: 1 }}>{dateParts[2]}</span>
                    <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: 600 }}>
                      {getMonthName(dateParts[1]).substring(0, 3)}
                    </span>
                  </div>
                  
                  <div style={{ flex: 1 }}>
                    <h3 style={{ margin: 0, fontSize: '1.2rem', color: isToday ? 'var(--color-primary-hover)' : 'var(--color-text)' }}>
                      {emp.name}
                    </h3>
                    {isToday && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--color-primary)', marginTop: '0.25rem', fontWeight: 600 }}>
                        <Gift size={16} /> É hoje!
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default Aniversarios;
