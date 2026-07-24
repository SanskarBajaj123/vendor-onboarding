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

const log = (...args: unknown[]) => console.log("[Auth]", ...args);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<Role | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    log("useEffect: calling getSession()");
    supabase.auth.getSession().then(({ data, error }) => {
      log("getSession() result:", {
        hasSession: !!data.session,
        userId: data.session?.user?.id,
        email: data.session?.user?.email,
        error,
      });
      setSession(data.session);
      loadRole(data.session, "getSession");
    });

    const { data: listener } = supabase.auth.onAuthStateChange((event, newSession) => {
      log("onAuthStateChange:", event, {
        hasSession: !!newSession,
        userId: newSession?.user?.id,
        email: newSession?.user?.email,
      });
      setSession(newSession);
      loadRole(newSession, `authChange:${event}`);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  async function loadRole(currentSession: Session | null, source: string) {
    log(`loadRole [${source}]:`, currentSession ? `user=${currentSession.user.email}` : "null session");

    if (!currentSession) {
      log(`loadRole [${source}]: no session → setting role=null, loading=false`);
      setRole(null);
      setLoading(false);
      return;
    }

    log(`loadRole [${source}]: querying profiles for id=${currentSession.user.id}`);
    let { data, error } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", currentSession.user.id)
      .single();

    log(`loadRole [${source}]: profiles result:`, { data, errorCode: error?.code, errorMsg: error?.message });

    if ((error || !data) && sessionStorage.getItem("new_signup") === "1") {
      log(`loadRole [${source}]: new_signup flag set and no profile — waiting 1s and retrying`);
      await new Promise((r) => setTimeout(r, 1000));
      ({ data, error } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", currentSession.user.id)
        .single());
      log(`loadRole [${source}]: retry result:`, { data, errorCode: error?.code, errorMsg: error?.message });
    }

    if (error || !data) {
      log(`loadRole [${source}]: still no profile after retry — signing out locally`);
      await supabase.auth.signOut({ scope: "local" });
      setSession(null);
      setRole(null);
      setLoading(false);
      return;
    }

    log(`loadRole [${source}]: setting role=${data.role}`);
    setRole(data.role as Role);
    setLoading(false);
  }

  async function signOut() {
    log("signOut() called by user");
    sessionStorage.removeItem("new_signup");
    await supabase.auth.signOut({ scope: "local" });
    log("signOut() complete — reloading page");
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
