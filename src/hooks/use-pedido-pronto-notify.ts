import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/**
 * Notifica internamente (toast) sempre que um pedido for marcado como "pronto".
 * Visível para admin/atendente. RLS já garante isolamento por empresa.
 * Preparado para futuras integrações (WhatsApp/iFood) — hoje só registra UI.
 */
export function usePedidoProntoNotify(enabled: boolean) {
  const qc = useQueryClient();
  const seen = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!enabled) return;
    const channel = supabase
      .channel("rt-pedido-pronto")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "pedidos" },
        (payload: any) => {
          const next = payload.new;
          const prev = payload.old;
          if (!next || next.status !== "pronto") return;
          if (prev && prev.status === "pronto") return;
          const id: string = next.id;
          if (seen.current.has(id)) return;
          seen.current.add(id);

          try {
            const audio = new (window.AudioContext || (window as any).webkitAudioContext)();
            const o = audio.createOscillator();
            const g = audio.createGain();
            o.connect(g); g.connect(audio.destination);
            o.frequency.value = 1040;
            g.gain.setValueAtTime(0.0001, audio.currentTime);
            g.gain.exponentialRampToValueAtTime(0.2, audio.currentTime + 0.02);
            g.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + 0.35);
            o.start(); o.stop(audio.currentTime + 0.35);
          } catch {}

          toast.success("Pedido pronto", {
            description: `Pedido #${String(id).slice(0, 4).toUpperCase()} saiu da cozinha.`,
            duration: 8000,
          });
          qc.invalidateQueries({ queryKey: ["pedidos"] });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [enabled, qc]);
}
