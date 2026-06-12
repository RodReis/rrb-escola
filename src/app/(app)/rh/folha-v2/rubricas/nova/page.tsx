import { AlertCircle } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Panel } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { createRubricaAction } from "@/lib/actions/folha-cadastros";
import { requirePermission } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

const METODOS = [
  "salario_base","hora_aula","valor_contratual","dsr","hora_atividade",
  "inss","inss_rpa","irrf","percentual_sobre_base","fgts",
  "inss_patronal","provisao_13","provisao_ferias","manual",
];

export default async function NovaRubricaPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string }>;
}) {
  await requirePermission("rh.folha-v2", "create");
  const { erro } = await searchParams;

  return (
    <div className="grid gap-8">
      <PageHeader
        breadcrumb={[
          { label: "RH", href: "/rh/funcionarios" },
          { label: "Folha v2", href: "/rh/folha-v2" },
          { label: "Rubricas", href: "/rh/folha-v2/rubricas" },
          { label: "Nova" },
        ]}
        title="Nova rubrica"
        description="Cadastre uma verba do motor de rubricas."
      />

      {erro ? (
        <div className="flex items-center gap-2 rounded-ui bg-danger/10 p-3 text-sm font-semibold text-danger">
          <AlertCircle size={16} />
          {erro}
        </div>
      ) : null}

      <Panel className="p-6">
        <form action={createRubricaAction} className="grid gap-5 max-w-2xl">
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
            <legend className="px-1 text-xs font-bold uppercase tracking-kicker text-ink/55">
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
            <Button type="submit" variant="primary">Salvar</Button>
            <a href="/rh/folha-v2/rubricas" className="ds-button ds-button-secondary">Cancelar</a>
          </div>
        </form>
      </Panel>
    </div>
  );
}
