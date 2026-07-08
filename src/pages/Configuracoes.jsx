import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../supabaseClient';
import { User, Lock, Save, Plus, Shield, Check, Trash2, Edit } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';

const MODULES = [
  { key: 'colaboradores', label: 'Colaboradores' },
  { key: 'arquivo_morto', label: 'Arquivo Morto' },
  { key: 'armarios', label: 'Armários' },
  { key: 'uniformes', label: 'Uniformes' },
  { key: 'ilhas', label: 'Ilhas' },
  { key: 'ponto', label: 'Controle de Ponto' },
  { key: 'rgs', label: 'RGS' },
  { key: 'custos', label: 'Custos' },
  { key: 'mp', label: 'Movimentação (MP)' }
];

const ACTIONS = [
  { key: 'view', label: 'Visualizar' },
  { key: 'edit', label: 'Editar' },
  { key: 'create', label: 'Criar' },
  { key: 'delete', label: 'Apagar' }
];

const Configuracoes = () => {
  const { user, userProfile, refreshProfile } = useAuth();
  const [searchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') === 'usuarios' && userProfile?.level >= 50 ? 'usuarios' : 'perfil';
  const [activeTab, setActiveTab] = useState(initialTab);

  // Perfil state
  const [profileForm, setProfileForm] = useState({ name: '', avatar_url: '' });
  const [passwordForm, setPasswordForm] = useState({ newPassword: '', confirmPassword: '' });
  const [savingProfile, setSavingProfile] = useState(false);

  // Gestão Usuários state
  const [usersList, setUsersList] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [showNewUserModal, setShowNewUserModal] = useState(false);
  const [creatingUser, setCreatingUser] = useState(false);
  const [newUserForm, setNewUserForm] = useState({
    name: '', email: '', password: '', level: 1, permissions: {}
  });

  useEffect(() => {
    if (userProfile) {
      setProfileForm({ name: userProfile.name || '', avatar_url: userProfile.avatar_url || '' });
    }
  }, [userProfile]);

  useEffect(() => {
    if (activeTab === 'usuarios' && userProfile?.level >= 50) {
      fetchUsers();
    }
  }, [activeTab]);

  const fetchUsers = async () => {
    setLoadingUsers(true);
    const { data } = await supabase.from('profiles').select('*').order('level', { ascending: false });
    if (data) setUsersList(data);
    setLoadingUsers(false);
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setSavingProfile(true);
    const { error } = await supabase.from('profiles').update(profileForm).eq('id', user.id);
    if (!error) {
      await refreshProfile();
      alert('Perfil atualizado com sucesso!');
    } else {
      alert('Erro ao atualizar perfil: ' + error.message);
    }
    setSavingProfile(false);
  };

  const handleUpdatePassword = async (e) => {
    e.preventDefault();
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      return alert('As senhas não coincidem!');
    }
    setSavingProfile(true);
    const { error } = await supabase.auth.updateUser({ password: passwordForm.newPassword });
    if (!error) {
      alert('Senha atualizada com sucesso!');
      setPasswordForm({ newPassword: '', confirmPassword: '' });
    } else {
      alert('Erro ao atualizar senha: ' + error.message);
    }
    setSavingProfile(false);
  };

  const handlePermissionToggle = (modKey, actKey) => {
    setNewUserForm(prev => {
      const currentPerms = { ...prev.permissions };
      if (!currentPerms[modKey]) currentPerms[modKey] = { view: false, edit: false, create: false, delete: false };
      currentPerms[modKey][actKey] = !currentPerms[modKey][actKey];
      return { ...prev, permissions: currentPerms };
    });
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    if (newUserForm.level > userProfile.level) {
      return alert('Você não pode criar um usuário com nível superior ao seu.');
    }
    
    setCreatingUser(true);
    try {
      // Calling the Edge Function
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-user`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify(newUserForm)
      });
      
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Erro desconhecido ao criar usuário');
      
      alert('Usuário criado com sucesso!');
      setShowNewUserModal(false);
      setNewUserForm({ name: '', email: '', password: '', level: 1, permissions: {} });
      fetchUsers();
    } catch (error) {
      alert('Erro: ' + error.message);
    }
    setCreatingUser(false);
  };

  const inputStyle = { width: '100%', padding: '0.6rem 0.8rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-text)', boxSizing: 'border-box' };
  const labelStyle = { display: 'block', marginBottom: '0.3rem', fontWeight: 600, fontSize: '0.8rem', color: 'var(--color-text-muted)', textTransform: 'uppercase' };

  return (
    <div className="glass-panel p-4 fade-in" style={{ maxWidth: '1000px', margin: '0 auto' }}>
      <div style={{ marginBottom: '1.5rem', borderBottom: '1px solid var(--color-border)', display: 'flex', gap: '1rem' }}>
        <button onClick={() => setActiveTab('perfil')}
          style={{ padding: '0.8rem 1.5rem', border: 'none', background: 'none', fontWeight: activeTab === 'perfil' ? 700 : 500, color: activeTab === 'perfil' ? 'var(--color-primary)' : 'var(--color-text-muted)', borderBottom: activeTab === 'perfil' ? '2px solid var(--color-primary)' : '2px solid transparent', cursor: 'pointer', fontSize: '1rem' }}>
          Meu Perfil
        </button>
        {userProfile?.level >= 50 && (
          <button onClick={() => setActiveTab('usuarios')}
            style={{ padding: '0.8rem 1.5rem', border: 'none', background: 'none', fontWeight: activeTab === 'usuarios' ? 700 : 500, color: activeTab === 'usuarios' ? 'var(--color-primary)' : 'var(--color-text-muted)', borderBottom: activeTab === 'usuarios' ? '2px solid var(--color-primary)' : '2px solid transparent', cursor: 'pointer', fontSize: '1rem' }}>
            Gestão de Usuários
          </button>
        )}
      </div>

      {activeTab === 'perfil' && (
        <div style={{ display: 'grid', gap: '2rem', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}>
          {/* Dados Pessoais */}
          <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: '1.5rem' }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: '0 0 1.5rem' }}><User size={20} /> Informações Pessoais</h3>
            <form onSubmit={handleSaveProfile} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={labelStyle}>Nome Completo</label>
                <input type="text" value={profileForm.name} onChange={e => setProfileForm({...profileForm, name: e.target.value})} style={inputStyle} required />
              </div>
              <div>
                <label style={labelStyle}>E-mail</label>
                <input type="email" value={user?.email || ''} style={{...inputStyle, background: 'var(--color-bg)', opacity: 0.7}} disabled />
                <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>O e-mail de login não pode ser alterado por aqui.</span>
              </div>
              <div>
                <label style={labelStyle}>URL da Foto (Avatar)</label>
                <input type="url" value={profileForm.avatar_url} onChange={e => setProfileForm({...profileForm, avatar_url: e.target.value})} placeholder="https://..." style={inputStyle} />
              </div>
              <button type="submit" disabled={savingProfile} className="btn-primary" style={{ marginTop: '0.5rem', alignSelf: 'flex-start' }}>
                <Save size={16} /> Salvar Perfil
              </button>
            </form>
          </div>

          {/* Segurança */}
          <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: '1.5rem' }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: '0 0 1.5rem' }}><Lock size={20} /> Segurança</h3>
            <form onSubmit={handleUpdatePassword} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={labelStyle}>Nova Senha</label>
                <input type="password" value={passwordForm.newPassword} onChange={e => setPasswordForm({...passwordForm, newPassword: e.target.value})} style={inputStyle} required minLength={6} />
              </div>
              <div>
                <label style={labelStyle}>Confirmar Nova Senha</label>
                <input type="password" value={passwordForm.confirmPassword} onChange={e => setPasswordForm({...passwordForm, confirmPassword: e.target.value})} style={inputStyle} required minLength={6} />
              </div>
              <button type="submit" disabled={savingProfile} className="btn-primary" style={{ marginTop: '0.5rem', alignSelf: 'flex-start', background: '#3b82f6' }}>
                <Shield size={16} /> Alterar Senha
              </button>
            </form>
          </div>
        </div>
      )}

      {activeTab === 'usuarios' && userProfile?.level >= 50 && (
        <div>
          <div className="flex-between" style={{ marginBottom: '1.5rem' }}>
            <div>
              <h2 style={{ margin: 0 }}>Usuários e Permissões</h2>
              <p style={{ margin: 0, color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>Gerencie acessos e níveis do sistema.</p>
            </div>
            <button className="btn-primary" onClick={() => setShowNewUserModal(true)}>
              <Plus size={16} /> Novo Usuário
            </button>
          </div>

          {loadingUsers ? <p>Carregando usuários...</p> : (
            <div style={{ overflowX: 'auto', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem', background: 'var(--color-surface)' }}>
                <thead style={{ background: 'var(--color-bg)', borderBottom: '2px solid var(--color-border)' }}>
                  <tr>
                    <th style={{ padding: '1rem' }}>Nome</th>
                    <th style={{ padding: '1rem' }}>Nível</th>
                    <th style={{ padding: '1rem' }}>Cadastrado em</th>
                    <th style={{ padding: '1rem', textAlign: 'right' }}>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {usersList.map(u => (
                    <tr key={u.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                      <td style={{ padding: '1rem', fontWeight: 600 }}>{u.name}</td>
                      <td style={{ padding: '1rem' }}>
                        <span style={{ background: u.level >= 50 ? 'rgba(245,158,11,0.1)' : 'rgba(34,197,94,0.1)', color: u.level >= 50 ? '#f59e0b' : '#16a34a', padding: '0.2rem 0.6rem', borderRadius: '999px', fontSize: '0.8rem', fontWeight: 700 }}>
                          Level {u.level}
                        </span>
                      </td>
                      <td style={{ padding: '1rem', color: 'var(--color-text-muted)' }}>{new Date(u.created_at).toLocaleDateString()}</td>
                      <td style={{ padding: '1rem', textAlign: 'right' }}>
                        {/* Apenas visual por enquanto */}
                        <button disabled style={{ padding: '0.4rem', border: 'none', background: 'none', color: 'var(--color-text-muted)', opacity: 0.5 }} title="Em breve">
                          <Edit size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Modal Novo Usuário */}
      {showNewUserModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div className="fade-in" style={{ background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', width: '100%', maxWidth: '800px', maxHeight: '90vh', overflowY: 'auto', border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-xl)' }}>
            <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--color-border)', background: 'var(--color-bg)', display: 'flex', justifyContent: 'space-between' }}>
              <h3 style={{ margin: 0, color: 'var(--color-text)' }}>Cadastrar Novo Usuário</h3>
              <button onClick={() => setShowNewUserModal(false)} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '1.5rem', lineHeight: 1, color: 'var(--color-text-muted)' }}>&times;</button>
            </div>
            
            <form onSubmit={handleCreateUser} style={{ padding: '1.5rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
                <div>
                  <label style={labelStyle}>Nome Completo</label>
                  <input type="text" value={newUserForm.name} onChange={e => setNewUserForm({...newUserForm, name: e.target.value})} style={inputStyle} required />
                </div>
                <div>
                  <label style={labelStyle}>E-mail</label>
                  <input type="email" value={newUserForm.email} onChange={e => setNewUserForm({...newUserForm, email: e.target.value})} style={inputStyle} required />
                </div>
                <div>
                  <label style={labelStyle}>Senha Inicial</label>
                  <input type="text" value={newUserForm.password} onChange={e => setNewUserForm({...newUserForm, password: e.target.value})} style={inputStyle} required minLength={6} placeholder="Mín. 6 caracteres" />
                </div>
                <div>
                  <label style={labelStyle}>Nível Hierárquico (Máx: {userProfile.level})</label>
                  <input type="number" value={newUserForm.level} onChange={e => setNewUserForm({...newUserForm, level: parseInt(e.target.value)})} style={inputStyle} min={1} max={userProfile.level} required />
                </div>
              </div>

              <h4 style={{ margin: '0 0 1rem', borderBottom: '2px solid var(--color-border)', paddingBottom: '0.5rem' }}>Permissões de Módulos</h4>
              <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', marginBottom: '1rem' }}>Marque as ações que este usuário poderá realizar em cada módulo.</p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr', padding: '0.5rem 1rem', background: 'var(--color-bg)', fontWeight: 600, fontSize: '0.85rem', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
                  <div>Módulo</div>
                  {ACTIONS.map(a => <div key={a.key} style={{ textAlign: 'center' }}>{a.label}</div>)}
                </div>

                {MODULES.map(mod => (
                  <div key={mod.key} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr', padding: '0.75rem 1rem', borderBottom: '1px solid var(--color-border)', alignItems: 'center' }}>
                    <div style={{ fontWeight: 500 }}>{mod.label}</div>
                    {ACTIONS.map(act => {
                      const isChecked = newUserForm.permissions[mod.key]?.[act.key] || false;
                      return (
                        <div key={act.key} style={{ display: 'flex', justifyContent: 'center' }}>
                          <input 
                            type="checkbox" 
                            checked={isChecked}
                            onChange={() => handlePermissionToggle(mod.key, act.key)}
                            style={{ width: '18px', height: '18px', accentColor: 'var(--color-primary)', cursor: 'pointer' }}
                          />
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', marginTop: '2rem' }}>
                <button type="button" onClick={() => setShowNewUserModal(false)} className="btn-secondary">Cancelar</button>
                <button type="submit" disabled={creatingUser} className="btn-primary">
                  {creatingUser ? 'Cadastrando...' : 'Confirmar e Criar Acesso'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Configuracoes;
