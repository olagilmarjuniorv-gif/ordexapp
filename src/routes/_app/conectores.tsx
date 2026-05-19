import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  connectIfood,
  disconnectIfood,
  getIfoodStats,
  listIntegracaoLogs,
  listIntegracoes,
  syncIfoodNow,
} from "@/lib/ifood.functions";
import {
  Loader2,
  Plug,
  RefreshCw,
  Power,
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  HelpCircle,
  CircleDot,
} from "lucide-react";

export const Route = createFileRoute("/_app/conectores")({
  component: ConectoresPage,
  head: () => ({ meta: [{ title: "Conectores — ORDEX" }] }),
});

const AUTO_SYNC_MS = 30_000;
const STALE_MS = 5 * 60_000;

const statusBadge: Record<string, { label: string; cls: string; icon: any }> = {
  desconectado: { label: "Desconectado", cls: "bg-muted text-muted-foreground", icon: Power },
  conectado: { label: "Conectado", cls: "bg-success/15 text-success", icon: CheckCircle2 },
  sincronizando: { label: "Sincronizando", cls: "bg-realtime/15 text-realtime", icon: RefreshCw },
  erro: { label: "Erro", cls: "bg-destructive/15 text-destructive", icon: AlertCircle },
};

function ConectoresPage() {
  const list = useServerFn(listIntegracoes);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["integracoes"],
    queryFn: () => list({}),
    refetchInterval: 15_000,
  });
  const integ = (data ?? []).find((i: any) => i.provider === "ifood");

  return (
    <div className="space-y-5">
      <header>
        <h1 className="font-display text-2xl lg:text-3xl font-bold">Conectores</h1>
        <p className="text-sm text-muted-foreground">
          Conecte plataformas externas para receber pedidos automaticamente.
        </p>
      </header>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
          <IfoodCard integ={integ} onChange={() => qc.invalidateQueries({ queryKey: ["integracoes"] })} />
          <ComingSoonCard name="Rappi" />
          <ComingSoonCard name="Delivery Much" />
        </div>
      )}
    </div>
  );
}

type Health = "green" | "yellow" | "red";

function computeHealth(integ: any): Health {
  if (!integ) return "red";
  if (integ.status === "erro" || integ.last_error) return "red";
  if (integ.token_expires_at && new Date(integ.token_expires_at).getTime() < Date.now()) return "red";
  if (!integ.last_success_at) return "yellow";
  const age = Date.now() - new Date(integ.last_success_at).getTime();
  if (age > STALE_MS) return "yellow";
  return "green";
}

function healthMeta(h: Health) {
  switch (h) {
    case "green":
      return { cls: "bg-emerald-500", label: "Saudável" };
    case "yellow":
      return { cls: "bg-amber-500", label: "Sem sync recente" };
    case "red":
      return { cls: "bg-rose-500", label: "Erro / atenção" };
  }
}

