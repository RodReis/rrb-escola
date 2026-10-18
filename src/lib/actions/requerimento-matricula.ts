"use server";

import { requirePermission } from "@/lib/auth/session";
import { buscarDadosRequerimento, type DadosRequerimento } from "@/lib/data/requerimento-matricula";
import { getCredenciamentoVigente } from "@/lib/data/historico";
import type { RequerimentoPdfDados } from "@/lib/documents/requerimento-matricula-pdf";

function assertResponsavelFinanceiro(dados: DadosRequerimento): void {
  if (!dados.responsavelFinanceiro) {
    throw new Error("Responsável financeiro não cadastrado para este aluno.");
  }
}

async function montarPagina(dados: DadosRequerimento, observacoes: string | null): Promise<RequerimentoPdfDados> {
  const credenciamento = dados.matricula.serieId
    ? await getCredenciamentoVigente(dados.matricula.serieId, dados.matricula.anoLetivo)
    : null;

  return {
    dados,
    anoLetivo: dados.matricula.anoLetivo,
    observacoes,
    escola: {
      nome: credenciamento?.nomeFantasia ?? "",
      cnpj: credenciamento?.cnpj ?? null,
      endereco: credenciamento?.endereco ?? null,
      cidade: credenciamento?.cidade ?? null,
      uf: credenciamento?.uf ?? null,
      cep: credenciamento?.cep ?? null,
      telefones: credenciamento?.telefones ?? null,
      email: credenciamento?.email ?? null,
      logoPath: credenciamento?.logoPath ?? null
    },
    secretario: {
      nome: credenciamento?.secretarioNome ?? null,
      cargo: credenciamento?.secretarioCargo ?? "Secretário(a)"
    }
  };
}

export async function previsualizarRequerimentoAction(matriculaId: string): Promise<DadosRequerimento> {
  await requirePermission("historico", "read");

  const dados = await buscarDadosRequerimento(matriculaId);
  assertResponsavelFinanceiro(dados);
  return dados;
}

export async function carregarRequerimentosAction(
  matriculaIds: string[],
  observacoes: string | null
): Promise<{ paginas: RequerimentoPdfDados[]; falhas: Array<{ nome: string; motivo: string }> }> {
  await requirePermission("historico", "read");

  const paginas: RequerimentoPdfDados[] = [];
  const falhas: Array<{ nome: string; motivo: string }> = [];

  for (const matriculaId of matriculaIds) {
    let nomeAluno = matriculaId;
    try {
      const dados = await buscarDadosRequerimento(matriculaId);
      nomeAluno = dados.aluno.nome || matriculaId;

      if (!dados.responsavelFinanceiro) {
        falhas.push({ nome: nomeAluno, motivo: "Responsável financeiro não cadastrado." });
        continue;
      }

      paginas.push(await montarPagina(dados, observacoes));
    } catch (e) {
      falhas.push({ nome: nomeAluno, motivo: e instanceof Error ? e.message : "Erro desconhecido ao montar o requerimento." });
      continue;
    }
  }

  return { paginas, falhas };
}
