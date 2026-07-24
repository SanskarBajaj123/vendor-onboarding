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
    const { data, error } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", currentSession.user.id)
      .single();

    if (error || !data) {
      // Session refers to a user with no profile row (e.g. deleted account,
      // or a stale token from before the profile was created). A session
      // with a permanently-null role would otherwise bounce forever between
      // routes that require a role and routes that redirect roleless users
      // away — so treat it as invalid and sign out instead.
      await supabase.auth.signOut();
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
    // Force a full page reload to flush the Supabase client's in-memory
    // session cache. Without this, the GoTrue client retains stale state
    // that prevents signing in as a different account in the same tab.
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
