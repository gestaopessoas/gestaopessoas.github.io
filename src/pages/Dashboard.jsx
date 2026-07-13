import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { Users, Lock, Cake, UserMinus, TrendingUp, Briefcase } from 'lucide-react';
import './Dashboard.css';

const Dashboard = () => {
  const [stats, setStats] = useState({
    colaboradores: 0,
    armariosOcupados: 0,
    armariosTotal: 0,
    aniversariantesMes: 0,
    desligadosMes: 0
  });

  // Mocked data for charts
  const [sectorData] = useState([
    { name: 'Obras', count: 45, color: '#3b82f6' },
    { name: 'Engenharia', count: 25, color: '#10b981' },
    { name: 'Administrativo', count: 15, color: '#f59e0b' },
    { name: 'RH', count: 5, color: '#8b5cf6' },
    { name: 'Diretoria', count: 3, color: '#ec4899' }
  ]);

  const [hiringTrend] = useState([
    { month: 'Jan', count: 2 },
    { month: 'Fev', count: 5 },
    { month: 'Mar', count: 3 },
    { month: 'Abr', count: 8 },
    { month: 'Mai', count: 4 },
    { month: 'Jun', count: 7 }
  ]);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    // 1. Colaboradores ATIVOS apenas
    const { count: colabCount } = await supabase
      .from('employees')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'Ativo');

    // 2. Desligados este mês
    const now = new Date();
    const firstDay = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`;
    const { count: desligadosMes } = await supabase
      .from('employees')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'Desligado')
      .gte('dismissed_at', firstDay);

    // 3. Armários
    const { count: armariosTotalCount } = await supabase
      .from('lockers')
      .select('*', { count: 'exact', head: true });
    const { count: armariosOcupadosCount } = await supabase
      .from('lockers')
      .select('*', { count: 'exact', head: true })
      .not('employee_id', 'is', null);

    // 4. Aniversariantes do Mês (só ativos)
    const { data: emps } = await supabase
      .from('employees')
      .select('birthday')
      .eq('status', 'Ativo')
      .not('birthday', 'is', null);

    let currentMonthBirthdays = 0;
    if (emps) {
      const currentMonth = now.getMonth() + 1;
      emps.forEach(emp => {
        const parts = emp.birthday.split('-');
        if (parts.length === 3 && parseInt(parts[1]) === currentMonth) currentMonthBirthdays++;
      });
    }

    setStats({
      colaboradores: colabCount || 0,
      desligadosMes: desligadosMes || 0,
      armariosTotal: armariosTotalCount || 0,
      armariosOcupados: armariosOcupadosCount || 0,
      aniversariantesMes: currentMonthBirthdays
    });
  };

  const totalSectors = sectorData.reduce((acc, curr) => acc + curr.count, 0);
  const maxHiring = Math.max(...hiringTrend.map(d => d.count));

  return (
    <div className="dashboard-container fade-in">
      <header className="dashboard-header">
        <div>
          <h1 className="dashboard-title">Portal de Gestão</h1>
          <p className="text-muted">Visão geral e indicadores em tempo real.</p>
        </div>
      </header>

      <div className="grid-cols-4 stats-grid">
        <div className="glass-panel stat-card hover-lift">
          <div className="stat-card-header">
            <h3>Colaboradores Ativos</h3>
            <div className="icon-wrapper bg-blue"><Users size={20} /></div>
          </div>
          <div className="stat-value">{stats.colaboradores}</div>
          <div className="stat-footer text-success">
            <TrendingUp size={14} /> <span>+2% este mês</span>
          </div>
        </div>

        <div className="glass-panel stat-card hover-lift">
          <div className="stat-card-header">
            <h3>Armários Ocupados</h3>
            <div className="icon-wrapper bg-emerald"><Lock size={20} /></div>
          </div>
          <div className="stat-value">
            {stats.armariosOcupados} <span className="stat-total">/ {stats.armariosTotal}</span>
          </div>
          <div className="stat-progress-bar">
            <div 
              className="stat-progress-fill bg-emerald-solid" 
              style={{ width: `${stats.armariosTotal ? (stats.armariosOcupados/stats.armariosTotal)*100 : 0}%` }}
            ></div>
          </div>
        </div>

        <div className="glass-panel stat-card hover-lift">
          <div className="stat-card-header">
            <h3>Aniversariantes do Mês</h3>
            <div className="icon-wrapper bg-amber"><Cake size={20} /></div>
          </div>
          <div className="stat-value">{stats.aniversariantesMes}</div>
          <div className="stat-footer text-muted">
            <span>Mês atual</span>
          </div>
        </div>

        <div className="glass-panel stat-card hover-lift">
          <div className="stat-card-header">
            <h3>Desligamentos</h3>
            <div className="icon-wrapper bg-rose"><UserMinus size={20} /></div>
          </div>
          <div className="stat-value text-rose">{stats.desligadosMes}</div>
          <div className="stat-footer text-muted">
            <span>Neste mês</span>
          </div>
        </div>
      </div>
      
      <div className="dashboard-charts-grid mt-4">
        {/* Gráfico 1: Distribuição de Setores */}
        <div className="glass-panel chart-card fade-in delay-1">
          <div className="chart-header">
            <Briefcase size={18} className="text-muted" />
            <h2>Distribuição por Setor</h2>
          </div>
          <div className="sector-list">
            {sectorData.map((sector, index) => {
              const percentage = Math.round((sector.count / totalSectors) * 100);
              return (
                <div key={index} className="sector-item group">
                  <div className="sector-item-header">
                    <span className="sector-name">
                      <span className="sector-dot" style={{ backgroundColor: sector.color }}></span>
                      {sector.name}
                    </span>
                    <span className="sector-count">{sector.count} colab. <span className="sector-percentage">({percentage}%)</span></span>
                  </div>
                  <div className="sector-bar-bg">
                    <div 
                      className="sector-bar-fill group-hover-expand" 
                      style={{ width: `${percentage}%`, backgroundColor: sector.color }}
                    ></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Gráfico 2: Evolução de Contratações (Barras Vertical) */}
        <div className="glass-panel chart-card fade-in delay-2">
          <div className="chart-header">
            <TrendingUp size={18} className="text-muted" />
            <h2>Evolução de Contratações</h2>
          </div>
          <div className="bar-chart-container">
            <div className="bar-chart">
              {hiringTrend.map((data, idx) => {
                const heightPercentage = (data.count / maxHiring) * 100;
                return (
                  <div key={idx} className="bar-wrapper">
                    <div className="bar-value-tooltip">{data.count}</div>
                    <div className="bar-track">
                      <div 
                        className="bar-fill" 
                        style={{ height: `${heightPercentage}%` }}
                      ></div>
                    </div>
                    <span className="bar-label">{data.month}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