function IfoodCard({ integ, onChange }: { integ: any; onChange: () => void }) {
  const [merchantId, setMerchantId] = useState(integ?.merchant_id ?? "");
  const [showWizard, setShowWizard] = useState(false);
  const connect = useServerFn(connectIfood);
  const disconnect = useServerFn(disconnectIfood);
  const sync = useServerFn(syncIfoodNow);
  const stats = useServerFn(getIfoodStats);
  const fetchLogs = useServerFn(listIntegracaoLogs);
  const qc = useQueryClient();

  const status = integ?.status ?? "desconectado";
  const meta = statusBadge[status] ?? statusBadge.desconectado;
  const Icon = meta.icon;
  const health = computeHealth(integ);
  const hMeta = healthMeta(health);

  const statsQ = useQuery({
    queryKey: ["ifood-stats", integ?.id],
    queryFn: () => stats({}),
    enabled: !!integ,
    refetchInterval: 30_000,
  });

  const connectMut = useMutation({
    mutationFn: () => connect({ data: { merchant_id: merchantId.trim() } }),
    onSuccess: () => {
      toast.success("iFood conectado");
      onChange();
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao conectar"),
  });
  const disconnectMut = useMutation({
    mutationFn: () => disconnect({ data: { id: integ.id } }),
    onSuccess: () => {
      toast.success("Desconectado");
      onChange();
    },
  });
  const syncMut = useMutation({
    mutationFn: () => sync({ data: { id: integ.id } }),
    onSuccess: (r: any) => {
      if (r.imported > 0) toast.success(`Sincronizado: ${r.imported} novo(s)`);
      qc.invalidateQueries({ queryKey: ["integracoes"] });
      qc.invalidateQueries({ queryKey: ["ifood-stats", integ?.id] });
      qc.invalidateQueries({ queryKey: ["integracao-logs", integ?.id] });
      qc.invalidateQueries({ queryKey: ["pedidos"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro de sync"),
  });

  // Auto-sync a cada 30s enquanto integração ativa e tela montada
  useEffect(() => {
    if (!integ?.id || !integ.active) return;
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible" && !syncMut.isPending) {
        syncMut.mutate();
      }
    }, AUTO_SYNC_MS);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [integ?.id, integ?.active]);

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="h-9 w-9 rounded-lg bg-red-500 text-white flex items-center justify-center font-bold">iF</div>
          <div>
            <div className="flex items-center gap-1.5">
              <p className="font-semibold leading-tight">iFood</p>
              {integ?.active && (
                <span title={hMeta.label} className={`inline-block h-2 w-2 rounded-full ${hMeta.cls}`} />
              )}
            </div>
            <p className="text-xs text-muted-foreground">Pedidos via polling</p>
          </div>
        </div>
        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-medium ${meta.cls}`}>
          <Icon className={`h-3 w-3 ${status === "sincronizando" || syncMut.isPending ? "animate-spin" : ""}`} /> {meta.label}
        </span>
      </div>

      {!integ || !integ.active ? (
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => setShowWizard((s) => !s)}
            className="w-full inline-flex items-center justify-between text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            <span className="inline-flex items-center gap-1.5">
              <HelpCircle className="h-3.5 w-3.5" /> Como conectar
            </span>
            {showWizard ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>
          {showWizard && <IfoodWizard />}
          <label className="text-xs font-medium text-muted-foreground">Merchant ID</label>
          <input
            value={merchantId}
            onChange={(e) => setMerchantId(e.target.value)}
            placeholder="ex: 1a2b3c..."
            className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
          />
          <button
            disabled={!merchantId.trim() || connectMut.isPending}
            onClick={() => connectMut.mutate()}
            className="w-full inline-flex items-center justify-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
          >
            <Plug className="h-4 w-4" /> {connectMut.isPending ? "Conectando..." : "Conectar"}
          </button>
        </div>
      ) : (
        <div className="space-y-2 text-sm">
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="inline-flex items-center gap-1.5 text-muted-foreground">
              <CircleDot className={`h-3 w-3 ${hMeta.cls.replace("bg-", "text-")}`} />
              {hMeta.label}
            </span>
            <span className="text-muted-foreground tabular-nums">
              {syncMut.isPending ? (
                <span className="inline-flex items-center gap-1">
                  <Loader2 className="h-3 w-3 animate-spin" /> Sincronizando…
                </span>
              ) : integ.last_sync_at ? (
                `Última: ${new Date(integ.last_sync_at).toLocaleTimeString("pt-BR")}`
              ) : (
                "—"
              )}
            </span>
          </div>

          <Row label="Merchant" value={integ.merchant_id ?? "—"} />
          <Row label="Último sucesso" value={integ.last_success_at ? new Date(integ.last_success_at).toLocaleString("pt-BR") : "—"} />
          <Row label="Pedidos hoje" value={String(statsQ.data?.importedToday ?? 0)} />

          {integ.last_error && (
            <div className="rounded-md bg-rose-50 border border-rose-200 px-2 py-1.5 text-xs text-rose-700">
              <span className="font-semibold">Último erro: </span>
              {integ.last_error}
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <button
              onClick={() => syncMut.mutate()}
              disabled={syncMut.isPending}
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
            >
              <RefreshCw className={`h-4 w-4 ${syncMut.isPending ? "animate-spin" : ""}`} />
              Sincronizar agora
            </button>
            <button
              onClick={() => disconnectMut.mutate()}
              disabled={disconnectMut.isPending}
              className="inline-flex items-center justify-center gap-1 rounded-md border border-border px-3 py-2 text-sm"
              title="Desconectar"
            >
              <Power className="h-4 w-4" />
            </button>
          </div>

          <p className="text-[10px] text-muted-foreground text-center">
            Auto-sync a cada {AUTO_SYNC_MS / 1000}s enquanto esta tela estiver aberta
          </p>

          <LogsBlock integrationId={integ.id} fetchLogs={fetchLogs} />
        </div>
      )}
    </div>
  );
}

function IfoodWizard() {
  const steps = [
    "Crie um app no Portal do Desenvolvedor iFood",
    "Copie o client_id e cadastre no ORDEX (secret)",
    "Copie o client_secret e cadastre no ORDEX (secret)",
    "Pegue o merchant_id da sua loja iFood",
    "Cole o merchant_id abaixo e clique em Conectar",
  ];
  return (
    <div className="rounded-md border border-border bg-muted/30 p-3 space-y-2">
      <ol className="space-y-1.5 text-xs">
        {steps.map((s, i) => (
          <li key={i} className="flex gap-2">
            <span className="shrink-0 inline-flex h-4 w-4 items-center justify-center rounded-full bg-primary text-primary-foreground text-[10px] font-bold">
              {i + 1}
            </span>
            <span>{s}</span>
          </li>
        ))}
      </ol>
      <a
        href="https://developer.ifood.com.br/pt-BR/docs/getting-started"
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
      >
        Ver documentação <ExternalLink className="h-3 w-3" />
      </a>
    </div>
  );
}

type LogLevel = "all" | "info" | "warn" | "error";
type DateFilter = "all" | "today" | "7d";

function LogsBlock({ integrationId, fetchLogs }: { integrationId: string; fetchLogs: any }) {
  const [level, setLevel] = useState<LogLevel>("all");
  const [date, setDate] = useState<DateFilter>("all");

  const logsQ = useQuery({
    queryKey: ["integracao-logs", integrationId],
    queryFn: () => fetchLogs({ data: { integration_id: integrationId, limit: 50 } }),
    enabled: !!integrationId,
    refetchInterval: 15_000,
  });

  const filtered = useMemo(() => {
    const rows = (logsQ.data as any[]) ?? [];
    const now = Date.now();
    return rows.filter((r) => {
      if (level !== "all" && r.level !== level) return false;
      if (date !== "all") {
        const t = new Date(r.created_at).getTime();
        if (date === "today") {
          const start = new Date();
          start.setHours(0, 0, 0, 0);
          if (t < start.getTime()) return false;
        } else if (date === "7d") {
          if (now - t > 7 * 24 * 3600_000) return false;
        }
      }
      return true;
    });
  }, [logsQ.data, level, date]);

  if (!logsQ.data) return null;

  return (
    <div className="pt-2 border-t border-border space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Eventos</p>
        <div className="flex gap-1">
          <select
            value={level}
            onChange={(e) => setLevel(e.target.value as LogLevel)}
            className="text-[10px] rounded border border-input bg-background px-1.5 py-0.5"
          >
            <option value="all">Todos</option>
            <option value="info">Info</option>
            <option value="warn">Warn</option>
            <option value="error">Erro</option>
          </select>
          <select
            value={date}
            onChange={(e) => setDate(e.target.value as DateFilter)}
            className="text-[10px] rounded border border-input bg-background px-1.5 py-0.5"
          >
            <option value="all">Sempre</option>
            <option value="today">Hoje</option>
            <option value="7d">7 dias</option>
          </select>
        </div>
      </div>
      {filtered.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">Sem eventos para este filtro.</p>
      ) : (
        <ul className="space-y-1 max-h-48 overflow-auto">
          {filtered.map((l: any) => {
            const cls =
              l.level === "error"
                ? "bg-rose-50 border-rose-200 text-rose-700"
                : l.level === "warn"
                ? "bg-amber-50 border-amber-200 text-amber-700"
                : "bg-emerald-50/50 border-emerald-200/60 text-emerald-800";
            return (
              <li key={l.id} className={`text-xs flex gap-2 rounded border px-2 py-1 ${cls}`}>
                <span className="shrink-0 tabular-nums opacity-70">
                  {new Date(l.created_at).toLocaleTimeString("pt-BR")}
                </span>
                <span className="truncate flex-1" title={l.message}>{l.message}</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-muted-foreground text-xs">{label}</span>
      <span className="font-medium truncate">{value}</span>
    </div>
  );
}

function ComingSoonCard({ name }: { name: string }) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-card/50 p-4 opacity-60">
      <p className="font-semibold">{name}</p>
      <p className="text-xs text-muted-foreground mt-1">Em breve</p>
    </div>
  );
}
