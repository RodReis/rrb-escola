import "server-only";
import { createServerClient } from "@/lib/supabase/server";
import type { FiltrosAluno, RegistroResumo } from "../tipos";
import type { AlunoCtx, ContatoRow, EnderecoRow, MedicoRow, ResponsavelRow } from "../catalogo/aluno";
import { emLotes } from "./lotes";

const COLLATOR = new Intl.Collator("pt-BR", { sensitivity: "base" });
const um = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? v[0] ?? null : v ?? null);

export async function listarRegistrosAluno(f: FiltrosAluno): Promise<RegistroResumo[]> {
  const supabase = await createServerClient();
  let q = supabase
    .from("matriculas")
    .select("aluno_id, alunos!inner(nome), series!inner(nome, segmento), turmas(nome)")
    .eq("ano_letivo", f.ano)
    .in("status", f.status);
  if (f.valores.length > 0) {
    if (f.filtrarPor === "serie") q = q.in("serie_id", f.valores);
    if (f.filtrarPor === "turma") q = q.in("turma_id", f.valores);
    if (f.filtrarPor === "segmento") q = q.in("series.segmento", f.valores);
  }
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? [])
    .map((m) => {
      const serie = um(m.series as { nome: string } | { nome: string }[]);
      const turma = um(m.turmas as { nome: string } | { nome: string }[] | null);
      return {
        id: m.aluno_id as string,
        nome: um(m.alunos as { nome: string } | { nome: string }[])?.nome ?? "",
        detalhe: [serie?.nome, turma?.nome].filter(Boolean).join(" · "),
      };
    })
    .sort((a, b) => COLLATOR.compare(a.nome, b.nome));
}

const SELECT_ALUNO =
  "id, matricula_codigo, nome, sexo, data_nascimento, naturalidade, nacionalidade, celular, cpf, rg, orgao_expedidor, data_expedicao, certidao_livro, certidao_folha, certidao_numero, certidao_cartorio, email, codigo_inep, etnia";
const FRAGMENTO: Record<string, string> = {
  responsaveis: "responsaveis_aluno(nome, cpf, telefone, celular, parentesco, email, responsavel_financeiro, responsavel_pedagogico)",
  contatos: "contatos_aluno(nome, telefone, celular, parentesco, principal)",
  enderecos: "enderecos_aluno(logradouro, numero, complemento, bairro, cidade, uf, cep, principal)",
  medico: "informacoes_medicas(alergia_descricao, necessidade_especial_descricao, doenca_grave_descricao, remedio_especial_descricao, tipo_sanguineo, plano_saude)",
};

type LinhaMatricula = {
  aluno_id: string; turma_id: string; codigo: string | null; ano_letivo: number; status: string; data_matricula: string | null;
  series: { nome: string; segmento: string | null } | { nome: string; segmento: string | null }[] | null;
  turmas: { nome: string; turno: string | null } | { nome: string; turno: string | null }[] | null;
  alunos: Record<string, unknown> | Record<string, unknown>[];
};

async function numerosDeChamada(turmaIds: string[], ano: number): Promise<Map<string, number>> {
  const supabase = await createServerClient();
  const mapa = new Map<string, number>();
  const porTurma = new Map<string, { alunoId: string; nome: string }[]>();
  for (const lote of emLotes(turmaIds)) {
    const { data, error } = await supabase
      .from("matriculas")
      .select("aluno_id, turma_id, alunos!inner(nome, nome_normalizado)")
      .eq("ano_letivo", ano)
      .eq("status", "ativa")
      .in("turma_id", lote);
    if (error) throw error;
    for (const m of data ?? []) {
      const a = um(m.alunos as { nome: string; nome_normalizado: string | null } | { nome: string; nome_normalizado: string | null }[]);
      const lista = porTurma.get(m.turma_id as string) ?? [];
      lista.push({ alunoId: m.aluno_id as string, nome: a?.nome_normalizado || a?.nome || "" });
      porTurma.set(m.turma_id as string, lista);
    }
  }
  for (const lista of Array.from(porTurma.values())) {
    lista.sort((x, y) => COLLATOR.compare(x.nome, y.nome)).forEach((x, i) => mapa.set(x.alunoId, i + 1));
  }
  return mapa;
}

export async function carregarCtxAlunos(ids: string[], ano: number, relacoes: Set<string>): Promise<AlunoCtx[]> {
  const supabase = await createServerClient();
  const extras = Object.entries(FRAGMENTO).filter(([rel]) => relacoes.has(rel)).map(([, frag]) => frag);
  const select = `aluno_id, turma_id, codigo, ano_letivo, status, data_matricula, series(nome, segmento), turmas(nome, turno), alunos!inner(${[SELECT_ALUNO, ...extras].join(", ")})`;

  const linhas: LinhaMatricula[] = [];
  for (const lote of emLotes(ids)) {
    const { data, error } = await supabase.from("matriculas").select(select).eq("ano_letivo", ano).in("aluno_id", lote);
    if (error) throw error;
    linhas.push(...((data ?? []) as unknown as LinhaMatricula[]));
  }

  const chamada = relacoes.has("chamada")
    ? await numerosDeChamada(Array.from(new Set(linhas.map((l) => l.turma_id))), ano)
    : new Map<string, number>();
  const hoje = new Date();

  return linhas
    .map((l): AlunoCtx => {
      const a = um(l.alunos) as Record<string, unknown>;
      const serie = um(l.series);
      const turma = um(l.turmas);
      return {
        aluno: a as unknown as AlunoCtx["aluno"],
        matricula: {
          codigo: l.codigo, ano_letivo: l.ano_letivo, status: l.status, data_matricula: l.data_matricula,
          serie: serie?.nome ?? null, segmento: serie?.segmento ?? null, turma: turma?.nome ?? null, turno: turma?.turno ?? null,
        },
        responsaveis: (a.responsaveis_aluno as ResponsavelRow[] | undefined) ?? [],
        contatos: (a.contatos_aluno as ContatoRow[] | undefined) ?? [],
        enderecos: (a.enderecos_aluno as EnderecoRow[] | undefined) ?? [],
        medico: um(a.informacoes_medicas as MedicoRow | MedicoRow[] | undefined),
        numeroChamada: chamada.get(l.aluno_id) ?? null,
        hoje,
      };
    })
    .sort((x, y) => COLLATOR.compare(x.aluno.nome, y.aluno.nome));
}
