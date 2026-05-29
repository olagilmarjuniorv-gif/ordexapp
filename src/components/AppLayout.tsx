import { Link, Outlet, useNavigate, useRouterState, Navigate } from "@tanstack/react-router";
import {
  LayoutDashboard, Users, ShoppingBag, LogOut, 
  ShieldCheck, Building2, ChefHat, LayoutGrid, History, BookOpen, MessageCircle, LifeBuoy, Plug, Store, Wallet, DollarSign,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import { usePedidoProntoNotify } from "@/hooks/use-pedido-pronto-notify";
import { getCompanyById } from "@/lib/companies.functions";

export function AppLayout() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const { signOut, profile, role, isAdmin, isSuperAdmin, isAtendente, isCozinha, companyId } = useAuth();

  // Notificação interna quando pedido fica "pronto" (admin + atendente).
  usePedidoProntoNotify((isAdmin && !isSuperAdmin) || isAtendente);

  // Nome da empresa para identidade visual (sidebar + topo)
  const getCompanyByIdFn = useServerFn(getCompanyById);
  const companyQuery = useQuery({
    queryKey: ["company-name", companyId],
    queryFn: () => getCompanyByIdFn({ data: {} }),
    enabled: !!companyId && !isSuperAdmin,
    staleTime: 60_000,
  });
  const companyName = (companyQuery.data as any)?.name as string | undefined;

  // Cozinha: layout minimal, vê só /cozinha e /pedidos
  if (isCozinha) {
    if (!path.startsWith("/cozinha") && !path.startsWith("/pedidos")) return <Navigate to="/cozinha" />;
    return (
      <div className="min-h-screen bg-background">
        <header className="sticky top-0 z-20 flex items-center justify-between border-b border-border bg-background/95 backdrop-blur px-4 py-3">
          <div className="flex items-baseline gap-2">
            <span className="brand-wordmark text-xl text-foreground">SaiuPedido</span>
            <span className="text-sm text-muted-foreground">· cozinha</span>
          </div>
          <button
            onClick={async () => { await signOut(); navigate({ to: "/login" }); }}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Sair
          </button>
        </header>
        <main className="mx-auto max-w-7xl p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    );
  }

  type NavItem = { to: string; label: string; icon: any };
  let nav: NavItem[];
  if (isAtendente) {
    nav = [
      { to: "/dashboard", label: "Início", icon: LayoutDashboard },
      { to: "/pedidos", label: "Pedidos", icon: ShoppingBag },
      { to: "/mesas", label: "Mesas", icon: LayoutGrid },
      { to: "/mensagens", label: "Mensagens", icon: MessageCircle },
      { to: "/clientes", label: "Clientes", icon: Users },
      { to: "/financeiro", label: "Financeiro", icon: DollarSign },
    ];
  } else if (isSuperAdmin) {
    nav = [
      { to: "/dashboard", label: "Início", icon: LayoutDashboard },
      { to: "/empresas", label: "Empresas", icon: Building2 },
      { to: "/meu-restaurante", label: "Meu Restaurante", icon: Store },
      { to: "/pagamentos", label: "Pagamentos", icon: Wallet },
      { to: "/financeiro", label: "Financeiro", icon: DollarSign },
      { to: "/usuarios", label: "Usuários", icon: ShieldCheck },
      { to: "/chamados", label: "Chamados", icon: LifeBuoy },
      { to: "/conectores", label: "Conectores", icon: Plug },
      { to: "/historico", label: "Auditoria", icon: History },
    ];
  } else if (isAdmin) {
    nav = [
      { to: "/dashboard", label: "Início", icon: LayoutDashboard },
      { to: "/pedidos", label: "Pedidos", icon: ShoppingBag },
      { to: "/mesas", label: "Mesas", icon: LayoutGrid },
      { to: "/cozinha", label: "Cozinha", icon: ChefHat },
      { to: "/cardapio", label: "Cardápio", icon: BookOpen },
      { to: "/clientes", label: "Clientes", icon: Users },
      { to: "/mensagens", label: "Mensagens", icon: MessageCircle },
      { to: "/conectores", label: "Conectores", icon: Plug },
      { to: "/meu-restaurante", label: "Meu Restaurante", icon: Store },
      { to: "/pagamentos", label: "Pagamentos", icon: Wallet },
      { to: "/financeiro", label: "Financeiro", icon: DollarSign },
      { to: "/suporte", label: "Suporte", icon: LifeBuoy },
      { to: "/historico", label: "Histórico", icon: History },
      { to: "/usuarios", label: "Usuários", icon: ShieldCheck },
    ];
  } else {
    nav = [{ to: "/dashboard", label: "Início", icon: LayoutDashboard }];
  }

  const homePath = "/dashboard";

  const handleLogout = async () => {
    await signOut();
    navigate({ to: "/login" });
  };

  return (
    <div className="min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col bg-sidebar text-sidebar-foreground lg:flex shadow-elevated">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/[0.04] to-transparent" />
        <div className="relative flex items-center px-5 py-5 border-b border-sidebar-border">
          <div className="min-w-0">
            <p className="brand-wordmark text-2xl text-white leading-none truncate">SaiuPedido</p>
            {companyName ? (
              <p className="text-xs text-sidebar-foreground/80 mt-1 truncate font-medium">{companyName}</p>
            ) : null}
            <p className="text-[11px] text-sidebar-foreground/60 mt-2 truncate flex items-center gap-1.5">
              <span className="realtime-dot" />
              {profile?.full_name || role || "Operação"}
            </p>
          </div>
        </div>
        <nav className="relative flex-1 space-y-1 p-3 overflow-y-auto">
          {nav.map((n) => {
            const active = path.startsWith(n.to);
            return (
              <Link
                key={n.to}
                to={n.to}
                className={cn(
                  "group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all",
                  active
                    ? "bg-sidebar-accent text-sidebar-primary-foreground shadow-glow-brand"
                    : "text-sidebar-foreground/75 hover:bg-white/5 hover:text-sidebar-foreground"
                )}
              >
                {active && (
                  <span className="absolute left-0 top-1/2 h-6 w-0.5 -translate-y-1/2 rounded-r bg-sidebar-primary" />
                )}
                <n.icon className={cn("h-4.5 w-4.5 transition-transform", active && "text-sidebar-primary scale-110")} />
                {n.label}
              </Link>
            );
          })}
        </nav>
        <div className="relative p-3 border-t border-sidebar-border">
          <button onClick={handleLogout} className="w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-sidebar-foreground/70 hover:bg-white/5 hover:text-sidebar-foreground transition-colors">
            <LogOut className="h-4 w-4" />
            Sair
          </button>
        </div>
      </aside>

      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-border bg-background/95 backdrop-blur px-4 py-3 lg:hidden">
        <Link to={homePath} className="flex items-baseline">
          <span className="brand-wordmark text-xl text-foreground">SaiuPedido</span>
        </Link>
        <button onClick={handleLogout} className="text-sm text-muted-foreground">Sair</button>
      </header>

      <main className="lg:pl-60 pb-20 lg:pb-8">
        <div className="mx-auto max-w-6xl px-4 py-5 lg:px-8 lg:py-8">
          <Outlet />
        </div>
      </main>

      <nav className="fixed bottom-0 left-0 right-0 z-30 flex overflow-x-auto border-t border-border bg-background/95 backdrop-blur lg:hidden">
        {nav.map((n) => {
          const active = path.startsWith(n.to);
          return (
            <Link
              key={n.to}
              to={n.to}
              className={cn(
                "flex shrink-0 min-w-[68px] flex-col items-center gap-1 px-2 py-2.5 text-[10.5px] font-medium transition-colors",
                active ? "text-primary" : "text-muted-foreground"
              )}
            >
              <n.icon className={cn("h-5 w-5", active && "scale-110")} />
              <span className="truncate max-w-[64px]">{n.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
