import React from 'react';
import { useLocation } from 'react-router-dom';
import { Bell } from 'lucide-react';

const Topbar = () => {
  const location = useLocation();
  
  const getPageTitle = () => {
    switch(location.pathname) {
      case '/': return 'Dashboard de Gestão';
      case '/armarios': return 'Controle de Armários';
      case '/uniformes': return 'Gestão de Uniformes';
      case '/ilhas': return 'Mapeamento de Ilhas';
      case '/aniversarios': return 'Calendário de Aniversários';
      default: return 'Portal ACPO';
    }
  };

  return (
    <header className="topbar">
      <div className="topbar-title">
        <h1>{getPageTitle()}</h1>
      </div>
      <div className="topbar-user">
        <button className="icon-btn">
          <Bell size={20} color="var(--color-text-muted)" />
        </button>
        <div className="avatar">RH</div>
      </div>
    </header>
  );
};

export default Topbar;
