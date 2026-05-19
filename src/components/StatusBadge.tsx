import { cn } from "@/lib/utils";
import type { OrderStatus, QuoteStatus } from "@/lib/mock-data";
import { orderStatusLabel, quoteStatusLabel } from "@/lib/mock-data";

const quoteStyles: Record<QuoteStatus, string> = {
  rascunho: "bg-muted text-muted-foreground",
  enviado: "bg-info/15 text-info",
  aprovado: "bg-success/15 text-success",
  recusado: "bg-destructive/15 text-destructive",
};

const orderStyles: Record<OrderStatus, string> = {
  novo: "bg-realtime/15 text-realtime",
  separando: "bg-warning/20 text-warning-foreground",
  pronto: "bg-primary-soft text-primary",
  entregue: "bg-success/15 text-success",
};

export function QuoteBadge({ status }: { status: QuoteStatus }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium", quoteStyles[status])}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {quoteStatusLabel[status]}
    </span>
  );
}

export function OrderBadge({ status }: { status: OrderStatus }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium", orderStyles[status])}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {orderStatusLabel[status]}
    </span>
  );
}
