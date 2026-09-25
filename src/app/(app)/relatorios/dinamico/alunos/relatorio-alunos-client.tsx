"use client";

import { FiltrosAlunoForm } from "@/components/relatorio-dinamico/filtros-aluno";
import { RelatorioDinamicoPage, type RelatorioDinamicoPageProps } from "@/components/relatorio-dinamico/relatorio-dinamico-page";
import type { OpcoesAluno } from "@/lib/relatorio-dinamico/dados/opcoes";

export function RelatorioAlunosClient(props: Omit<RelatorioDinamicoPageProps, "filtros" | "entidade"> & { opcoes: OpcoesAluno }) {
  const { opcoes, ...rest } = props;
  return <RelatorioDinamicoPage entidade="aluno" {...rest} filtros={(onChange) => <FiltrosAlunoForm opcoes={opcoes} onChange={onChange} />} />;
}
