import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  listUsers,
  createUser,
  setUserActive,
  setUserRole,
  type AppRole,
} from "@/lib/users.functions";
import { listCompanies } from "@/lib/companies.functions";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { Loader2, UserPlus, ShieldCheck, Power } from "lucide-react";

export const Route = createFileRoute("/_app/usuarios")({
  component: UsersPage,
  head: () => ({ meta: [{ title: "Usuários — ORDEX" }] }),
});

const ROLE_LABEL: Record<AppRole, string> = {
  super_admin: "Super Admin",
  admin: "Administrador",
  atendente: "Atendente",
  cozinha: "Cozinha",
};

function UsersPage() {
  const { isAdmin, isSuperAdmin, role, loading: authLoading } = useAuth();

  if (authLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!isAdmin && role !== null) return <Navigate to="/dashboard" />;

  return <UsersPanel isSuperAdmin={isSuperAdmin} />;
}

function UsersPanel({ isSuperAdmin }: { isSuperAdmin: boolean }) {
  const qc = useQueryClient();
  const fetchUsers = useServerFn(listUsers);
  const fetchCompanies = useServerFn(listCompanies);
  const createFn = useServerFn(createUser);
  const activeFn = useServerFn(setUserActive);
  const roleFn = useServerFn(setUserRole);
  const [open, setOpen] = useState(false);

  const { data: users, isLoading } = useQuery({
    queryKey: ["users"],
    queryFn: () => fetchUsers({}),
  });

  const { data: companies } = useQuery({
    queryKey: ["companies"],
    queryFn: () => fetchCompanies({}),
  });

  const createM = useMutation({
    mutationFn: (data: {
      full_name: string;
      username: string;
      password: string;
      role: AppRole;
      company_id: string | null;
    }) => createFn({ data }),
    onSuccess: () => {
      toast.success("Usuário criado");
      qc.invalidateQueries({ queryKey: ["users"] });
      setOpen(false);
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao criar usuário"),
  });

  const activeM = useMutation({
    mutationFn: (v: { user_id: string; active: boolean }) => activeFn({ data: v }),
    onSuccess: (_d, v) => {
      toast.success(v.active ? "Usuário ativado" : "Usuário desativado");
      qc.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro"),
  });

  const roleM = useMutation({
    mutationFn: (v: { user_id: string; role: AppRole }) => roleFn({ data: v }),
    onSuccess: () => {
      toast.success("Função atualizada");
      qc.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro"),
  });

  const sorted = useMemo(
    () => [...(users ?? [])].sort((a, b) => a.full_name.localeCompare(b.full_name)),
    [users],
  );

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">Usuários</h1>
          <p className="text-sm text-muted-foreground">
            {isSuperAdmin ? "Todos os usuários de todas as empresas." : "Usuários da sua empresa."}
          </p>
        </div>
        <button
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-3.5 py-2 text-sm font-semibold text-primary-foreground shadow-elevated hover:opacity-95"
        >
          <UserPlus className="h-4 w-4" /> Novo usuário
        </button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-2">
          {sorted.map((u) => (
            <div
              key={u.id}
              className="rounded-xl border border-border bg-card p-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-medium truncate">{u.full_name || "(sem nome)"}</p>
                  {u.role === "super_admin" && (
                    <span className="text-[10px] uppercase tracking-wide rounded-full bg-primary/10 text-primary px-2 py-0.5">
                      Super Admin
                    </span>
                  )}
                  {!u.active && (
                    <span className="text-[10px] uppercase tracking-wide rounded-full bg-destructive/10 text-destructive px-2 py-0.5">
                      Inativo
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground truncate">@{u.username ?? "—"}</p>
                {u.company_name && (
                  <p className="text-[11px] text-muted-foreground mt-0.5">🏢 {u.company_name}</p>
                )}
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  ⏱ Último login: {u.last_login_at ? new Date(u.last_login_at).toLocaleString("pt-BR") : "nunca"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={u.role ?? ""}
                  onChange={(e) =>
                    roleM.mutate({ user_id: u.id, role: e.target.value as AppRole })
                  }
                  disabled={u.role === "super_admin" && !isSuperAdmin}
                  className="rounded-lg border border-input bg-background px-2 py-1.5 text-sm"
                >
                  {!u.role && <option value="">— sem função —</option>}
                  {isSuperAdmin && <option value="super_admin">Super Admin</option>}
                  <option value="admin">Administrador</option>
                  <option value="atendente">Atendente</option>
                  <option value="cozinha">Cozinha</option>
                </select>
                <button
                  onClick={() => activeM.mutate({ user_id: u.id, active: !u.active })}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium border ${
                    u.active
                      ? "border-border text-muted-foreground hover:bg-muted"
                      : "border-primary/30 text-primary hover:bg-primary/5"
                  }`}
                >
                  <Power className="h-3.5 w-3.5" />
                  {u.active ? "Desativar" : "Ativar"}
                </button>
              </div>
            </div>
          ))}
          {sorted.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-12">Nenhum usuário ainda.</p>
          )}
        </div>
      )}

      {open && (
        <CreateDialog
          isSuperAdmin={isSuperAdmin}
          companies={(companies ?? []).filter((c: any) => c.active)}
          onClose={() => setOpen(false)}
          onSubmit={(d) => createM.mutate(d)}
          loading={createM.isPending}
        />
      )}
    </div>
  );
}

function CreateDialog({
  isSuperAdmin,
  companies,
  onClose,
  onSubmit,
  loading,
}: {
  isSuperAdmin: boolean;
  companies: Array<{ id: string; name: string }>;
  onClose: () => void;
  onSubmit: (d: {
    full_name: string;
    username: string;
    password: string;
    role: AppRole;
    company_id: string | null;
  }) => void;
  loading: boolean;
}) {
  const [full_name, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<AppRole>("atendente");
  const [companyId, setCompanyId] = useState<string>("");

  const needsCompany = role !== "super_admin";

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-t-2xl sm:rounded-2xl bg-background p-5 shadow-elevated"
      >
        <div className="flex items-center gap-2 mb-4">
          <ShieldCheck className="h-5 w-5 text-primary" />
          <h2 className="font-display text-lg font-semibold">Novo usuário</h2>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit({
              full_name,
              username: username.trim().toLowerCase(),
              password,
              role,
              company_id: needsCompany ? (isSuperAdmin ? companyId || null : null) : null,
            });
          }}
          className="space-y-3"
        >
          <Field label="Nome completo">
            <input
              required
              value={full_name}
              onChange={(e) => setFullName(e.target.value)}
              className={inputCls}
            />
          </Field>
          <Field label="Usuário (login)">
            <input
              required
              minLength={3}
              maxLength={32}
              pattern="[a-zA-Z0-9._-]+"
              placeholder="ex: joao.silva"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className={inputCls}
            />
          </Field>
          <Field label="Senha">
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputCls}
            />
          </Field>
          <Field label="Função">
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as AppRole)}
              className={inputCls}
            >
              {isSuperAdmin && <option value="super_admin">Super Admin (todas as empresas)</option>}
              <option value="admin">Administrador da empresa</option>
              <option value="atendente">Atendente</option>
              <option value="cozinha">Cozinha</option>
            </select>
          </Field>
          {isSuperAdmin && needsCompany && (
            <Field label="Empresa">
              <select
                required
                value={companyId}
                onChange={(e) => setCompanyId(e.target.value)}
                className={inputCls}
              >
                <option value="">Selecione…</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
          )}
          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border border-border px-3 py-2.5 text-sm font-medium"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-70"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Criar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const inputCls =
  "mt-1.5 w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-sm font-medium">{label}</span>
      {children}
    </label>
  );
}