import { createFileRoute, Navigate, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { signupCompany } from "@/lib/signup.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/cadastro")({
  component: CadastroPage,
  head: () => ({
    meta: [
      { title: "Criar conta — SaiuPedido" },
      {
        name: "description",
        content:
          "Comece o teste grátis de 14 dias do SaiuPedido. Cadastre seu restaurante em menos de 1 minuto.",
      },
    ],
  }),
});

function CadastroPage() {
  const { session, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const signup = useServerFn(signupCompany);

  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    restaurante: "",
    full_name: "",
    email: "",
    whatsapp: "",
    password: "",
    confirm: "",
  });

  if (!authLoading && session) {
    return <Navigate to="/" />;
  }

  const set = (k: keyof typeof form, v: string) =>
    setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;

    if (form.password.length < 6) {
      toast.error("A senha precisa ter pelo menos 6 caracteres");
      return;
    }
    if (form.password !== form.confirm) {
      toast.error("As senhas não conferem");
      return;
    }

    setLoading(true);
    try {
      const res = await signup({
        data: {
          restaurante: form.restaurante.trim(),
          full_name: form.full_name.trim(),
          email: form.email.trim().toLowerCase(),
          whatsapp: form.whatsapp.trim(),
          password: form.password,
        },
      });

      const { error: signErr } = await supabase.auth.signInWithPassword({
        email: res.email,
        password: form.password,
      });
      if (signErr) throw signErr;

      toast.success("Conta criada! Bem-vindo ao SaiuPedido.");
      navigate({ to: "/" });
    } catch (err: any) {
      console.error("[cadastro] signup failed", err);
      const raw =
        (typeof err?.message === "string" && err.message) ||
        (typeof err?.body === "string" && err.body) ||
        (typeof err === "string" && err) ||
        "";
      const friendly =
        raw.includes("já está cadastrado")
          ? "Este e-mail já está cadastrado"
          : raw.includes("Senha inválida")
            ? "Senha inválida. Use pelo menos 6 caracteres."
            : raw.includes("criar o restaurante")
              ? "Não foi possível criar o restaurante. Tente novamente."
              : raw.includes("criar o usuário")
                ? "Não foi possível criar o usuário. Tente novamente."
                : raw.includes("vincular usuário")
                  ? "Não foi possível vincular o usuário à empresa."
                  : raw.includes("permissões")
                    ? "Não foi possível atribuir permissões à conta."
                    : "Não foi possível criar sua conta. Tente novamente.";
      toast.error(friendly);
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
        <div className="flex items-baseline">
          <span className="brand-wordmark text-2xl text-white">SaiuPedido</span>
        </div>
        <div className="space-y-4 max-w-md">
          <p className="inline-flex items-center gap-2 text-xs uppercase tracking-wider text-primary-foreground/70">
            <span className="realtime-dot" /> 14 dias grátis
          </p>
          <h1 className="font-display text-4xl font-bold leading-tight">
            Comece a vender mais hoje mesmo.
          </h1>
          <p className="text-primary-foreground/80">
            Cadastre seu restaurante em menos de 1 minuto. Sem cartão de crédito, sem compromisso.
          </p>
          <ul className="space-y-2 text-sm text-primary-foreground/80">
            <li>✓ Pedidos em tempo real</li>
            <li>✓ Cardápio digital próprio</li>
            <li>✓ Gestão de mesas, delivery e retirada</li>
            <li>✓ Suporte humanizado</li>
          </ul>
        </div>
        <p className="text-xs text-primary-foreground/60">© SaiuPedido</p>
      </div>

      <div className="flex items-center justify-center p-6 lg:p-10 bg-background">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex items-baseline mb-8">
            <span className="brand-wordmark text-2xl text-foreground">SaiuPedido</span>
          </div>

          <h2 className="font-display text-2xl font-bold">Criar sua conta</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Teste grátis por 14 dias. Não pedimos cartão.
          </p>

          <form onSubmit={submit} className="mt-6 space-y-4">
            <Section title="Restaurante">
              <Field
                label="Nome do restaurante"
                value={form.restaurante}
                onChange={(v) => set("restaurante", v)}
                placeholder="Ex: Burger House"
                required
                minLength={2}
                maxLength={120}
              />
            </Section>

            <Section title="Responsável">
              <Field
                label="Nome completo"
                value={form.full_name}
                onChange={(v) => set("full_name", v)}
                placeholder="Seu nome"
                autoComplete="name"
                required
                minLength={2}
                maxLength={120}
              />
            </Section>

            <Section title="Acesso">
              <Field
                label="E-mail"
                type="email"
                value={form.email}
                onChange={(v) => set("email", v)}
                placeholder="voce@restaurante.com"
                autoComplete="email"
                required
              />
              <Field
                label="WhatsApp"
                value={form.whatsapp}
                onChange={(v) => set("whatsapp", v)}
                placeholder="(11) 99999-9999"
                autoComplete="tel"
                required
                minLength={8}
              />
              <Field
                label="Senha"
                type="password"
                value={form.password}
                onChange={(v) => set("password", v)}
                placeholder="Mínimo 6 caracteres"
                autoComplete="new-password"
                required
                minLength={6}
              />
              <Field
                label="Confirmar senha"
                type="password"
                value={form.confirm}
                onChange={(v) => set("confirm", v)}
                placeholder="Repita a senha"
                autoComplete="new-password"
                required
                minLength={6}
              />
            </Section>

            <button
              type="submit"
              disabled={loading}
              className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-glow-brand hover:brightness-110 disabled:opacity-70 transition-all"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Criar conta e começar teste grátis
            </button>
          </form>

          <p className="mt-6 text-xs text-center text-muted-foreground">
            Já tem conta?{" "}
            <a href="/login" className="text-primary font-medium hover:underline">
              Entrar
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </h3>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  ...rest
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type">) {
  return (
    <div>
      <label className="text-sm font-medium">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1.5 w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
        {...rest}
      />
    </div>
  );
}
