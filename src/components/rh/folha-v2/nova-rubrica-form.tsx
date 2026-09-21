"use client";

import { createRubricaAction } from "@/lib/actions/folha-cadastros";
import { useAction } from "@/lib/hooks/use-action";
import { Button } from "@/components/ui/button";

const METODOS = [
  "salario_base","hora_aula","valor_contratual","dsr","hora_atividade",
  "inss","inss_rpa","irrf","percentual_sobre_base","fgts",
  "inss_patronal","provisao_13","provisao_ferias","manual",
];

export function NovaRubricaForm() {
  const { run, pending } = useAction(createRubricaAction, {
    success: "Rubrica criada.",
    error: "Falha ao criar a rubrica.",
  });

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    run(new FormData(e.currentTarget));
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-5 max-w-2xl">
      <div className="grid grid-cols-2 gap-4">
        <label className="flex flex-col gap-1 text-sm font-medium text-ink/80">
          Código <input name="codigo" required maxLength={20} placeholder="EX: SAL_BASE" />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-ink/80">
          Ordem holerite <input name="ordem_holerite" type="number" min="0" defaultValue="100" />
        </label>
      </div>
      <label className="flex flex-col gap-1 text-sm font-medium text-ink/80">
        Nome <input name="nome" required maxLength={100} placeholder="Salário Base" />
      </label>
      <div className="grid grid-cols-2 gap-4">
        <label className="flex flex-col gap-1 text-sm font-medium text-ink/80">
          Tipo
          <select name="tipo" required>
            <option value="provento">Provento</option>
            <option value="desconto">Desconto</option>
            <option value="base">Base</option>
            <option value="informativa">Informativa</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-ink/80">
          Método de cálculo
          <select name="metodo_calculo" required>
            <option value="">Selecione…</option>
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
          {(["incide_inss","incide_irrf","incide_fgts","incide_dsr"] as const).map((k) => (
            <label key={k} className="flex items-center gap-2 text-sm font-medium text-ink/80 cursor-pointer">
              <input type="checkbox" name={k} />
              {k.replace("incide_", "").toUpperCase()}
            </label>
          ))}
        </div>
      </fieldset>
      <label className="flex items-center gap-2 text-sm font-medium text-ink/80 cursor-pointer">
        <input type="checkbox" name="ativa" defaultChecked />
        Rubrica ativa
      </label>
      <div className="flex gap-3">
        <Button type="submit" variant="primary" loading={pending}>Salvar</Button>
        <a href="/rh/folha-v2/rubricas" className="ds-button ds-button-secondary">Cancelar</a>
      </div>
    </form>
  );
}
