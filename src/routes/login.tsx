import { createFileRoute, Navigate, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Hammer, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { resolveLoginEmail } from "@/lib/auth.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/login")({
  component: LoginPage,
  head: () => ({ meta: [{ title: "Entrar — ORDEX" }] }),
});

function LoginPage() {
  const navigate = useNavigate();
  const { session, loading: authLoading } = useAuth();
  const resolveEmail = useServerFn(resolveLoginEmail);
  const [loading, setLoading] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  if (!authLoading && session) return <Navigate to="/dashboard" />;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const u = username.trim().toLowerCase();
      // If user typed an email, use it directly; otherwise resolve username -> email
      let email = u;
      if (!u.includes("@")) {
        const r = await resolveEmail({ data: { username: u } });
        email = r.email;
      }
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      toast.success("Bem-vindo de volta!");
      navigate({ to: "/dashboard" });
    } catch (err: any) {
      const msg = err?.message ?? "Erro ao entrar";
      const isInvalid =
        msg.includes("Invalid login") ||
        msg.includes("inválidos") ||
        err?.status === 404;
      toast.error(isInvalid ? "Usuário ou senha inválidos" : msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      <div
        className="relative hidden lg:flex flex-col justify-between p-10 text-primary-foreground"
        style={{ background: "var(--gradient-hero)" }}
      >
        <div className="flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 backdrop-blur">
            <Hammer className="h-5 w-5" />
          </div>
          <span className="font-display text-lg font-semibold">ORDEX</span>
        </div>
        <div className="space-y-4 max-w-md">
          <h1 className="font-display text-4xl font-bold leading-tight">
            Transforme pedidos em vendas reais.
          </h1>
          <p className="text-primary-foreground/80">
            Organize seus clientes, acompanhe pedidos e venda mais com rapidez e praticidade.
          </p>
        </div>
        <p className="text-xs text-primary-foreground/60">© ORDEX</p>
      </div>

      <div className="flex items-center justify-center p-6 lg:p-10 bg-background">
        <div className="w-full max-w-sm">
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <Hammer className="h-5 w-5" />
            </div>
            <span className="font-display text-lg font-semibold">ORDEX</span>
          </div>

          <h2 className="font-display text-2xl font-bold">Acessar painel</h2>
          <p className="mt-1 text-sm text-muted-foreground">Entre com seu usuário e senha.</p>

          <form onSubmit={submit} className="mt-6 space-y-4">
            <div>
              <label className="text-sm font-medium">Usuário</label>
              <input
                type="text"
                required
                autoComplete="username"
                placeholder="Digite seu usuário"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Senha</label>
              <input
                type="password"
                required
                minLength={6}
                autoComplete="current-password"
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
              Entrar
            </button>
          </form>

          <p className="mt-6 text-xs text-center text-muted-foreground">
            Acesso restrito. Solicite cadastro a um administrador.
          </p>
        </div>
      </div>
    </div>
  );
}
