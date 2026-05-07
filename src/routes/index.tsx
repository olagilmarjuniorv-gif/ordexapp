import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  component: () => <Navigate to="/dashboard" />,
  head: () => ({
    meta: [
      { title: "ObraGestor — Gestão para lojas de material de construção" },
      { name: "description", content: "Sistema simples e rápido para orçamentos, pedidos e entregas em lojas de material de construção." },
    ],
  }),
});
