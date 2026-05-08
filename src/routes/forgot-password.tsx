import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Hammer, Loader2, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/forgot-password")({
  component: ForgotPasswordPage,
  head: () => ({ meta: [{ title: "Recuperar senha — ORDEX" }] }),
});

function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      setSent(true);
      toast.success("E-mail enviado!");
    } catch (err: any) {
      toast.error(err?.message ?? "Erro ao enviar e-mail");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-2 mb-8">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Hammer className="h-5 w-5" />
          </div>
          <span className="font-display text-lg font-semibold">ORDEX</span>
        </div>

        <h2 className="font-display text-2xl font-bold">Recuperar senha</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Enviaremos um link para você criar uma nova senha.
        </p>

        {sent ? (
          <div className="mt-6 rounded-lg border border-border bg-card p-4 text-sm">
            Verifique sua caixa de entrada em <strong>{email}</strong>. O link expira em 1 hora.
          </div>
        ) : (
          <form onSubmit={submit} className="mt-6 space-y-4">
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
            <button
              type="submit"
              disabled={loading}
              className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-elevated disabled:opacity-70"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Enviar link
            </button>
          </form>
        )}

        <Link to="/login" className="mt-6 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> Voltar para login
        </Link>
      </div>
    </div>
  );
}
