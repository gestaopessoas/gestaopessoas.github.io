import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';

const AuthContext = createContext({});
const ADMIN_LEVEL = 50;

const parsePermissions = (permissions) => {
  if (!permissions) return {};
  if (typeof permissions === 'string') {
    try {
      return JSON.parse(permissions);
    } catch {
      return {};
    }
  }
  return permissions;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (userId) => {
    if (!userId) {
      setUserProfile(null);
      return;
    }
    // Usamos limit(1) ao invés de maybeSingle() para evitar erros 406 Not Acceptable no console do navegador
    let { data: profileData } = await supabase.from('profiles').select('*').eq('id', userId).limit(1);
    let data = profileData?.[0] || null;
    if (data) {
      setUserProfile(data);
    } else {
      setUserProfile(null);
    }
  };

  useEffect(() => {
    // Recupera a sessão atual ao carregar
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    // Escuta mudanças de autenticação (login/logout)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
      } else {
        setUserProfile(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUserProfile(null);
  };

  const refreshProfile = async () => {
    if (user) {
      await fetchProfile(user.id);
    }
  };

  const can = (module, action = 'view') => {
    if (!module) return true;
    if (userProfile?.level >= ADMIN_LEVEL) return true;
    const permissions = parsePermissions(userProfile?.permissions);
    if (!Object.keys(permissions).length) return true;
    return Boolean(permissions[module]?.[action]);
  };

  return (
    <AuthContext.Provider value={{ user, userProfile, loading, signIn, signOut, refreshProfile, can }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
