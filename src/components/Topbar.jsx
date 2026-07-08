import React, { useState, useRef, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Bell, User, Settings, LogOut, ChevronDown } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const Topbar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { userProfile, signOut } = useAuth();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);
  
  const getPageTitle = () => {
    switch(location.pathname) {
      case '/': return 'Dashboard de Gestão';
      case '/armarios': return 'Controle de Armários';
      case '/uniformes': return 'Gestão de Uniformes';
      case '/ilhas': return 'Mapeamento de Ilhas';
      case '/aniversarios': return 'Calendário de Aniversários';
      case '/colaboradores': return 'Colaboradores';
      case '/arquivo-morto': return 'Arquivo Morto';
      case '/ponto': return 'Controle de Ponto';
      case '/rgs': return 'Controle RGS';
      case '/custos': return 'Custos';
      case '/configuracoes': return 'Configurações de Usuário';
      default: return 'Portal ACPO';
    }
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const initial = userProfile?.name ? userProfile.name.charAt(0).toUpperCase() : 'U';

  return (
    <header className="topbar">
      <div className="topbar-title">
        <h1>{getPageTitle()}</h1>
      </div>
      <div className="topbar-user">
        <button className="icon-btn">
          <Bell size={20} color="var(--color-text-muted)" />
        </button>
        
        <div className="user-menu-container" ref={dropdownRef}>
          <button 
            className="user-menu-button" 
            onClick={() => setDropdownOpen(!dropdownOpen)}
          >
            {userProfile?.avatar_url ? (
              <img src={userProfile.avatar_url} alt="Avatar" className="avatar-img" />
            ) : (
              <div className="avatar">{initial}</div>
            )}
            <span className="user-name">{userProfile?.name || 'Usuário'}</span>
            <ChevronDown size={16} color="var(--color-text-muted)" />
          </button>

          {dropdownOpen && (
            <div className="user-dropdown glass-panel fade-in">
              <div className="dropdown-header">
                <strong>{userProfile?.name || 'Usuário'}</strong>
                <span className="text-muted" style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>Nível: {userProfile?.level || 1}</span>
              </div>
              <div className="dropdown-divider"></div>
              
              <button className="dropdown-item" onClick={() => { navigate('/configuracoes'); setDropdownOpen(false); }}>
                <User size={16} /> Meu Perfil
              </button>
              
              <button className="dropdown-item" onClick={() => { navigate('/configuracoes?tab=usuarios'); setDropdownOpen(false); }}>
                <Settings size={16} /> Gestão de Usuários
              </button>
              
              <div className="dropdown-divider"></div>
              <button className="dropdown-item text-danger" onClick={handleSignOut}>
                <LogOut size={16} /> Sair
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Topbar;
