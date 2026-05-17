import { createServerClient } from "@/lib/supabase/server";
import { DEFAULT_SCHOOL_ID } from "@/lib/constants";

export type TipoVagaBolsa = "bolsa_integral" | "bolsa_parcial" | "permuta" | "gratuita";

export type BolsistaRow = {
  matriculaId: string;
  alunoId: string;
  nome: string;
  fotoUrl: string | null;
  matriculaCodigo: string | null;
  celular: string | null;
  email: string | null;
  serie: string;
  turma: string;
  segmento: string;
  tipoVaga: TipoVagaBolsa;
  percentualBolsa: number;
  responsavelNome: string | null;
  responsavelCelular: string | null;
  responsavelParentesco: string | null;
  planoNome: string | null;
  valorMensalidade: number;
  receitaPerdidaMes: number;
};

function pickOne<T>(v: T | T[] | null | undefined): T | null {
  return Array.isArray(v) ? v[0] ?? null : v ?? null;
}

export async function listBolsistas(escolaId: string = DEFAULT_SCHOOL_ID): Promise<BolsistaRow[]> {
  const supabase = await createServerClient();
  const anoLetivo = new Date().getFullYear();

  const [matriculasRes, valoresRes] = await Promise.all([
    supabase
      .from("matriculas")
      .select(`
        id, tipo_vaga, percentual_bolsa,
        alunos (
          id, nome, foto_url, matricula_codigo, celular, email,
          responsaveis_aluno ( nome, celular, telefone, parentesco, responsavel_financeiro )
        ),
        series ( nome, segmento ),
        turmas ( nome ),
        planos ( nome, valor_mensalidade )
      `)
      .eq("escola_id", escolaId)
      .eq("status", "ativa")
      .eq("ano_letivo", anoLetivo)
      .in("tipo_vaga", ["bolsa_integral", "bolsa_parcial", "permuta", "gratuita"]),
    supabase
      .from("valores_praticados")
      .select("segmento, valor_mensalidade")
      .eq("escola_id", escolaId)
      .eq("ano_letivo", anoLetivo)
      .eq("ordem_filho", 1),
  ]);

  const valorPorSegmento = new Map<string, number>();
  for (const v of (valoresRes.data ?? []) as Array<{ segmento: string; valor_mensalidade: number | string }>) {
    valorPorSegmento.set(v.segmento, Number(v.valor_mensalidade));
  }

  return ((matriculasRes.data ?? []) as any[]).map((m): BolsistaRow => {
    const aluno = pickOne(m.alunos);
    const serie = pickOne(m.series);
    const turma = pickOne(m.turmas);
    const plano = pickOne(m.planos);
    const responsaveis = (aluno?.responsaveis_aluno ?? []) as Array<{
      nome?: string;
      celular?: string;
      telefone?: string;
      parentesco?: string;
      responsavel_financeiro?: boolean;
    }>;
    const responsavel =
      responsaveis.find((r) => r.responsavel_financeiro) ??
      responsaveis[0] ??
      null;

    const segmento = serie?.segmento ?? "outros";
    const valorReferencia = valorPorSegmento.get(segmento) ?? Number(plano?.valor_mensalidade ?? 0);
    const tipoVaga = m.tipo_vaga as TipoVagaBolsa;
    const percentualBolsa = Number(m.percentual_bolsa ?? 0);
    const receitaPerdidaMes =
      tipoVaga === "bolsa_parcial"
        ? valorReferencia * (percentualBolsa / 100)
        : valorReferencia;

    return {
      matriculaId: m.id,
      alunoId: aluno?.id ?? "",
      nome: aluno?.nome ?? "—",
      fotoUrl: aluno?.foto_url ?? null,
      matriculaCodigo: aluno?.matricula_codigo ?? null,
      celular: aluno?.celular ?? null,
      email: aluno?.email ?? null,
      serie: serie?.nome ?? "—",
      turma: turma?.nome ?? "—",
      segmento,
      tipoVaga,
      percentualBolsa,
      responsavelNome: responsavel?.nome ?? null,
      responsavelCelular: responsavel?.celular ?? responsavel?.telefone ?? null,
      responsavelParentesco: responsavel?.parentesco ?? null,
      planoNome: plano?.nome ?? null,
      valorMensalidade: valorReferencia,
      receitaPerdidaMes,
    };
  }).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}
