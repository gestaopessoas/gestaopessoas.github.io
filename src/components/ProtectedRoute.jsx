import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const ProtectedRoute = ({ children, module, action = 'view' }) => {
  const { user, loading, can } = useAuth();

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--color-bg)',
        color: 'var(--color-text-muted)',
        fontSize: '1.1rem',
        gap: '1rem'
      }}>
        <div style={{
          width: '24px', height: '24px',
          border: '3px solid var(--color-border)',
          borderTop: '3px solid var(--color-primary)',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite'
        }} />
        Carregando...
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!can(module, action)) {
    return <Navigate to="/" replace />;
  }

  return children;
};

export default ProtectedRoute;
