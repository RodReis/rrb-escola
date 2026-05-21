"use client";

import { useState } from "react";
import { Send } from "lucide-react";
import { Panel } from "@/components/ui/card";
import { criarComunicadoAction } from "@/lib/actions/comunicados";

type AlunoLite = { id: string; nome: string };
type TurmaLite = { id: string; nome: string; anoLetivo: number; serieNome: string };
type SerieLite = { id: string; nome: string };

type Alvo = { tipo: "turma" | "serie"; id: string };

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
  const [turmasSel, setTurmasSel] = useState<Set<string>>(new Set());
  const [seriesSel, setSeriesSel] = useState<Set<string>>(new Set());
  const [enviando, setEnviando] = useState(false);

  function toggle(set: Set<string>, id: string): Set<string> {
    const novo = new Set(set);
    if (novo.has(id)) novo.delete(id);
    else novo.add(id);
    return novo;
  }

  const alvos: Alvo[] = [
    ...Array.from(turmasSel).map((id) => ({ tipo: "turma" as const, id })),
    ...Array.from(seriesSel).map((id) => ({ tipo: "serie" as const, id })),
  ];

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
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="alcance"
              value="geral"
              checked={alcance === "geral"}
              onChange={() => setAlcance("geral")}
            />
            Todos os responsáveis financeiros (alunos ativos)
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="alcance"
              value="segmentado"
              checked={alcance === "segmentado"}
              onChange={() => setAlcance("segmentado")}
            />
            Turmas e séries específicas
          </label>
          <label className="flex items-center gap-2 text-sm">
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
          <div className="grid gap-4 rounded-ui border border-line p-3">
            <input type="hidden" name="alvos" value={JSON.stringify(alvos)} />

            <div className="grid gap-1.5">
              <p className="text-sm font-semibold text-ink">Turmas</p>
              <div className="grid gap-1 sm:grid-cols-2">
                {turmas.map((t) => (
                  <label key={t.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={turmasSel.has(t.id)}
                      onChange={() => setTurmasSel((s) => toggle(s, t.id))}
                      className="h-4 w-4"
                    />
                    {t.serieNome} {t.nome} ({t.anoLetivo})
                  </label>
                ))}
                {turmas.length === 0 && (
                  <span className="text-xs text-ink/55">Nenhuma turma ativa.</span>
                )}
              </div>
            </div>

            <div className="grid gap-1.5">
              <p className="text-sm font-semibold text-ink">Séries</p>
              <div className="grid gap-1 sm:grid-cols-2">
                {series.map((s) => (
                  <label key={s.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={seriesSel.has(s.id)}
                      onChange={() => setSeriesSel((set) => toggle(set, s.id))}
                      className="h-4 w-4"
                    />
                    {s.nome}
                  </label>
                ))}
                {series.length === 0 && (
                  <span className="text-xs text-ink/55">Nenhuma série cadastrada.</span>
                )}
              </div>
            </div>

            {alvos.length === 0 && (
              <p className="text-xs text-danger">Selecione ao menos uma turma ou série.</p>
            )}
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
            disabled={enviando || (alcance === "segmentado" && alvos.length === 0)}
          >
            <Send size={14} /> {enviando ? "Enviando…" : "Enviar comunicado"}
          </button>
        </div>
      </form>
    </Panel>
  );
}
