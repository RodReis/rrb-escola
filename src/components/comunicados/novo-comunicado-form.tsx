"use client";

import { useState } from "react";
import { Send, Users } from "lucide-react";
import { Panel } from "@/components/ui/card";
import { criarComunicadoAction } from "@/lib/actions/comunicados";

type AlunoLite = { id: string; nome: string };
type TurmaLite = { id: string; nome: string; anoLetivo: number; serieId: string; serieNome: string };
type SerieLite = { id: string; nome: string };

type CriterioAlvo = { tipo: "turma" | "serie"; id: string; nome: string };

export function NovoComunicadoForm({
  alunos,
  turmas,
  series,
}: {
  alunos: AlunoLite[];
  turmas: TurmaLite[];
  series: SerieLite[];
}) {
  const [alcance, setAlcance] = useState<"geral" | "segmentado" | "individual">("geral");
  const [enviando, setEnviando] = useState(false);

  // Segmentado: série e turma escolhidas, alunos carregados da turma.
  const [serieId, setSerieId] = useState("");
  const [turmaId, setTurmaId] = useState("");
  const [alunosTurma, setAlunosTurma] = useState<AlunoLite[]>([]);
  const [carregandoAlunos, setCarregandoAlunos] = useState(false);
  // alunoId -> nome (acumula entre turmas)
  const [selecionados, setSelecionados] = useState<Map<string, string>>(new Map());
  // criterio (turmas/séries que originaram a seleção)
  const [criterio, setCriterio] = useState<CriterioAlvo[]>([]);

  const turmasDaSerie = serieId ? turmas.filter((t) => t.serieId === serieId) : [];

  async function carregarAlunos(tId: string) {
    setTurmaId(tId);
    setAlunosTurma([]);
    if (!tId) return;
    setCarregandoAlunos(true);
    try {
      const res = await fetch(`/api/turmas/${tId}/alunos`);
      if (res.ok) {
        const lista = (await res.json()) as AlunoLite[];
        setAlunosTurma(lista);
        // Marca todos os alunos da turma e registra o critério.
        setSelecionados((prev) => {
          const novo = new Map(prev);
          for (const a of lista) novo.set(a.id, a.nome);
          return novo;
        });
        const turma = turmas.find((t) => t.id === tId);
        if (turma) {
          setCriterio((prev) => {
            if (prev.some((c) => c.tipo === "turma" && c.id === tId)) return prev;
            return [...prev, { tipo: "turma", id: tId, nome: `${turma.serieNome} ${turma.nome}` }];
          });
        }
      }
    } finally {
      setCarregandoAlunos(false);
    }
  }

  function toggleAluno(id: string, nome: string) {
    setSelecionados((prev) => {
      const novo = new Map(prev);
      if (novo.has(id)) novo.delete(id);
      else novo.set(id, nome);
      return novo;
    });
  }

  function marcarTodosDaTurma(marcar: boolean) {
    setSelecionados((prev) => {
      const novo = new Map(prev);
      for (const a of alunosTurma) {
        if (marcar) novo.set(a.id, a.nome);
        else novo.delete(a.id);
      }
      return novo;
    });
  }

  const alvos = {
    alunos: Array.from(selecionados.keys()),
    criterio,
  };
  const totalSelecionados = selecionados.size;
  const todosDaTurmaMarcados =
    alunosTurma.length > 0 && alunosTurma.every((a) => selecionados.has(a.id));

  return (
    <Panel className="grid gap-4">
      <h2 className="font-bold text-ink">Novo comunicado</h2>
      <form
        action={criarComunicadoAction}
        encType="multipart/form-data"
        onSubmit={() => setEnviando(true)}
        className="grid gap-4"
      >
        <label className="grid gap-1 text-sm">
          Título
          <input type="text" name="titulo" required maxLength={120} />
        </label>

        <label className="grid gap-1 text-sm">
          Mensagem
          <textarea name="mensagem" required rows={5} maxLength={2000} />
        </label>

        <label className="grid gap-1 text-sm">
          Imagem (opcional)
          <input type="file" name="imagem" accept="image/png,image/jpeg,image/webp" />
          <span className="text-xs text-ink/55">PNG, JPG ou WEBP — máx 5MB.</span>
        </label>

        <fieldset className="grid gap-2">
          <legend className="text-sm font-semibold text-ink">Alcance</legend>
          <label className="!flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="alcance"
              value="geral"
              checked={alcance === "geral"}
              onChange={() => setAlcance("geral")}
            />
            Todos os responsáveis financeiros (alunos ativos)
          </label>
          <label className="!flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="alcance"
              value="segmentado"
              checked={alcance === "segmentado"}
              onChange={() => setAlcance("segmentado")}
            />
            Selecionar por turma
          </label>
          <label className="!flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="alcance"
              value="individual"
              checked={alcance === "individual"}
              onChange={() => setAlcance("individual")}
            />
            Aluno específico
          </label>
        </fieldset>

        {alcance === "segmentado" && (
          <div className="grid gap-4 rounded-ui border border-line bg-muted/20 p-4">
            <input type="hidden" name="alvos" value={JSON.stringify(alvos)} />

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="grid gap-1 text-sm">
                <span className="font-semibold text-ink">1. Série</span>
                <select
                  value={serieId}
                  onChange={(e) => {
                    setSerieId(e.target.value);
                    setTurmaId("");
                    setAlunosTurma([]);
                  }}
                >
                  <option value="">Selecione a série…</option>
                  {series.map((s) => (
                    <option key={s.id} value={s.id}>{s.nome}</option>
                  ))}
                </select>
              </label>

              <label className="grid gap-1 text-sm">
                <span className="font-semibold text-ink">2. Turma</span>
                <select
                  value={turmaId}
                  onChange={(e) => carregarAlunos(e.target.value)}
                  disabled={!serieId}
                >
                  <option value="">
                    {serieId ? "Selecione a turma…" : "Escolha a série primeiro"}
                  </option>
                  {turmasDaSerie.map((t) => (
                    <option key={t.id} value={t.id}>{t.nome}</option>
                  ))}
                </select>
              </label>
            </div>

            {carregandoAlunos && (
              <p className="text-xs text-ink/55">Carregando alunos…</p>
            )}

            {alunosTurma.length > 0 && (
              <div className="grid gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-ink">
                    3. Alunos da turma
                  </span>
                  <label className="!flex items-center gap-1.5 text-xs text-ink/70">
                    <input
                      type="checkbox"
                      checked={todosDaTurmaMarcados}
                      onChange={(e) => marcarTodosDaTurma(e.target.checked)}
                      className="h-4 w-4"
                    />
                    Selecionar todos
                  </label>
                </div>
                <div className="grid max-h-64 gap-1 overflow-y-auto sm:grid-cols-2">
                  {alunosTurma.map((a) => (
                    <label key={a.id} className="!flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={selecionados.has(a.id)}
                        onChange={() => toggleAluno(a.id, a.nome)}
                        className="h-4 w-4"
                      />
                      {a.nome}
                    </label>
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-center gap-2 rounded-ui bg-surface px-3 py-2 text-sm">
              <Users size={14} className="text-brand" />
              <span className="font-semibold text-ink">
                {totalSelecionados} aluno(s) selecionado(s)
              </span>
              {totalSelecionados === 0 && (
                <span className="text-xs text-danger">— selecione ao menos um aluno</span>
              )}
            </div>
          </div>
        )}

        {alcance === "individual" && (
          <label className="grid gap-1 text-sm">
            Aluno
            <select name="aluno_id" required={alcance === "individual"}>
              <option value="">Selecione…</option>
              {alunos.map((a) => (
                <option key={a.id} value={a.id}>{a.nome}</option>
              ))}
            </select>
          </label>
        )}

        <div className="flex justify-end">
          <button
            className="ds-button ds-button-primary"
            disabled={enviando || (alcance === "segmentado" && totalSelecionados === 0)}
          >
            <Send size={14} /> {enviando ? "Enviando…" : "Enviar comunicado"}
          </button>
        </div>
      </form>
    </Panel>
  );
}
