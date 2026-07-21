import { useState, useEffect } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

// Local-only identity for the standalone desktop app and explicit developer mode.
const createLocalSession = (): Session => ({
  access_token: 'rtpt-local-session',
  refresh_token: 'rtpt-local-refresh',
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  token_type: 'bearer',
  user: {
    id: '00000000-0000-0000-0000-000000000000',
    email: 'local@rtpt-inspector.invalid',
    aud: 'authenticated',
    role: 'authenticated',
    created_at: new Date().toISOString(),
    app_metadata: {},
    user_metadata: { full_name: 'Local RT-PT User' },
  } as User,
});

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const isElectron = typeof window !== 'undefined' && window.electron?.isElectron === true;
    const allowExplicitDevAuth = import.meta.env.DEV && import.meta.env.VITE_RTPT_ENABLE_DEV_AUTH === 'true';

    if (isElectron || allowExplicitDevAuth) {
      const localSession = createLocalSession();
      setSession(localSession);
      setUser(localSession.user);
      setLoading(false);
      return;
    }

    // If not in dev mode, use real authentication
    // Set up auth state listener first
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    // Then check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    if (session?.access_token === 'rtpt-local-session') return;
    await supabase.auth.signOut();
  };

  return { user, session, loading, signOut };
}
