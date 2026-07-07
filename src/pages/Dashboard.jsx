import React from 'react';
import './Dashboard.css';

const Dashboard = () => {
  return (
    <div className="dashboard-container fade-in">
      <div className="grid-cols-4">
        <div className="glass-panel stat-card">
          <h3>Total Colaboradores</h3>
          <div className="stat-value">124</div>
        </div>
        <div className="glass-panel stat-card">
          <h3>Armários Ocupados</h3>
          <div className="stat-value">86/100</div>
        </div>
        <div className="glass-panel stat-card">
          <h3>Aniversariantes do Mês</h3>
          <div className="stat-value">5</div>
        </div>
        <div className="glass-panel stat-card">
          <h3>Uniformes Pendentes</h3>
          <div className="stat-value">12</div>
        </div>
      </div>
      
      <div className="dashboard-content grid-cols-2 mt-4">
        <div className="glass-panel p-4">
          <h2>Próximos Aniversários</h2>
          <p className="text-muted">Nenhum aniversário nos próximos 7 dias.</p>
        </div>
        <div className="glass-panel p-4">
          <h2>Avisos Recentes</h2>
          <p className="text-muted">Sistema de gestão iniciado com sucesso.</p>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
