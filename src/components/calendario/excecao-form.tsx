import { salvarExcecaoAction } from "@/lib/actions/calendario";
import { Panel } from "@/components/ui/card";

export function ExcecaoForm({ calendarioId }: { calendarioId: string }) {
  return (
    <Panel className="grid gap-4">
      <h2 className="font-bold text-ink">Adicionar feriado ou recesso</h2>
      <form action={salvarExcecaoAction} className="grid gap-4">
        <input type="hidden" name="calendario_id" value={calendarioId} />

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-1 text-sm">
            Tipo
            <select name="tipo" required defaultValue="feriado">
              <option value="feriado">Feriado</option>
              <option value="recesso">Recesso</option>
            </select>
          </label>
          <label className="grid gap-1 text-sm">
            Descrição
            <input
              type="text"
              name="descricao"
              required
              maxLength={120}
              placeholder="Ex: Carnaval"
            />
          </label>
          <label className="grid gap-1 text-sm">
            Data início
            <input type="date" name="data_inicio" required />
          </label>
          <label className="grid gap-1 text-sm">
            Data fim
            <input type="date" name="data_fim" required />
          </label>
        </div>

        <div className="flex justify-end">
          <button className="ds-button ds-button-accent">
            Adicionar exceção
          </button>
        </div>
      </form>
    </Panel>
  );
}
