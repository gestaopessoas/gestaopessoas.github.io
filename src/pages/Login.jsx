import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';

const Login = () => {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const { error } = await signIn(email, password);

    if (error) {
      setError('E-mail ou senha inválidos. Tente novamente.');
    }

    setLoading(false);
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--color-bg)',
      padding: '2rem',
    }}>
      {/* Fundo decorativo */}
      <div style={{
        position: 'fixed', inset: 0, zIndex: 0,
        background: 'radial-gradient(ellipse at 30% 20%, rgba(245,174,56,0.12) 0%, transparent 60%), radial-gradient(ellipse at 80% 80%, rgba(114,115,118,0.1) 0%, transparent 60%)',
        pointerEvents: 'none'
      }} />

      <div style={{
        position: 'relative', zIndex: 1,
        width: '100%',
        maxWidth: '420px',
      }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <img src="/images/logo.png" alt="ACPO" style={{ height: '60px', marginBottom: '1rem' }} />
          <h1 style={{ fontSize: '1.5rem', color: 'var(--color-text)', margin: 0 }}>
            Portal de Gestão de Pessoas
          </h1>
          <p style={{ color: 'var(--color-text-muted)', marginTop: '0.5rem', fontSize: '0.95rem' }}>
            Faça login para continuar
          </p>
        </div>

        {/* Card de Login */}
        <div style={{
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-lg)',
          padding: '2.5rem',
          boxShadow: 'var(--shadow-lg)',
          backdropFilter: 'blur(12px)',
        }}>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div>
              <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.5rem', fontSize: '0.9rem' }}>
                E-mail
              </label>
              <input
                id="login-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="seu@email.com"
                style={{
                  width: '100%',
                  padding: '0.75rem 1rem',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-border)',
                  background: 'var(--color-bg)',
                  color: 'var(--color-text)',
                  fontSize: '1rem',
                  boxSizing: 'border-box',
                  transition: 'border-color 0.2s',
                  outline: 'none',
                }}
                onFocus={(e) => e.target.style.borderColor = 'var(--color-primary)'}
                onBlur={(e) => e.target.style.borderColor = 'var(--color-border)'}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.5rem', fontSize: '0.9rem' }}>
                Senha
              </label>
              <input
                id="login-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                style={{
                  width: '100%',
                  padding: '0.75rem 1rem',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-border)',
                  background: 'var(--color-bg)',
                  color: 'var(--color-text)',
                  fontSize: '1rem',
                  boxSizing: 'border-box',
                  transition: 'border-color 0.2s',
                  outline: 'none',
                }}
                onFocus={(e) => e.target.style.borderColor = 'var(--color-primary)'}
                onBlur={(e) => e.target.style.borderColor = 'var(--color-border)'}
              />
            </div>

            {error && (
              <div style={{
                background: 'rgba(239,68,68,0.1)',
                border: '1px solid rgba(239,68,68,0.3)',
                color: '#ef4444',
                borderRadius: 'var(--radius-md)',
                padding: '0.75rem 1rem',
                fontSize: '0.9rem',
              }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                padding: '0.85rem',
                background: loading ? 'var(--color-border)' : 'var(--color-primary)',
                color: '#fff',
                border: 'none',
                borderRadius: 'var(--radius-md)',
                fontSize: '1rem',
                fontWeight: 700,
                cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s',
                marginTop: '0.5rem',
              }}
            >
              {loading ? 'Entrando...' : 'Entrar'}
            </button>
          </form>
        </div>

        <p style={{ textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.8rem', marginTop: '1.5rem' }}>
          ACPO Empreendimentos © {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
};

export default Login;
