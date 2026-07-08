import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Lock, Shirt, Map, Gift, Users, FileText, ChevronDown, Clock } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { LogOut } from 'lucide-react';

const Sidebar = () => {
  const { user, signOut } = useAuth();
  const [mpOpen, setMpOpen] = React.useState(false);

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <img src="/images/logo.png" alt="ACPO Gestão de Pessoas" />
      </div>

      <nav className="sidebar-nav">
        <NavLink to="/" className={({ isActive }) => isActive ? "nav-item active" : "nav-item"} end>
          <LayoutDashboard />
          <span>Dashboard</span>
        </NavLink>

        <NavLink to="/colaboradores" className={({ isActive }) => isActive ? "nav-item active" : "nav-item"}>
          <Users />
          <span>Colaboradores</span>
        </NavLink>

        <NavLink to="/arquivo-morto" className={({ isActive }) => isActive ? "nav-item active" : "nav-item"}>
          <Users style={{ opacity: 0.6 }} />
          <span>Arquivo Morto</span>
        </NavLink>

        <NavLink to="/armarios" className={({ isActive }) => isActive ? "nav-item active" : "nav-item"}>
          <Lock />
          <span>Armários</span>
        </NavLink>

        <NavLink to="/uniformes" className={({ isActive }) => isActive ? "nav-item active" : "nav-item"}>
          <Shirt />
          <span>Uniformes</span>
        </NavLink>

        <NavLink to="/ilhas" className={({ isActive }) => isActive ? "nav-item active" : "nav-item"}>
          <Map />
          <span>Ilhas & Setores</span>
        </NavLink>

        <NavLink to="/aniversarios" className={({ isActive }) => isActive ? "nav-item active" : "nav-item"}>
          <Gift />
          <span>Aniversários</span>
        </NavLink>

        <NavLink to="/ponto" className={({ isActive }) => isActive ? "nav-item active" : "nav-item"}>
          <Clock />
          <span>Controle de Ponto</span>
        </NavLink>

        {/* MPs - Submenu */}
        <div>
          <button
            className="nav-item"
            onClick={() => setMpOpen(!mpOpen)}
            style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', justifyContent: 'space-between' }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <FileText size={18} />
              <span>Memorandos (MP)</span>
            </span>
            <ChevronDown size={14} style={{ transform: mpOpen ? 'rotate(180deg)' : 'none', transition: '0.2s' }} />
          </button>

          {mpOpen && (
            <div style={{ paddingLeft: '1.5rem', marginTop: '0.25rem', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
              <NavLink to="/mp/contratacao" className={({ isActive }) => isActive ? "nav-item active" : "nav-item"} style={{ fontSize: '0.85rem' }}>
                <span>📄 Contratação</span>
              </NavLink>
              <NavLink to="/mp/alteracao" className={({ isActive }) => isActive ? "nav-item active" : "nav-item"} style={{ fontSize: '0.85rem' }}>
                <span>📝 Alteração Cargo/Sal.</span>
              </NavLink>
            </div>
          )}
        </div>
      </nav>

      {/* Usuário logado + Sair */}
      <div style={{
        marginTop: 'auto', padding: '1rem',
        borderTop: '1px solid var(--color-border)',
        display: 'flex', alignItems: 'center', gap: '0.75rem',
      }}>
        <div style={{
          width: '36px', height: '36px', borderRadius: '50%',
          background: 'var(--color-primary)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: 700, color: '#fff', fontSize: '0.9rem', flexShrink: 0,
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
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', padding: '0.25rem', borderRadius: '6px', transition: 'color 0.2s', display: 'flex', alignItems: 'center' }}
          onMouseOver={e => e.currentTarget.style.color = '#ef4444'}
          onMouseOut={e => e.currentTarget.style.color = 'var(--color-text-muted)'}
        >
          <LogOut size={18} />
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
