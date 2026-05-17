import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import {
  connectIfood,
  disconnectIfood,
  getIfoodStats,
  listIntegracaoLogs,
  listIntegracoes,
  syncIfoodNow,
} from "@/lib/ifood.functions";
import { Loader2, Plug, RefreshCw, Power, AlertCircle, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/_app/conectores")({
  component: ConectoresPage,
  head: () => ({ meta: [{ title: "Conectores — ORDEX" }] }),
});

const statusBadge: Record<string, { label: string; cls: string; icon: any }> = {
  desconectado: { label: "Desconectado", cls: "bg-zinc-200 text-zinc-700", icon: Power },
  conectado: { label: "Conectado", cls: "bg-emerald-100 text-emerald-700", icon: CheckCircle2 },
  sincronizando: { label: "Sincronizando", cls: "bg-sky-100 text-sky-700", icon: RefreshCw },
  erro: { label: "Erro", cls: "bg-rose-100 text-rose-700", icon: AlertCircle },
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
        <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <IfoodCard integ={integ} onChange={() => qc.invalidateQueries({ queryKey: ["integracoes"] })} />
          <ComingSoonCard name="Rappi" />
          <ComingSoonCard name="Delivery Much" />
        </div>
      )}
    </div>
  );
}

function IfoodCard({ integ, onChange }: { integ: any; onChange: () => void }) {
  const [merchantId, setMerchantId] = useState(integ?.merchant_id ?? "");
  const connect = useServerFn(connectIfood);
  const disconnect = useServerFn(disconnectIfood);
  const sync = useServerFn(syncIfoodNow);
  const stats = useServerFn(getIfoodStats);

  const status = integ?.status ?? "desconectado";
  const meta = statusBadge[status] ?? statusBadge.desconectado;
  const Icon = meta.icon;

  const statsQ = useQuery({
    queryKey: ["ifood-stats", integ?.company_id],
    queryFn: () => stats({}),
    enabled: !!integ,
    refetchInterval: 30_000,
  });

  const logsQ = useQuery({
    queryKey: ["integracao-logs", integ?.id],
    queryFn: () => useServerFnInline(listIntegracaoLogs, { integration_id: integ.id, limit: 8 }),
    enabled: !!integ,
    refetchInterval: 15_000,
  });

  const connectMut = useMutation({
    mutationFn: () => connect({ data: { merchant_id: merchantId.trim() } }),
    onSuccess: () => { toast.success("iFood conectado"); onChange(); },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao conectar"),
  });
  const disconnectMut = useMutation({
    mutationFn: () => disconnect({ data: { id: integ.id } }),
    onSuccess: () => { toast.success("Desconectado"); onChange(); },
  });
  const syncMut = useMutation({
    mutationFn: () => sync({ data: { id: integ.id } }),
    onSuccess: (r: any) => { toast.success(`Sincronizado: ${r.imported} novo(s), ${r.skipped} duplicado(s)`); onChange(); },
    onError: (e: any) => toast.error(e?.message ?? "Erro de sync"),
  });

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="h-9 w-9 rounded-lg bg-red-500 text-white flex items-center justify-center font-bold">iF</div>
          <div>
            <p className="font-semibold leading-tight">iFood</p>
            <p className="text-xs text-muted-foreground">Pedidos via polling</p>
          </div>
        </div>
        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-medium ${meta.cls}`}>
          <Icon className="h-3 w-3" /> {meta.label}
        </span>
      </div>

      {!integ || !integ.active ? (
        <div className="space-y-2">
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
          <Row label="Merchant" value={integ.merchant_id ?? "—"} />
          <Row label="Última sync" value={integ.last_sync_at ? new Date(integ.last_sync_at).toLocaleString("pt-BR") : "—"} />
          <Row label="Pedidos hoje" value={String(statsQ.data?.importedToday ?? 0)} />
          {integ.last_error && (
            <div className="rounded-md bg-rose-50 border border-rose-200 px-2 py-1.5 text-xs text-rose-700">
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
            >
              <Power className="h-4 w-4" />
            </button>
          </div>

          {logsQ.data && logsQ.data.length > 0 && (
            <div className="pt-2 border-t border-border">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">Últimos eventos</p>
              <ul className="space-y-1 max-h-40 overflow-auto">
                {logsQ.data.map((l: any) => (
                  <li key={l.id} className="text-xs flex gap-2">
                    <span className={`shrink-0 ${l.level === "error" ? "text-rose-600" : l.level === "warn" ? "text-amber-600" : "text-muted-foreground"}`}>
                      {new Date(l.created_at).toLocaleTimeString("pt-BR")}
                    </span>
                    <span className="truncate">{l.message}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
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

// useServerFn must be called at component level. Wrap for logs query.
function useServerFnInline<TArgs, TResult>(fn: any, args: TArgs): Promise<TResult> {
  return fn({ data: args });
}
