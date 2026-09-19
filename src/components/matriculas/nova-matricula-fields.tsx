"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { StudentCombobox } from "@/components/matriculas/student-combobox";
import { FieldNote } from "@/components/ui/field-note";
import { anoLetivoSugerido } from "@/lib/matriculas/ano-letivo";

type Aluno = {
  id: string;
  nome: string;
  matricula_codigo: string;
  data_nascimento?: string | null;
  matriculas?: { ano_letivo: number; status: string; serie_id?: string | null }[] | null;
};

type Serie = { id: string; nome: string; ordem?: number | null };
type Turma = { id: string; nome: string; serie_id: string; ano_letivo: number; ativo: boolean; turno: string };

const TURNO_LABEL: Record<string, string> = {
  matutino: "MATUTINO",
  vespertino: "VESPERTINO",
  noturno: "NOTURNO",
  integral: "INTEGRAL",
};

function calcularIdade(dataNascimento: string, referencia: Date): number {
  const nascimento = new Date(`${dataNascimento}T00:00:00Z`);
  let idade = referencia.getUTCFullYear() - nascimento.getUTCFullYear();
  const aindaNaoFezAniversario =
    referencia.getUTCMonth() < nascimento.getUTCMonth() ||
    (referencia.getUTCMonth() === nascimento.getUTCMonth() && referencia.getUTCDate() < nascimento.getUTCDate());
  if (aindaNaoFezAniversario) idade -= 1;
  return idade;
}

// Sugere a série seguinte à da última matrícula do aluno (mesma regra da
// re-matrícula). Retorna "" para aluno novato ou série final.
function proximaSerieSugerida(aluno: Aluno | null, series: Serie[]): string {
  const matriculas = aluno?.matriculas ?? [];
  if (matriculas.length === 0) return "";

  const ultima = matriculas.reduce((maior, m) => (m.ano_letivo > maior.ano_letivo ? m : maior));
  if (!ultima.serie_id) return "";

  const ordenadas = [...series].sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));
  const indiceAtual = ordenadas.findIndex((s) => s.id === ultima.serie_id);
  if (indiceAtual === -1) return "";

  return ordenadas[indiceAtual + 1]?.id ?? "";
}

export function NovaMatriculaFields({
  alunos,
  series,
  turmas,
  alunoPre,
}: {
  alunos: Aluno[];
  series: Serie[];
  turmas: Turma[];
  alunoPre?: Aluno | null;
}) {
  const hoje = useMemo(() => new Date(), []);
  const anoAtual = hoje.getFullYear();
  const [aluno, setAluno] = useState<Aluno | null>(alunoPre ?? null);
  const [serieId, setSerieId] = useState(() => proximaSerieSugerida(alunoPre ?? null, series));

  function selecionarAluno(proximo: Aluno | null) {
    setAluno(proximo);
    setSerieId(proximaSerieSugerida(proximo, series));
  }

  const anoSugerido = useMemo(() => {
    const ocupados = (aluno?.matriculas ?? [])
      .filter((m) => m.status === "ativa" || m.status === "concluida")
      .map((m) => m.ano_letivo);
    return anoLetivoSugerido(hoje, ocupados);
  }, [aluno, hoje]);

  const [anoLetivo, setAnoLetivo] = useState(anoSugerido);
  const [anoTocado, setAnoTocado] = useState(false);

  // Enquanto a secretaria não editar o campo, ele acompanha a troca de aluno.
  useEffect(() => {
    if (!anoTocado) setAnoLetivo(anoSugerido);
  }, [anoSugerido, anoTocado]);

  const idade = useMemo(() => {
    if (!aluno?.data_nascimento) return "";
    return calcularIdade(aluno.data_nascimento, new Date(anoLetivo, new Date().getMonth(), new Date().getDate()));
  }, [aluno, anoLetivo]);

  const turmasDisponiveis = turmas.filter((t) => t.serie_id === serieId && t.ano_letivo === anoLetivo && t.ativo);

  const semTurma = Boolean(serieId) && turmasDisponiveis.length === 0;

  const repetindoSerie = Boolean(
    serieId && aluno?.matriculas?.some((m) => m.serie_id === serieId)
  );

  return (
    <>
      {/* content-start: a nota de um campo não pode esticar e descentralizar os vizinhos da linha. */}
      <label className="self-start md:col-span-2">Aluno
        <StudentCombobox alunos={alunos} defaultValue={alunoPre ?? undefined} onSelect={selecionarAluno} />
      </label>
      <label className="self-start">Série
        <select name="serie_id" required value={serieId} onChange={(e) => setSerieId(e.target.value)}>
          <option value="" disabled>Selecione…</option>
          {series.map((item) => <option key={item.id} value={item.id}>{item.nome}</option>)}
        </select>
        {repetindoSerie ? (
          <FieldNote tone="warn">Aluno já cursou esta série. Confirme se é repetência.</FieldNote>
        ) : null}
      </label>
      {/* Wrapper próprio: o link da nota não pode ficar dentro do <label>, senão clicá-lo foca o select. */}
      <div className="grid content-start">
        <label>Turma
          <select key={serieId} name="turma_id" required disabled={!serieId || semTurma} defaultValue="">
            <option value="">{serieId ? "Selecione…" : "Selecione a série primeiro"}</option>
            {turmasDisponiveis.map((t) => {
              const turnoLabel = TURNO_LABEL[t.turno] ?? t.turno.toUpperCase();
              const label = t.nome.trim().toUpperCase() === turnoLabel ? turnoLabel : `${t.nome} — ${turnoLabel}`;
              return <option key={t.id} value={t.id}>{label}</option>;
            })}
          </select>
        </label>
        {semTurma ? (
          <FieldNote tone="warn">
            Nenhuma turma em {anoLetivo} para esta série.{" "}
            <Link href="/turmas" className="font-bold underline underline-offset-2 hover:text-ink">
              Cadastrar turma
            </Link>
          </FieldNote>
        ) : null}
      </div>
      <label className="self-start">Ano letivo
        <input
          name="ano_letivo"
          type="number"
          value={anoLetivo}
          onChange={(e) => { setAnoTocado(true); setAnoLetivo(Number(e.target.value)); }}
        />
        {anoLetivo !== anoAtual ? (
          <FieldNote>
            Matrícula a partir de setembro vale para {anoLetivo}.
          </FieldNote>
        ) : null}
      </label>
      <label className="self-start">Idade<input name="idade_na_matricula" type="number" value={idade} readOnly /></label>
    </>
  );
}
