import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Lock, Shirt, Map, Gift, Users, LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const Sidebar = () => {
  const { user, signOut } = useAuth();

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <img src="/images/logo.png" alt="ACPO Gestão de Pessoas" />
      </div>
      
      <nav className="sidebar-nav">
        <NavLink to="/" className={({isActive}) => isActive ? "nav-item active" : "nav-item"} end>
          <LayoutDashboard />
          <span>Dashboard</span>
        </NavLink>
        
        <NavLink to="/colaboradores" className={({isActive}) => isActive ? "nav-item active" : "nav-item"}>
          <Users />
          <span>Colaboradores</span>
        </NavLink>

        <NavLink to="/armarios" className={({isActive}) => isActive ? "nav-item active" : "nav-item"}>
          <Lock />
          <span>Armários</span>
        </NavLink>
        
        <NavLink to="/uniformes" className={({isActive}) => isActive ? "nav-item active" : "nav-item"}>
          <Shirt />
          <span>Uniformes</span>
        </NavLink>
        
        <NavLink to="/ilhas" className={({isActive}) => isActive ? "nav-item active" : "nav-item"}>
          <Map />
          <span>Ilhas & Setores</span>
        </NavLink>
        
        <NavLink to="/aniversarios" className={({isActive}) => isActive ? "nav-item active" : "nav-item"}>
          <Gift />
          <span>Aniversários</span>
        </NavLink>
      </nav>

      {/* Usuário logado + Sair */}
      <div style={{
        marginTop: 'auto',
        padding: '1rem',
        borderTop: '1px solid var(--color-border)',
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
      }}>
        <div style={{
          width: '36px', height: '36px',
          borderRadius: '50%',
          background: 'var(--color-primary)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: 700, color: '#fff', fontSize: '0.9rem',
          flexShrink: 0,
        }}>
          {user?.email?.[0]?.toUpperCase() ?? 'U'}
        </div>
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--color-text)', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {user?.email}
          </p>
          <p style={{ margin: 0, fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>Gestão de Pessoas</p>
        </div>
        <button
          onClick={signOut}
          title="Sair"
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--color-text-muted)', padding: '0.25rem',
            borderRadius: '6px', transition: 'color 0.2s',
            display: 'flex', alignItems: 'center',
          }}
          onMouseOver={(e) => e.currentTarget.style.color = '#ef4444'}
          onMouseOut={(e) => e.currentTarget.style.color = 'var(--color-text-muted)'}
        >
          <LogOut size={18} />
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
