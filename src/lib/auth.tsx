import {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { type AppRole } from "./users.functions";

type Profile = {
  id: string;
  full_name: string;
  phone: string | null;
  company_id: string | null;
  active: boolean;
};

type AuthState = {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  role: AppRole | null;
  companyId: string | null;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  isAtendente: boolean;
  isCozinha: boolean;
  canSeeFinancials: boolean;
  loading: boolean;
  isLoggedIn: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthState | undefined>(undefined);

async function loadProfile(userId: string): Promise<{ profile: Profile | null; role: AppRole | null }> {
  const [{ data: profile }, { data: roleRow }] = await Promise.all([
    supabase.from("profiles").select("id, full_name, phone, company_id, active").eq("id", userId).maybeSingle(),
    supabase.from("user_roles").select("role").eq("user_id", userId).maybeSingle(),
  ]);
  return {
    profile: (profile as Profile | null) ?? null,
    role: (roleRow?.role as AppRole | undefined) ?? null,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshProfile = async () => {
    if (!session?.user?.id) {
      setProfile(null);
      setRole(null);
      return;
    }
    const { profile, role } = await loadProfile(session.user.id);
    setProfile(profile);
    setRole(role);
  };

  useEffect(() => {
    const { data: listener } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      if (s?.user) {
        loadProfile(s.user.id).then(({ profile, role }) => {
          setProfile(profile);
          setRole(role);
        });
      } else {
        setProfile(null);
        setRole(null);
      }
    });

    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      if (s?.user) {
        loadProfile(s.user.id).then(({ profile, role }) => {
          setProfile(profile);
          setRole(role);
          setLoading(false);
        });
      } else {
        setLoading(false);
      }
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setProfile(null);
    setRole(null);
  };

  const isSuperAdmin = role === "super_admin";
  const isAdmin = isSuperAdmin || role === "admin";
  const isAtendente = role === "atendente";
  const isCozinha = role === "cozinha";
  const canSeeFinancials = isAdmin;

  const value: AuthState = {
    session,
    user: session?.user ?? null,
    profile,
    role,
    companyId: profile?.company_id ?? null,
    isAdmin,
    isSuperAdmin,
    isAtendente,
    isCozinha,
    canSeeFinancials,
    loading,
    isLoggedIn: !!session,
    signOut,
    refreshProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
