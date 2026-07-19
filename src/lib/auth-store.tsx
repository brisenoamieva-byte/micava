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
  updateDisplayName: (name: string) => Promise<{ error: string | null }>;
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

  const updateDisplayName = useCallback(
    async (name: string) => {
      const trimmed = name.trim();
      if (!configured || !session?.user) {
        return { error: "No hay sesión activa." };
      }
      if (!trimmed) {
        return { error: "Escribe un nombre." };
      }
      if (trimmed.length > 60) {
        return { error: "Máximo 60 caracteres." };
      }

      const supabase = createClient();
      const uid = session.user.id;

      const { data: existing } = await supabase
        .from("profiles")
        .select("id")
        .eq("id", uid)
        .maybeSingle();

      const { error: profileErr } = existing
        ? await supabase
            .from("profiles")
            .update({ display_name: trimmed })
            .eq("id", uid)
        : await supabase
            .from("profiles")
            .insert({ id: uid, display_name: trimmed });

      if (profileErr) {
        return { error: profileErr.message };
      }

      await supabase.auth.updateUser({
        data: { display_name: trimmed },
      });

      setDisplayName(trimmed);
      return { error: null };
    },
    [configured, session?.user]
  );

  const value = useMemo(
    () => ({
      configured,
      ready,
      session,
      user: session?.user ?? null,
      displayName,
      signOut,
      refreshProfile,
      updateDisplayName,
    }),
    [
      configured,
      ready,
      session,
      displayName,
      signOut,
      refreshProfile,
      updateDisplayName,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
