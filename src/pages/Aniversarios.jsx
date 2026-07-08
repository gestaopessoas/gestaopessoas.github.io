import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { Gift } from 'lucide-react';

const Aniversarios = () => {
  const [birthdays, setBirthdays] = useState([]);
  const [workAnnivs, setWorkAnnivs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    const { data: emps } = await supabase
      .from('employees')
      .select('id, name, birthday, admission_date');
      
    if (emps) {
      const currentMonth = new Date().getMonth() + 1;

      // Filtrar apenas do mês atual e ordenar por dia
      const monthBirthdays = emps
        .filter(emp => emp.birthday && parseInt(emp.birthday.split('-')[1]) === currentMonth)
        .sort((a, b) => parseInt(a.birthday.split('-')[2]) - parseInt(b.birthday.split('-')[2]));

      const monthWorkAnnivs = emps
        .filter(emp => emp.admission_date && parseInt(emp.admission_date.split('-')[1]) === currentMonth)
        .sort((a, b) => parseInt(a.admission_date.split('-')[2]) - parseInt(b.admission_date.split('-')[2]));

      setBirthdays(monthBirthdays);
      setWorkAnnivs(monthWorkAnnivs);
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

      <div className="mt-4" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
        {/* Coluna 1: Aniversários do Mês */}
        <div>
          <h3 style={{ marginBottom: '1rem', color: 'var(--color-primary)' }}>Aniversariantes do Mês</h3>
          {loading ? (
            <p className="text-muted">Carregando...</p>
          ) : birthdays.length === 0 ? (
            <p className="text-muted">Nenhum aniversário este mês.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {birthdays.map((emp) => {
                const dateParts = emp.birthday.split('-');
                const isToday = 
                  parseInt(dateParts[1]) === new Date().getMonth() + 1 && 
                  parseInt(dateParts[2]) === new Date().getDate();
                  
                return (
                  <div key={`b-${emp.id}`} style={{ 
                    display: 'flex', alignItems: 'center', gap: '1.5rem', padding: '1.5rem',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: isToday ? 'var(--color-primary-light)' : 'var(--color-bg)',
                    border: isToday ? '1px solid var(--color-primary)' : '1px solid var(--color-border)'
                  }}>
                    <div style={{ 
                      backgroundColor: isToday ? 'var(--color-primary)' : 'var(--color-surface)',
                      color: isToday ? '#fff' : 'var(--color-primary)',
                      width: '60px', height: '60px', borderRadius: 'var(--radius-md)',
                      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                      boxShadow: 'var(--shadow-sm)'
                    }}>
                      <span style={{ fontSize: '1.5rem', fontWeight: 700, lineHeight: 1 }}>{dateParts[2]}</span>
                      <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: 600 }}>
                        {getMonthName(dateParts[1]).substring(0, 3)}
                      </span>
                    </div>
                    <div style={{ flex: 1 }}>
                      <h3 style={{ margin: 0, fontSize: '1.1rem', color: isToday ? 'var(--color-primary-hover)' : 'var(--color-text)' }}>
                        {emp.name}
                      </h3>
                      {isToday && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--color-primary)', marginTop: '0.25rem', fontWeight: 600, fontSize: '0.9rem' }}>
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

        {/* Coluna 2: Tempo de Casa */}
        <div>
          <h3 style={{ marginBottom: '1rem', color: 'var(--color-primary)' }}>Tempo de Casa (Mês Atual)</h3>
          {loading ? (
            <p className="text-muted">Carregando...</p>
          ) : workAnnivs.length === 0 ? (
            <p className="text-muted">Nenhum tempo de casa este mês.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {workAnnivs.map((emp) => {
                const dateParts = emp.admission_date.split('-');
                const hireYear = parseInt(dateParts[0]);
                const currentYear = new Date().getFullYear();
                const yearsOfService = currentYear - hireYear;

                return (
                  <div key={`w-${emp.id}`} style={{ 
                    display: 'flex', alignItems: 'center', gap: '1.5rem', padding: '1.5rem',
                    borderRadius: 'var(--radius-md)', backgroundColor: 'var(--color-bg)', border: '1px solid var(--color-border)'
                  }}>
                    <div style={{ 
                      backgroundColor: 'var(--color-surface)', color: 'var(--color-primary)',
                      width: '60px', height: '60px', borderRadius: 'var(--radius-md)',
                      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                      boxShadow: 'var(--shadow-sm)'
                    }}>
                      <span style={{ fontSize: '1.5rem', fontWeight: 700, lineHeight: 1 }}>{yearsOfService}</span>
                      <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: 600 }}>anos</span>
                    </div>
                    <div style={{ flex: 1 }}>
                      <h3 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--color-text)' }}>
                        {emp.name}
                      </h3>
                      <div style={{ color: 'var(--color-text-muted)', marginTop: '0.25rem', fontSize: '0.85rem' }}>
                        Desde {dateParts[2]}/{dateParts[1]}/{dateParts[0]}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Aniversarios;
