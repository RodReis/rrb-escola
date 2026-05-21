"use client";

import { useState } from "react";
import { Send } from "lucide-react";
import { Panel } from "@/components/ui/card";
import { criarComunicadoAction } from "@/lib/actions/comunicados";

type AlunoLite = { id: string; nome: string };

export function NovoComunicadoForm({ alunos }: { alunos: AlunoLite[] }) {
  const [alcance, setAlcance] = useState<"geral" | "individual">("geral");
  const [enviando, setEnviando] = useState(false);

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
              value="individual"
              checked={alcance === "individual"}
              onChange={() => setAlcance("individual")}
            />
            Aluno específico
          </label>
        </fieldset>

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
          <button className="ds-button ds-button-primary" disabled={enviando}>
            <Send size={14} /> {enviando ? "Enviando…" : "Enviar comunicado"}
          </button>
        </div>
      </form>
    </Panel>
  );
}
