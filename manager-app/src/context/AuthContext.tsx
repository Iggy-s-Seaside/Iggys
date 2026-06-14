import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import type { Role } from '../hooks/useRole';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  /** Permission tier: owner | manager | employee. Fail-closed to 'employee'. */
  role: Role;
  /** False until the role RPC has resolved — role guards must wait on this so an
   *  owner isn't briefly treated as 'employee' and bounced on first load. */
  roleResolved: boolean;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<Role>('employee');
  const [roleResolved, setRoleResolved] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    // Resolve the caller's role from the DB (SECURITY DEFINER RPC reads auth.email()
    // from the JWT). Fail-closed to 'employee'. Hydrates async; role guards wait on
    // roleResolved so an owner isn't briefly seen as 'employee' and bounced.
    const applyRole = async (s: Session | null) => {
      if (!s?.user) { if (mounted) { setRole('employee'); setRoleResolved(true); } return; }
      if (mounted) setRoleResolved(false);
      const { data, error } = await supabase.rpc('get_my_role');
      if (!mounted) return;
      setRole(!error && (data === 'owner' || data === 'manager' || data === 'employee') ? data : 'employee');
      setRoleResolved(true);
    };

    supabase.auth.getSession().then(({ data: { session: s } }) => {
      if (!mounted) return;
      setSession(s);
      setUser(s?.user ?? null);
      setLoading(false);
      void applyRole(s);
    }).catch(() => {
      if (!mounted) return;
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      if (!mounted) return;
      setSession(s);
      setUser(s?.user ?? null);
      setLoading(false);
      void applyRole(s);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, session, role, roleResolved, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
