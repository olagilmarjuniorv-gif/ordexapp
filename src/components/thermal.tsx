import type { ReactNode } from "react";

export function formatBRL(v: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(v) || 0);
}

export function canalLabel(canal: string, external_provider?: string | null): string {
  if (external_provider === "ifood") return "iFood";
  if (external_provider) return `Externo (${external_provider})`;
  const map: Record<string, string> = {
    salao: "Salão",
    balcao: "Balcão",
    retirada: "Retirada",
    delivery: "Delivery",
    whatsapp: "WhatsApp",
  };
  return map[canal] ?? canal;
}

export function ThermalStyles() {
  return (
    <style>{`
      @page { size: 80mm auto; margin: 0; }
      html, body { background: #fff; }
      .thermal {
        width: 76mm;
        margin: 0 auto;
        padding: 6mm 4mm;
        color: #000;
        font-family: 'Courier New', ui-monospace, monospace;
        font-size: 12px;
        line-height: 1.35;
      }
      .thermal .center { text-align: center; }
      .thermal .bold { font-weight: 700; }
      .thermal .big { font-size: 16px; }
      .thermal .small { font-size: 11px; }
      .thermal .italic { font-style: italic; }
      .thermal .indent { padding-left: 8px; }
      .thermal .row { display: flex; justify-content: space-between; gap: 8px; }
      .thermal .row > span:last-child { white-space: nowrap; }
      .thermal .sep { border-top: 1px dashed #000; margin: 6px 0; }
      .thermal .item { margin-bottom: 4px; }
      .thermal .mt { margin-top: 16px; }
      .thermal .btn {
        display: inline-block; padding: 8px 14px; border: 1px solid #000; background: #000; color: #fff;
        font-weight: 700; border-radius: 6px; cursor: pointer;
      }
      @media print {
        .no-print { display: none !important; }
        .thermal { padding: 2mm; }
      }
    `}</style>
  );
}

export function ThermalSheet({ children }: { children: ReactNode }) {
  return <div className="thermal">{children}</div>;
}
