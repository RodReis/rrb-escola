import { BookOpen, GraduationCap, HandCoins, Sparkles, type LucideIcon } from "lucide-react";

export const TIPO_VAGA_LABEL: Record<string, string> = {
  NORMAL: "Normal",
  BOLSA_50_PORCENTO: "Bolsa 50%",
  BOLSA_INTEGRAL: "Bolsa integral",
  FILHO_PROFESSORA: "Filho de professora",
  FILHO_PROFESSORA_INTEGRAL: "Filho de professora integral",
  PERMUTA: "Permuta",
  ISENTO: "Isento",
};

/**
 * Cor por severidade, não por tipo individual: normal = neutro, desconto
 * parcial (paga alguma coisa) = amber, sem cobrança nenhuma = coral, permuta
 * (troca de serviço, não desconto) = teal. Escaneável em massa numa grid de
 * 1000 linhas sem virar confete de 7 cores.
 */
export const TIPO_VAGA_STYLE: Record<string, string> = {
  NORMAL: "bg-line/60 text-ink/70",
  BOLSA_50_PORCENTO: "bg-warning/10 text-warning",
  FILHO_PROFESSORA: "bg-warning/10 text-warning",
  BOLSA_INTEGRAL: "bg-danger/10 text-danger",
  FILHO_PROFESSORA_INTEGRAL: "bg-danger/10 text-danger",
  ISENTO: "bg-danger/10 text-danger",
  PERMUTA: "bg-accent/10 text-accent",
};

export const TIPO_VAGA_ICON: Record<string, LucideIcon> = {
  NORMAL: BookOpen,
  BOLSA_50_PORCENTO: GraduationCap,
  FILHO_PROFESSORA: GraduationCap,
  BOLSA_INTEGRAL: GraduationCap,
  FILHO_PROFESSORA_INTEGRAL: GraduationCap,
  ISENTO: Sparkles,
  PERMUTA: HandCoins,
};
