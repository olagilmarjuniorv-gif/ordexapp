export type Granularity = "day" | "week" | "month" | "year";

export function getPeriodRange(g: Granularity): { from: string; to: string } {
  const now = new Date();
  if (g === "day") {
    const f = new Date(now); f.setHours(0, 0, 0, 0);
    const t = new Date(now); t.setHours(23, 59, 59, 999);
    return { from: f.toISOString(), to: t.toISOString() };
  }
  if (g === "week") {
    const d = now.getDay();
    const diff = d === 0 ? 6 : d - 1;
    const f = new Date(now); f.setDate(now.getDate() - diff); f.setHours(0, 0, 0, 0);
    const t = new Date(f); t.setDate(f.getDate() + 6); t.setHours(23, 59, 59, 999);
    return { from: f.toISOString(), to: t.toISOString() };
  }
  if (g === "month") {
    const f = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    const t = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    return { from: f.toISOString(), to: t.toISOString() };
  }
  const f = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
  const t = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
  return { from: f.toISOString(), to: t.toISOString() };
}

export const GRANULARITY_LABELS: Record<Granularity, string> = {
  day: "Hoje",
  week: "Semana",
  month: "Mês",
  year: "Ano",
};
