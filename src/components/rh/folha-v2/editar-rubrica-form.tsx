"use client";

import { updateRubricaAction, deleteRubricaAction } from "@/lib/actions/folha-cadastros";
import { useAction } from "@/lib/hooks/use-action";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/card";

const METODOS = [
  "salario_base","hora_aula","valor_contratual","dsr","hora_atividade",
  "inss","inss_rpa","irrf","percentual_sobre_base","fgts",
  "inss_patronal","provisao_13","provisao_ferias","manual",
];

type RubricaRow = {
  id: string; codigo: string; nome: string; tipo: string;
  metodo_calculo: string; incide_inss: boolean; incide_irrf: boolean;
  incide_fgts: boolean; incide_dsr: boolean; ordem_holerite: number; ativa: boolean;
};

export function EditarRubricaForm({ r }: { r: RubricaRow }) {
  const save = useAction(updateRubricaAction, {
    success: "Rubrica salva.",
    error: "Falha ao salvar a rubrica.",
  });
  const remove = useAction(deleteRubricaAction, {
    confirm: {
      title: "Excluir rubrica",
      message: `Tem certeza que quer excluir a rubrica "${r.codigo}"? Verifique se não está vinculada a perfis ou contratos antes.`,
      confirmLabel: "Excluir",
      variant: "danger",
    },
    error: "Falha ao excluir a rubrica.",
  });

  function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    save.run(new FormData(e.currentTarget));
  }

  function handleDelete() {
    const fd = new FormData();
    fd.set("id", r.id);
    remove.run(fd);
  }

  return (
    <>
      <Panel className="p-6">
        <form onSubmit={handleSave} className="grid gap-5 max-w-2xl">
          <input type="hidden" name="id" value={r.id} />
          <div className="grid grid-cols-2 gap-4">
            <label className="flex flex-col gap-1 text-sm font-medium text-ink/80">
              Código <input name="codigo" required maxLength={20} defaultValue={r.codigo} />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium text-ink/80">
              Ordem holerite <input name="ordem_holerite" type="number" min="0" defaultValue={r.ordem_holerite} />
            </label>
          </div>
          <label className="flex flex-col gap-1 text-sm font-medium text-ink/80">
            Nome <input name="nome" required maxLength={100} defaultValue={r.nome} />
          </label>
          <div className="grid grid-cols-2 gap-4">
            <label className="flex flex-col gap-1 text-sm font-medium text-ink/80">
              Tipo
              <select name="tipo" required defaultValue={r.tipo}>
                <option value="provento">Provento</option>
                <option value="desconto">Desconto</option>
                <option value="base">Base</option>
                <option value="informativa">Informativa</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium text-ink/80">
              Método de cálculo
              <select name="metodo_calculo" required defaultValue={r.metodo_calculo}>
                {METODOS.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </label>
          </div>
          <fieldset className="rounded-ui border border-line p-4">
            <legend className="px-1 text-xs font-bold uppercase tracking-kicker text-ink/60">
              Incidências
            </legend>
            <div className="flex flex-wrap gap-6 pt-2">
              <label className="flex items-center gap-2 text-sm font-medium text-ink/80 cursor-pointer">
                <input type="checkbox" name="incide_inss" defaultChecked={r.incide_inss} /> INSS
              </label>
              <label className="flex items-center gap-2 text-sm font-medium text-ink/80 cursor-pointer">
                <input type="checkbox" name="incide_irrf" defaultChecked={r.incide_irrf} /> IRRF
              </label>
              <label className="flex items-center gap-2 text-sm font-medium text-ink/80 cursor-pointer">
                <input type="checkbox" name="incide_fgts" defaultChecked={r.incide_fgts} /> FGTS
              </label>
              <label className="flex items-center gap-2 text-sm font-medium text-ink/80 cursor-pointer">
                <input type="checkbox" name="incide_dsr" defaultChecked={r.incide_dsr} /> DSR
              </label>
            </div>
          </fieldset>
          <label className="flex items-center gap-2 text-sm font-medium text-ink/80 cursor-pointer">
            <input type="checkbox" name="ativa" defaultChecked={r.ativa} />
            Rubrica ativa
          </label>
          <div className="flex gap-3">
            <Button type="submit" variant="primary" loading={save.pending}>Salvar</Button>
            <a href="/rh/folha-v2/rubricas" className="ds-button ds-button-secondary">Cancelar</a>
          </div>
        </form>
      </Panel>

      <Panel className="p-6 border-danger/30">
        <p className="mb-3 text-xs font-bold uppercase tracking-kicker text-danger/70">Zona de perigo</p>
        <p className="mb-4 text-sm text-ink/70">
          Excluir esta rubrica remove permanentemente. Verifique se não está vinculada a perfis ou contratos antes.
        </p>
        <Button
          type="button"
          variant="secondary"
          loading={remove.pending}
          onClick={handleDelete}
          className="text-danger border-danger/40 hover:bg-danger/10"
        >
          Excluir rubrica
        </Button>
      </Panel>
    </>
  );
}
