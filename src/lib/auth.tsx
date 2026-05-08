import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { type AppRole } from "./users.functions";

type AuthUser = {
  id: string;
  email: string;
  last_sign_in_at: string;
  profile: {
    full_name: string;
    company_id: string | null;
    company_name: string | null;
    role: AppRole | null;
  };
};

type AuthState = {
  user: AuthUser | null;
  role: AppRole | null;
  companyId: string | null;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  loading: boolean;
  isLoggedIn: boolean;
  refreshProfile: () => Promise<any>;
};

const AuthContext = createContext<AuthState | undefined>(undefined);

function getProfileFn() {
  return supabase.from("profiles").select("*, role:user_roles(role)").single();
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const { data: profile, refetch: refreshProfile } = useQuery({
    queryKey: ["profile"],
    queryFn: useServerFn(getProfileFn),
    enabled: !!user,
  });

  const profileData = profile?.data as any;

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setUser(session.user as any);
      }
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser((session?.user as any) ?? null);
        setLoading(false);
      },
    );

    return () => listener.subscription.unsubscribe();
  }, []);

  const isLoggedIn = !!user;
  const role = (profileData?.role?.[0]?.role as AppRole) ?? null;
  const companyId = profileData?.company_id ?? null;
  const isSuperAdmin = role === "super_admin";
  const isAdmin = isSuperAdmin || role === "admin";

  const value = {
    user,
    role,
    companyId,
    isAdmin,
    isSuperAdmin,
    loading,
    isLoggedIn,
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
