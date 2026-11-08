import React, { createContext, useContext, useEffect, useState } from 'react';
import { Profile } from '../types';
import { LocalStore } from '../lib/storage';
import { apiGet, apiPost } from '../lib/api';

interface AuthContextType {
  user: Profile | null;
  role: Profile['role'] | null;
  isAuthenticated: boolean;
  loginAs: (profile: Profile) => void;
  loginWithCredentials: (
    identifier: string,
    pass: string,
    expectedRole?: Profile['role'],
  ) => Promise<{ success: boolean; error?: string; profile?: Profile }>;
  logout: () => void;
  isBackendLive: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);
const AUTH_TOKEN_KEY = 'bba_auth_token';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<Profile | null>(() =>
    localStorage.getItem('bba_demo_session') ? LocalStore.getCurrentUser() : null
  );
  const [isBackendLive, setIsBackendLive] = useState(false);

  useEffect(() => {
    let active = true;
    void apiGet('/health').then(() => {
      if (active) setIsBackendLive(true);
    }).catch(() => {
      if (active) setIsBackendLive(false);
    });

    const token = localStorage.getItem(AUTH_TOKEN_KEY);
    if (token) {
      void apiGet<{ user: Profile }>('/auth/me', token).then(({ user: profile }) => {
        if (!active) return;
        setUser(profile);
        LocalStore.setCurrentUser(profile);
      }).catch(() => {
        if (!active) return;
        localStorage.removeItem(AUTH_TOKEN_KEY);
        setUser(null);
        LocalStore.setCurrentUser(null);
      });
    }

    return () => { active = false; };
  }, []);

  const loginAs = (profile: Profile) => {
    localStorage.removeItem(AUTH_TOKEN_KEY);
    setUser(profile);
    LocalStore.setCurrentUser(profile);
    localStorage.setItem('bba_demo_session', 'true');
  };

  const loginWithCredentials = async (
    identifier: string,
    pass: string,
    expectedRole?: Profile['role'],
  ): Promise<{ success: boolean; error?: string; profile?: Profile }> => {
    try {
      const { token, user: profile } = await apiPost<{ token: string; user: Profile }>('/auth/login', {
        identifier,
        password: pass,
        expected_role: expectedRole,
      });
      localStorage.setItem(AUTH_TOKEN_KEY, token);
      localStorage.removeItem('bba_demo_session');
      setUser(profile);
      LocalStore.setCurrentUser(profile);
      return { success: true, profile };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Sign in is unavailable. Try again shortly.',
      };
    }
  };

  const logout = () => {
    const token = localStorage.getItem(AUTH_TOKEN_KEY);
    if (token) {
      void apiPost('/auth/logout', {}, token).catch(error => {
        console.error('Unable to revoke the sign-in token:', error);
      });
    }
    localStorage.removeItem(AUTH_TOKEN_KEY);
    localStorage.removeItem('bba_demo_session');
    setUser(null);
    LocalStore.setCurrentUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        role: user?.role || null,
        isAuthenticated: !!user,
        loginAs,
        loginWithCredentials,
        logout,
        isBackendLive,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
