export type DashTab = "financeiro" | "comercial" | "secretaria" | "pedagogico";

export function parseTab(value: string | undefined): DashTab {
  // Backward compat: aba=alunos -> secretaria
  if (value === "alunos" || value === "secretaria") return "secretaria";
  if (value === "pedagogico") return "pedagogico";
  if (value === "comercial") return "comercial";
  return "financeiro";
}
