import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { listAssinaturas, updateAssinatura } from "@/lib/assinaturas.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/_app/assinaturas")({
  component: AssinaturasPage,
});

type Row = Awaited<ReturnType<typeof listAssinaturas>>[number];

const PLAN_LIMITS = {
  base: { pedidos: 300, conversas: 300, usuarios: 1 },
  pro: { pedidos: 1500, conversas: 1500, usuarios: 3 },
  max: { pedidos: 0, conversas: 3000, usuarios: 8 },
} as const;

const statusVariant = (s?: string | null) => {
  switch (s) {
    case "ativo": return "default";
    case "trial": return "secondary";
    case "pendente": return "outline";
    case "inadimplente":
    case "expirado":
    case "cancelado": return "destructive";
    default: return "outline";
  }
};

const fmtDate = (d?: string | null) => {
  if (!d) return "—";
  try { return new Date(d).toLocaleDateString("pt-BR"); } catch { return "—"; }
};
const fmtLim = (used: number, lim: number) =>
  lim === 0 ? `${used} / ∞` : `${used} / ${lim}`;

function AssinaturasPage() {
  const { isSuperAdmin, loading } = useAuth();
  const qc = useQueryClient();
  const listFn = useServerFn(listAssinaturas);
  const updateFn = useServerFn(updateAssinatura);
  const [filter, setFilter] = useState("");
  const [editing, setEditing] = useState<Row | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["assinaturas"],
    queryFn: () => listFn({}),
    enabled: isSuperAdmin,
  });

  type UpdateInput = {
    companyId: string;
    plano: "base" | "pro" | "max";
    status: "trial" | "ativo" | "pendente" | "inadimplente" | "cancelado" | "expirado";
    ciclo: "mensal" | "anual";
    inicio?: string | null;
    vencimento?: string | null;
  };

  const mutation = useMutation({
    mutationFn: (input: UpdateInput) => updateFn({ data: input }),
    onSuccess: () => {
      toast.success("Assinatura atualizada");
      qc.invalidateQueries({ queryKey: ["assinaturas"] });
      setEditing(null);
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao atualizar"),
  });

  const filtered = useMemo(() => {
    const rows = data ?? [];
    const q = filter.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => r.company_name.toLowerCase().includes(q));
  }, [data, filter]);

  if (loading) return null;
  if (!isSuperAdmin) return <Navigate to="/dashboard" />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Assinaturas</h1>
        <p className="text-sm text-muted-foreground">Gestão manual de planos, ciclos e status por empresa.</p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <CardTitle className="text-base">Empresas</CardTitle>
          <Input
            placeholder="Buscar empresa..."
            className="max-w-xs"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Empresa</TableHead>
                  <TableHead>Plano</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Ciclo</TableHead>
                  <TableHead>Início</TableHead>
                  <TableHead>Vencimento</TableHead>
                  <TableHead>Trial</TableHead>
                  <TableHead>Pedidos</TableHead>
                  <TableHead>Conversas</TableHead>
                  <TableHead>Usuários</TableHead>
                  <TableHead>Gateway</TableHead>
                  <TableHead>Customer ID</TableHead>
                  <TableHead>Subscription ID</TableHead>
                  <TableHead>Ext. status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((r) => {
                  const s = r.subscription as any;
                  return (
                    <TableRow key={r.company_id}>
                      <TableCell className="font-medium">{r.company_name}</TableCell>
                      <TableCell className="uppercase">{s?.plano ?? "—"}</TableCell>
                      <TableCell>
                        <Badge variant={statusVariant(s?.status) as any}>{s?.status ?? "—"}</Badge>
                      </TableCell>
                      <TableCell>{s?.ciclo ?? "—"}</TableCell>
                      <TableCell>{fmtDate(s?.inicio)}</TableCell>
                      <TableCell>{fmtDate(s?.vencimento)}</TableCell>
                      <TableCell>
                        {r.trial?.isTrial
                          ? r.trial.expirado
                            ? <span className="text-destructive font-medium">expirado</span>
                            : <span>{r.trial.diasRestantes}d</span>
                          : <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell>{fmtLim(r.uso.pedidos, s?.limite_pedidos_mes ?? 0)}</TableCell>
                      <TableCell>{fmtLim(r.uso.conversas, s?.limite_conversas_mes ?? 0)}</TableCell>
                      <TableCell>{fmtLim(r.uso.usuarios, s?.limite_usuarios ?? 0)}</TableCell>
                      <TableCell className="text-muted-foreground">{s?.gateway ?? "—"}</TableCell>
                      <TableCell className="text-muted-foreground font-mono text-xs">{s?.customer_id ?? "—"}</TableCell>
                      <TableCell className="text-muted-foreground font-mono text-xs">{s?.subscription_id ?? "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{s?.external_status ?? "—"}</TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="outline" onClick={() => setEditing(r)}>
                          Editar
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={15} className="text-center text-muted-foreground py-8">
                      Nenhuma empresa encontrada.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <EditDialog
        row={editing}
        onClose={() => setEditing(null)}
        onSave={(payload) => mutation.mutate(payload)}
        saving={mutation.isPending}
      />
    </div>
  );
}

function EditDialog({
  row, onClose, onSave, saving,
}: {
  row: Row | null;
  onClose: () => void;
  onSave: (p: {
    companyId: string;
    plano: "base" | "pro" | "max";
    status: "trial" | "ativo" | "pendente" | "inadimplente" | "cancelado" | "expirado";
    ciclo: "mensal" | "anual";
    inicio?: string | null;
    vencimento?: string | null;
  }) => void;
  saving: boolean;
}) {
  const s = row?.subscription;
  const [plano, setPlano] = useState<"base" | "pro" | "max">((s?.plano as any) ?? "base");
  const [status, setStatus] = useState<any>(s?.status ?? "ativo");
  const [ciclo, setCiclo] = useState<"mensal" | "anual">((s?.ciclo as any) ?? "mensal");
  const [inicio, setInicio] = useState<string>(s?.inicio ? s.inicio.slice(0, 10) : "");
  const [vencimento, setVencimento] = useState<string>(s?.vencimento ?? "");

  // reinicializar quando trocar linha
  useMemo(() => {
    if (!row) return;
    const sub = row.subscription;
    setPlano((sub?.plano as any) ?? "base");
    setStatus(sub?.status ?? "ativo");
    setCiclo((sub?.ciclo as any) ?? "mensal");
    setInicio(sub?.inicio ? sub.inicio.slice(0, 10) : "");
    setVencimento(sub?.vencimento ?? "");
  }, [row]);

  const lim = PLAN_LIMITS[plano];

  return (
    <Dialog open={!!row} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Editar assinatura — {row?.company_name}</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <Label>Plano</Label>
            <Select value={plano} onValueChange={(v) => setPlano(v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="base">Base</SelectItem>
                <SelectItem value="pro">Pro</SelectItem>
                <SelectItem value="max">Max</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-1">
              Limites aplicados: {lim.pedidos === 0 ? "∞" : lim.pedidos} pedidos · {lim.conversas} conversas · {lim.usuarios} usuários
            </p>
          </div>

          <div>
            <Label>Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="trial">Trial</SelectItem>
                <SelectItem value="ativo">Ativo</SelectItem>
                <SelectItem value="pendente">Pendente</SelectItem>
                <SelectItem value="inadimplente">Inadimplente</SelectItem>
                <SelectItem value="cancelado">Cancelado</SelectItem>
                <SelectItem value="expirado">Expirado</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Ciclo</Label>
            <Select value={ciclo} onValueChange={(v) => setCiclo(v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="mensal">Mensal</SelectItem>
                <SelectItem value="anual">Anual</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Início</Label>
            <Input type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} />
          </div>

          <div>
            <Label>Vencimento</Label>
            <Input type="date" value={vencimento} onChange={(e) => setVencimento(e.target.value)} />
          </div>
        </div>

        <div className="mt-4 rounded-md border border-dashed p-3 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase text-muted-foreground">Cobrança (somente leitura)</p>
            <span className="text-[10px] text-muted-foreground">preparado para integração futura</span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div><span className="text-muted-foreground">Gateway: </span>{(s as any)?.gateway ?? "—"}</div>
            <div><span className="text-muted-foreground">Ext. status: </span>{(s as any)?.external_status ?? "—"}</div>
            <div className="col-span-2"><span className="text-muted-foreground">Customer ID: </span><span className="font-mono">{(s as any)?.customer_id ?? "—"}</span></div>
            <div className="col-span-2"><span className="text-muted-foreground">Subscription ID: </span><span className="font-mono">{(s as any)?.subscription_id ?? "—"}</span></div>
            <div><span className="text-muted-foreground">Forma pgto: </span>{(s as any)?.payment_method ?? "—"}</div>
            <div><span className="text-muted-foreground">Sync: </span>{(s as any)?.external_sync_at ? new Date((s as any).external_sync_at).toLocaleString("pt-BR") : "—"}</div>
            <div><span className="text-muted-foreground">Valor mensal: </span>{(s as any)?.valor_mensal ?? 0}</div>
            <div><span className="text-muted-foreground">Valor anual: </span>{(s as any)?.valor_anual ?? 0}</div>
            <div className="col-span-2"><span className="text-muted-foreground">Desconto anual %: </span>{(s as any)?.desconto_anual_pct ?? 0}</div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button
            disabled={saving}
            onClick={() => row && onSave({
              companyId: row.company_id,
              plano, status, ciclo,
              inicio: inicio || null,
              vencimento: vencimento || null,
            })}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
