import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, Lock, Shirt, Map, Gift, Users, FileText,
  ChevronDown, Clock, ClipboardList, DollarSign, Briefcase,
  LogOut, PanelLeftClose, PanelLeftOpen
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const Sidebar = () => {
  const { user, signOut, can } = useAuth();
  const [mpOpen, setMpOpen] = React.useState(false);
  const [collapsed, setCollapsed] = React.useState(false);

  const navItem = (to, Icon, label, end = false, module) => can(module) && (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}
      title={collapsed ? label : undefined}
    >
      <Icon />
      {!collapsed && <span>{label}</span>}
    </NavLink>
  );

  return (
    <aside className={`sidebar${collapsed ? ' sidebar-collapsed' : ''}`}>
      <div className="sidebar-header">
        {!collapsed && (
          <div className="sidebar-logo">
            <img src="/images/logo.png" alt="ACPO Gestao de Pessoas" />
          </div>
        )}
        <button
          className="sidebar-toggle"
          onClick={() => setCollapsed(c => !c)}
          title={collapsed ? 'Expandir menu' : 'Recolher menu'}
        >
          {collapsed ? <PanelLeftOpen size={20} /> : <PanelLeftClose size={20} />}
        </button>
      </div>

      <nav className="sidebar-nav">
        {navItem('/', LayoutDashboard, 'Dashboard', true)}
        {navItem('/colaboradores', Users, 'Colaboradores', false, 'colaboradores')}
        {navItem('/arquivo-morto', () => <Users style={{ opacity: 0.6 }} />, 'Arquivo Morto', false, 'arquivo_morto')}
        {navItem('/armarios', Lock, 'Armarios', false, 'armarios')}
        {navItem('/uniformes', Shirt, 'Uniformes', false, 'uniformes')}
        {navItem('/ilhas', Map, 'Ilhas & Setores', false, 'ilhas')}
        {navItem('/aniversarios', Gift, 'Aniversarios')}
        {navItem('/ponto', Clock, 'Controle de Ponto', false, 'ponto')}
        {navItem('/rgs', ClipboardList, 'Controle RGS', false, 'rgs')}
        {navItem('/custos', DollarSign, 'Custos Gerais', false, 'custos')}
        {navItem('/vagas', Briefcase, 'Vagas & Recrutamento', false, 'vagas')}

        {can('mp') && (
          <div>
            <button
              className="nav-item"
              onClick={() => !collapsed && setMpOpen(o => !o)}
              title={collapsed ? 'Memorandos (MP)' : undefined}
              style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', justifyContent: collapsed ? 'center' : 'space-between' }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <FileText size={20} />
                {!collapsed && <span>Memorandos (MP)</span>}
              </span>
              {!collapsed && (
                <ChevronDown size={14} style={{ transform: mpOpen ? 'rotate(180deg)' : 'none', transition: '0.2s' }} />
              )}
            </button>

            {mpOpen && !collapsed && (
              <div style={{ paddingLeft: '1.5rem', marginTop: '0.25rem', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                <NavLink to="/mp/contratacao" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'} style={{ fontSize: '0.85rem' }}>
                  <span>Contratacao</span>
                </NavLink>
                <NavLink to="/mp/alteracao" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'} style={{ fontSize: '0.85rem' }}>
                  <span>Alteracao Cargo/Sal.</span>
                </NavLink>
              </div>
            )}
          </div>
        )}
      </nav>

      <div style={{
        marginTop: 'auto',
        padding: collapsed ? '1rem 0.5rem' : '1rem',
        borderTop: '1px solid var(--color-border)',
        display: 'flex',
        alignItems: 'center',
        gap: collapsed ? 0 : '0.75rem',
        justifyContent: collapsed ? 'center' : 'flex-start',
      }}>
        <div style={{
          width: '36px', height: '36px', borderRadius: '50%',
          background: 'var(--color-primary)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: 700, color: '#fff', fontSize: '0.9rem', flexShrink: 0,
        }}>
          {user?.email?.[0]?.toUpperCase() ?? 'U'}
        </div>
        {!collapsed && (
          <>
            <div style={{ flex: 1, overflow: 'hidden' }}>
              <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--color-text)', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {user?.email}
              </p>
              <p style={{ margin: 0, fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>Gestao de Pessoas</p>
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
          </>
        )}
      </div>
    </aside>
  );
};

export default Sidebar;
