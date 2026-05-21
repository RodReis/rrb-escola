import { CalendarOff } from "lucide-react";
import { Panel } from "@/components/ui/card";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { excluirExcecaoAction } from "@/lib/actions/calendario";
import type { CalendarioExcecao } from "@/lib/calendario/types";

const TIPO_LABEL: Record<string, string> = {
  feriado: "Feriado",
  recesso: "Recesso",
};

const TIPO_COLOR: Record<string, string> = {
  feriado: "bg-danger/10 text-danger",
  recesso: "bg-warning/10 text-warning",
};

function formatPeriodo(inicio: string, fim: string): string {
  const fmt = (d: string) => d.split("-").reverse().join("/");
  return inicio === fim ? fmt(inicio) : `${fmt(inicio)} – ${fmt(fim)}`;
}

export function ExcecoesList({ excecoes }: { excecoes: CalendarioExcecao[] }) {
  return (
    <Panel className="grid gap-3">
      <h2 className="font-bold text-ink">Feriados e recessos</h2>

      {excecoes.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-8 text-ink/40">
          <CalendarOff size={24} />
          <p className="text-sm">Nenhuma exceção cadastrada.</p>
        </div>
      ) : (
        <ul className="grid gap-2">
          {excecoes.map((ex) => (
            <li
              key={ex.id}
              className="flex items-center justify-between gap-3 rounded-ui border border-line p-3"
            >
              <div className="flex items-center gap-3">
                <span className={`rounded-pill px-2 py-0.5 text-[0.66rem] font-semibold uppercase ${TIPO_COLOR[ex.tipo]}`}>
                  {TIPO_LABEL[ex.tipo]}
                </span>
                <div>
                  <p className="text-sm font-semibold text-ink">{ex.descricao}</p>
                  <p className="text-xs text-ink/55">{formatPeriodo(ex.dataInicio, ex.dataFim)}</p>
                </div>
              </div>
              <form action={excluirExcecaoAction}>
                <input type="hidden" name="id" value={ex.id} />
                <ConfirmButton
                  message={`Excluir a exceção "${ex.descricao}"?`}
                  className="ds-button ds-button-ghost text-xs"
                >
                  Excluir
                </ConfirmButton>
              </form>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
