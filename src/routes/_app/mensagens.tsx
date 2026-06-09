import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { listMensagens } from "@/lib/whatsapp.functions";
import {
  listSessoes,
  assumirAtendimento,
  liberarAtendimento,
  enviarMensagemManual,
} from "@/lib/whatsapp-sessoes.functions";
import { useAuth } from "@/lib/auth";
import { useRealtimeInvalidate } from "@/hooks/use-realtime";
import { MessageCircle, ArrowDownLeft, ArrowUpRight, UserCheck, UserX, Send } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/mensagens")({
  component: MensagensPanel,
  head: () => ({ meta: [{ title: "Mensagens — SaiuPedido" }] }),
});

const ESTADO_LABEL: Record<string, string> = {
  aguardando_inicio: "Aguardando início",
  escolhendo_categoria: "Escolhendo categoria",
  escolhendo_produto: "Escolhendo produto",
  escolhendo_adicionais: "Adicionais",
  escolhendo_quantidade: "Quantidade",
  escrevendo_observacao: "Observação",
  confirmando_pedido: "Confirmando",
  escolhendo_pagamento: "Pagamento",
  aguardando_atendente: "🔔 Aguardando atendente",
  pedido_finalizado: "Pedido finalizado",
  conversa_encerrada: "Encerrada",
};

export function MensagensPanel() {
  const { isSuperAdmin, isAdmin } = useAuth();
  const qc = useQueryClient();

  const fetchMsgs = useServerFn(listMensagens);
  const fetchSessoes = useServerFn(listSessoes);
  const assumirFn = useServerFn(assumirAtendimento);
  const liberarFn = useServerFn(liberarAtendimento);
  const enviarFn = useServerFn(enviarMensagemManual);

  const { data: msgs, isLoading } = useQuery({
    queryKey: ["mensagens"],
    queryFn: () => fetchMsgs({ data: { limit: 100 } }),
    enabled: isSuperAdmin || isAdmin,
  });

  const { data: sessoes } = useQuery({
    queryKey: ["whatsapp-sessoes"],
    queryFn: () => fetchSessoes(),
    enabled: isSuperAdmin || isAdmin,
  });

  useRealtimeInvalidate("whatsapp_sessoes", [["whatsapp-sessoes"]]);
  useRealtimeInvalidate("mensagens", [["mensagens"]]);

  const [activeReply, setActiveReply] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");

  if (!isSuperAdmin && !isAdmin) {
    return <div className="p-6 text-sm text-muted-foreground">Acesso restrito.</div>;
  }

  async function handleAssumir(id: string) {
    await assumirFn({ data: { id } });
    toast.success("Atendimento assumido. Bot pausado para este contato.");
    qc.invalidateQueries({ queryKey: ["whatsapp-sessoes"] });
  }

  async function handleLiberar(id: string) {
    await liberarFn({ data: { id } });
    toast.success("Atendimento liberado para o bot.");
    qc.invalidateQueries({ queryKey: ["whatsapp-sessoes"] });
  }

  async function handleEnviar(id: string) {
    if (!replyText.trim()) return;
    try {
      await enviarFn({ data: { id, body: replyText.trim() } });
      toast.success("Mensagem enviada");
      setReplyText("");
      setActiveReply(null);
      qc.invalidateQueries({ queryKey: ["mensagens"] });
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao enviar");
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl lg:text-3xl font-bold">Mensagens WhatsApp</h1>
        <p className="text-sm text-muted-foreground">
          Painel operacional de conversas em tempo real. Assuma o atendimento para pausar o bot.
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_1.2fr]">
        {/* Sessões ativas */}
        <div className="rounded-xl border border-border bg-card">
          <div className="border-b border-border px-4 py-3">
            <h2 className="font-semibold text-sm">Conversas ativas</h2>
          </div>
          {!sessoes || sessoes.length === 0 ? (
            <div className="p-10 text-center">
              <MessageCircle className="mx-auto h-8 w-8 text-muted-foreground" />
              <p className="mt-2 text-sm text-muted-foreground">Nenhuma conversa ainda.</p>
            </div>
          ) : (
            <ul className="divide-y divide-border max-h-[70vh] overflow-y-auto">
              {sessoes.map((s: any) => {
                const cartCount = Array.isArray(s.carrinho) ? s.carrinho.length : 0;
                return (
                  <li key={s.id} className="p-4 space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-medium text-sm">{s.customer_phone}</p>
                        <p className="text-xs text-muted-foreground">
                          {ESTADO_LABEL[s.estado_atual] ?? s.estado_atual}
                          {cartCount > 0 && ` • 🛒 ${cartCount} item(s)`}
                        </p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          {new Date(s.last_event_at).toLocaleString("pt-BR")}
                        </p>
                      </div>
                      {s.atendente_assumiu ? (
                        <button
                          onClick={() => handleLiberar(s.id)}
                          className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-xs hover:bg-muted/80"
                        >
                          <UserX className="h-3 w-3" /> Liberar bot
                        </button>
                      ) : (
                        <button
                          onClick={() => handleAssumir(s.id)}
                          className="inline-flex items-center gap-1 rounded-md bg-primary px-2 py-1 text-xs text-primary-foreground hover:opacity-90"
                        >
                          <UserCheck className="h-3 w-3" /> Assumir
                        </button>
                      )}
                    </div>

                    {activeReply === s.id ? (
                      <div className="flex gap-2">
                        <input
                          autoFocus
                          value={replyText}
                          onChange={(e) => setReplyText(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && handleEnviar(s.id)}
                          placeholder="Mensagem ao cliente…"
                          className="flex-1 rounded-md border border-border bg-background px-2 py-1 text-sm"
                        />
                        <button
                          onClick={() => handleEnviar(s.id)}
                          className="inline-flex items-center gap-1 rounded-md bg-accent px-2 py-1 text-xs text-accent-foreground"
                        >
                          <Send className="h-3 w-3" /> Enviar
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => {
                          setActiveReply(s.id);
                          setReplyText("");
                        }}
                        className="text-xs text-primary hover:underline"
                      >
                        Responder manualmente
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Histórico de mensagens */}
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="border-b border-border px-4 py-3">
            <h2 className="font-semibold text-sm">Histórico recente</h2>
          </div>
          {isLoading ? (
            <div className="p-6 text-sm text-muted-foreground">Carregando…</div>
          ) : !msgs || msgs.length === 0 ? (
            <div className="p-10 text-center">
              <MessageCircle className="mx-auto h-8 w-8 text-muted-foreground" />
              <p className="mt-2 text-sm text-muted-foreground">Nenhuma mensagem ainda.</p>
            </div>
          ) : (
            <ul className="divide-y divide-border max-h-[70vh] overflow-y-auto">
              {msgs.map((m: any) => (
                <li key={m.id} className="flex items-start gap-3 p-4">
                  <div
                    className={`mt-0.5 rounded-md p-1.5 ${m.direction === "in" ? "bg-primary-soft text-primary" : "bg-success/15 text-success"}`}
                  >
                    {m.direction === "in" ? (
                      <ArrowDownLeft className="h-4 w-4" />
                    ) : (
                      <ArrowUpRight className="h-4 w-4" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{new Date(m.created_at).toLocaleString("pt-BR")}</span>
                      <span className="rounded bg-muted px-1.5 py-0.5">{m.status}</span>
                    </div>
                    <p className="mt-1 text-sm whitespace-pre-wrap break-words">{m.body}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
