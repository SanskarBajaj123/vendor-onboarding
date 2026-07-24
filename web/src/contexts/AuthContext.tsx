import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";

type Role = "vendor" | "employee";

interface AuthState {
  session: Session | null;
  role: Role | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<Role | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      loadRole(data.session);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      loadRole(newSession);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  async function loadRole(currentSession: Session | null) {
    if (!currentSession) {
      setRole(null);
      setLoading(false);
      return;
    }

    let { data, error } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", currentSession.user.id)
      .single();

    // New signups hit a race condition: the DB trigger that creates the
    // profile row runs async, so the row may not exist yet on the first
    // onAuthStateChange fire. Retry once after a short wait.
    if ((error || !data) && sessionStorage.getItem("new_signup") === "1") {
      await new Promise((r) => setTimeout(r, 1000));
      ({ data, error } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", currentSession.user.id)
        .single());
    }

    if (error || !data) {
      // Genuinely no profile — clear session locally only (no API call, no
      // page reload) so we don't interrupt a signup flow in progress.
      await supabase.auth.signOut({ scope: "local" });
      setSession(null);
      setRole(null);
      setLoading(false);
      return;
    }

    setRole(data.role as Role);
    setLoading(false);
  }

  async function signOut() {
    await supabase.auth.signOut({ scope: "local" });
    // Full page reload flushes the Supabase client's in-memory session
    // cache, ensuring a clean slate when signing in as a different account.
    window.location.replace("/");
  }

  return (
    <AuthContext.Provider value={{ session, role, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
