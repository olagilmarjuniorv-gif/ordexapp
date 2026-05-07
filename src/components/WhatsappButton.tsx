import { MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  phone?: string;
  message?: string;
  label?: string;
  className?: string;
  variant?: "solid" | "ghost";
}

export function WhatsappButton({ phone, message = "", label = "WhatsApp", className, variant = "solid" }: Props) {
  const cleaned = (phone ?? "").replace(/\D/g, "");
  const href = `https://wa.me/${cleaned}?text=${encodeURIComponent(message)}`;
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
        variant === "solid"
          ? "bg-whatsapp text-whatsapp-foreground hover:opacity-90 shadow-card"
          : "text-whatsapp hover:bg-whatsapp/10",
        className
      )}
    >
      <MessageCircle className="h-4 w-4" />
      {label}
    </a>
  );
}
