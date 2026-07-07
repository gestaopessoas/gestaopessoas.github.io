import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import './Dashboard.css';

const Dashboard = () => {
  const [stats, setStats] = useState({
    colaboradores: 0,
    armariosOcupados: 0,
    armariosTotal: 0,
    aniversariantesMes: 0
  });

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    // 1. Colaboradores
    const { count: colabCount } = await supabase
      .from('employees')
      .select('*', { count: 'exact', head: true });

    // 2. Armários
    const { count: armariosTotalCount } = await supabase
      .from('lockers')
      .select('*', { count: 'exact', head: true });
      
    const { count: armariosOcupadosCount } = await supabase
      .from('lockers')
      .select('*', { count: 'exact', head: true })
      .not('employee_id', 'is', null);

    // 3. Aniversariantes do Mês
    const { data: emps } = await supabase.from('employees').select('birthday').not('birthday', 'is', null);
    
    let currentMonthBirthdays = 0;
    if (emps) {
      const currentMonth = new Date().getMonth() + 1; // 1-12
      emps.forEach(emp => {
        const parts = emp.birthday.split('-');
        if (parts.length === 3 && parseInt(parts[1]) === currentMonth) {
          currentMonthBirthdays++;
        }
      });
    }

    setStats({
      colaboradores: colabCount || 0,
      armariosTotal: armariosTotalCount || 0,
      armariosOcupados: armariosOcupadosCount || 0,
      aniversariantesMes: currentMonthBirthdays
    });
  };

  return (
    <div className="dashboard-container fade-in">
      <div className="grid-cols-4">
        <div className="glass-panel stat-card">
          <h3>Total Colaboradores</h3>
          <div className="stat-value">{stats.colaboradores}</div>
        </div>
        <div className="glass-panel stat-card">
          <h3>Armários Ocupados</h3>
          <div className="stat-value">{stats.armariosOcupados}/{stats.armariosTotal}</div>
        </div>
        <div className="glass-panel stat-card">
          <h3>Aniversariantes do Mês</h3>
          <div className="stat-value">{stats.aniversariantesMes}</div>
        </div>
        <div className="glass-panel stat-card">
          <h3>Uniformes Pendentes</h3>
          <div className="stat-value">-</div>
        </div>
      </div>
      
      <div className="dashboard-content grid-cols-2 mt-4">
        <div className="glass-panel p-4">
          <h2>Bem-vindo ao Portal de Gestão</h2>
          <p className="text-muted mt-2">
            Utilize o menu lateral para gerenciar as informações da equipe.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
