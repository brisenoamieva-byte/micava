"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";

type AuthContextValue = {
  configured: boolean;
  ready: boolean;
  session: Session | null;
  user: User | null;
  displayName: string | null;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const configured = isSupabaseConfigured();
  const [ready, setReady] = useState(!configured);
  const [session, setSession] = useState<Session | null>(null);
  const [displayName, setDisplayName] = useState<string | null>(null);

  const loadProfile = useCallback(async (userId: string, fallbackName?: string | null) => {
    if (!configured) return;
    const supabase = createClient();
    const { data } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("id", userId)
      .maybeSingle();
    setDisplayName(data?.display_name || fallbackName || null);
  }, [configured]);

  useEffect(() => {
    if (!configured) {
      setReady(true);
      return;
    }

    const supabase = createClient();

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (data.session?.user) {
        const meta = data.session.user.user_metadata ?? {};
        const fallback =
          (meta.display_name as string | undefined) ||
          (meta.full_name as string | undefined) ||
          (meta.name as string | undefined) ||
          null;
        void loadProfile(data.session.user.id, fallback);
      }
      setReady(true);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      if (next?.user) {
        const meta = next.user.user_metadata ?? {};
        const fallback =
          (meta.display_name as string | undefined) ||
          (meta.full_name as string | undefined) ||
          (meta.name as string | undefined) ||
          null;
        void loadProfile(next.user.id, fallback);
      } else {
        setDisplayName(null);
      }
    });

    return () => subscription.unsubscribe();
  }, [configured, loadProfile]);

  const signOut = useCallback(async () => {
    if (!configured) return;
    const supabase = createClient();
    await supabase.auth.signOut();
    setSession(null);
    setDisplayName(null);
  }, [configured]);

  const refreshProfile = useCallback(async () => {
    if (session?.user) {
      const meta = session.user.user_metadata ?? {};
      const fallback =
        (meta.display_name as string | undefined) ||
        (meta.full_name as string | undefined) ||
        (meta.name as string | undefined) ||
        null;
      await loadProfile(session.user.id, fallback);
    }
  }, [loadProfile, session?.user]);

  const value = useMemo(
    () => ({
      configured,
      ready,
      session,
      user: session?.user ?? null,
      displayName,
      signOut,
      refreshProfile,
    }),
    [configured, ready, session, displayName, signOut, refreshProfile]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
