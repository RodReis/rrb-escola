"use client";

import { FiltrosRhForm } from "@/components/relatorio-dinamico/filtros-rh";
import { RelatorioDinamicoPage, type RelatorioDinamicoPageProps } from "@/components/relatorio-dinamico/relatorio-dinamico-page";
import type { OpcoesRh } from "@/lib/relatorio-dinamico/dados/opcoes";

type Props = Omit<RelatorioDinamicoPageProps, "filtros" | "entidade"> & { entidade: "funcionario" | "professor"; opcoes: OpcoesRh };

export function RelatorioRhClient({ entidade, opcoes, ...rest }: Props) {
  return (
    <RelatorioDinamicoPage entidade={entidade} {...rest}
      filtros={(onChange) => <FiltrosRhForm opcoes={opcoes} professor={entidade === "professor"} onChange={onChange} />} />
  );
}
