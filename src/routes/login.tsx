import { createFileRoute, Link, Navigate, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Hammer, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

export const Route = createFileRoute("/login")({
  component: LoginPage,
  head: () => ({ meta: [{ title: "Entrar — ObraGestor" }] }),
});

type Mode = "login" | "signup";

function LoginPage() {
  const navigate = useNavigate();
  const { session, loading: authLoading } = useAuth();
  const [mode, setMode] = useState<Mode>("login");
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");

  if (!authLoading && session) return <Navigate to="/dashboard" />;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Bem-vindo de volta!");
        navigate({ to: "/dashboard" });
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/dashboard`,
            data: { full_name: fullName, phone },
          },
        });
        if (error) throw error;
        toast.success("Conta criada! Verifique seu e-mail para confirmar.");
        setMode("login");
      }
    } catch (err: any) {
      const msg = err?.message ?? "Erro ao processar";
      toast.error(
        msg.includes("Invalid login") ? "E-mail ou senha inválidos" :
        msg.includes("already registered") ? "E-mail já cadastrado" :
        msg
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      <div className="relative hidden lg:flex flex-col justify-between p-10 text-primary-foreground" style={{ background: "var(--gradient-hero)" }}>
        <div className="flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 backdrop-blur">
            <Hammer className="h-5 w-5" />
          </div>
          <span className="font-display text-lg font-semibold">ObraGestor</span>
        </div>
        <div className="space-y-4 max-w-md">
          <h1 className="font-display text-4xl font-bold leading-tight">
            Da conversa no WhatsApp até a entrega na obra.
          </h1>
          <p className="text-primary-foreground/80">
            Crie orçamentos em segundos, envie ao cliente e acompanhe pedidos sem complicação.
          </p>
        </div>
        <p className="text-xs text-primary-foreground/60">© ObraGestor</p>
      </div>

      <div className="flex items-center justify-center p-6 lg:p-10 bg-background">
        <div className="w-full max-w-sm">
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <Hammer className="h-5 w-5" />
            </div>
            <span className="font-display text-lg font-semibold">ObraGestor</span>
          </div>

          <div className="flex gap-1 p-1 rounded-lg bg-muted mb-6">
            <button
              type="button"
              onClick={() => setMode("login")}
              className={`flex-1 rounded-md py-2 text-sm font-medium transition-colors ${mode === "login" ? "bg-background shadow-sm" : "text-muted-foreground"}`}
            >
              Entrar
            </button>
            <button
              type="button"
              onClick={() => setMode("signup")}
              className={`flex-1 rounded-md py-2 text-sm font-medium transition-colors ${mode === "signup" ? "bg-background shadow-sm" : "text-muted-foreground"}`}
            >
              Criar conta
            </button>
          </div>

          <h2 className="font-display text-2xl font-bold">
            {mode === "login" ? "Acessar painel" : "Criar sua conta"}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {mode === "login" ? "Entre com seu e-mail e senha." : "Preencha os dados para começar."}
          </p>

          <form onSubmit={submit} className="mt-6 space-y-4">
            {mode === "signup" && (
              <>
                <div>
                  <label className="text-sm font-medium">Nome completo</label>
                  <input
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="mt-1.5 w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Telefone (opcional)</label>
                  <input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="11999999999"
                    className="mt-1.5 w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                  />
                </div>
              </>
            )}
            <div>
              <label className="text-sm font-medium">E-mail</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Senha</label>
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-elevated hover:opacity-95 disabled:opacity-70"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {mode === "login" ? "Entrar" : "Criar conta"}
            </button>
          </form>

          {mode === "login" && (
            <p className="mt-4 text-xs text-center">
              <Link to="/forgot-password" className="text-primary font-medium hover:underline">
                Esqueci minha senha
              </Link>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
