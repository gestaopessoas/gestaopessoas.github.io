import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Lock, Shirt, Map, Gift } from 'lucide-react';

const Sidebar = () => {
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
    </aside>
  );
};

export default Sidebar;
