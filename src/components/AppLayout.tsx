import { Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, Users, ShoppingBag, Package, LogOut, UtensilsCrossed, ShieldCheck, Building2, ChefHat, LayoutGrid } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";

export function AppLayout() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const { signOut, profile, isAdmin, isSuperAdmin, isAtendente } = useAuth();

  // Atendente: apenas operação. Sem dashboard executivo.
  const baseNav = isAtendente
    ? [
        { to: "/pedidos", label: "Pedidos", icon: ShoppingBag },
        { to: "/mesas", label: "Mesas", icon: LayoutGrid },
        { to: "/cozinha", label: "Cozinha", icon: ChefHat },
        { to: "/produtos", label: "Produtos", icon: Package },
        { to: "/clientes", label: "Clientes", icon: Users },
      ]
    : ([
        { to: "/dashboard", label: "Início", icon: LayoutDashboard },
        { to: "/pedidos", label: "Pedidos", icon: ShoppingBag },
        { to: "/mesas", label: "Mesas", icon: LayoutGrid },
        { to: "/cozinha", label: "Cozinha", icon: ChefHat },
        { to: "/produtos", label: "Produtos", icon: Package },
        { to: "/clientes", label: "Clientes", icon: Users },
      ] as const);

  const adminLinks = [
    ...(isAdmin ? [{ to: "/usuarios", label: "Usuários", icon: ShieldCheck } as const] : []),
    ...(isSuperAdmin ? [{ to: "/empresas", label: "Empresas", icon: Building2 } as const] : []),
  ];
  const nav = [...baseNav, ...adminLinks];
  const handleLogout = async () => {
    await signOut();
    navigate({ to: "/login" });
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col bg-sidebar text-sidebar-foreground lg:flex">
        <div className="flex items-center gap-2 px-5 py-5 border-b border-sidebar-border">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
            <UtensilsCrossed className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="font-display text-base font-semibold leading-none truncate">ORDEX</p>
            <p className="text-[11px] text-sidebar-foreground/60 mt-1 truncate">{profile?.full_name || "Operação food"}</p>
          </div>
        </div>
        <nav className="flex-1 space-y-1 p-3">
          {nav.map((n) => {
            const active = path.startsWith(n.to);
            return (
              <Link
                key={n.to}
                to={n.to}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  active
                    ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-card"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                )}
              >
                <n.icon className="h-4.5 w-4.5" />
                {n.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-3 border-t border-sidebar-border">
          <button onClick={handleLogout} className="w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-sidebar-foreground/70 hover:bg-sidebar-accent">
            <LogOut className="h-4 w-4" />
            Sair
          </button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-border bg-background/95 backdrop-blur px-4 py-3 lg:hidden">
        <Link to={isAtendente ? "/pedidos" : "/dashboard"} className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <UtensilsCrossed className="h-4 w-4" />
          </div>
          <span className="font-display font-semibold">ORDEX</span>
        </Link>
        <button onClick={handleLogout} className="text-sm text-muted-foreground">Sair</button>
      </header>

      <main className="lg:pl-60 pb-20 lg:pb-8">
        <div className="mx-auto max-w-6xl px-4 py-5 lg:px-8 lg:py-8">
          <Outlet />
        </div>
      </main>

      {/* Mobile bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-30 grid grid-cols-5 border-t border-border bg-background/95 backdrop-blur lg:hidden">
        {nav.slice(0, 5).map((n) => {
          const active = path.startsWith(n.to);
          return (
            <Link
              key={n.to}
              to={n.to}
              className={cn(
                "flex flex-col items-center gap-1 py-2.5 text-[10.5px] font-medium transition-colors",
                active ? "text-primary" : "text-muted-foreground"
              )}
            >
              <n.icon className={cn("h-5 w-5", active && "scale-110")} />
              {n.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
