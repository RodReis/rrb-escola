import { notFound } from "next/navigation";
import { AlertCircle } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Panel } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { updateRubricaAction, deleteRubricaAction } from "@/lib/actions/folha-cadastros";
import { createServerClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

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

export default async function EditarRubricaPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ erro?: string }>;
}) {
  await requirePermission("rh.folha-v2", "update");
  const { id } = await params;
  const { erro } = await searchParams;

  const supabase = await createServerClient();
  const { data } = await supabase.from("folha_rubricas").select("*").eq("id", id).single();
  if (!data) notFound();
  const r = data as unknown as RubricaRow;

  return (
    <div className="grid gap-8">
      <PageHeader
        breadcrumb={[
          { label: "RH", href: "/rh/funcionarios" },
          { label: "Folha v2", href: "/rh/folha-v2" },
          { label: "Rubricas", href: "/rh/folha-v2/rubricas" },
          { label: r.codigo },
        ]}
        title={`Editar — ${r.codigo}`}
        description={r.nome}
      />

      {erro ? (
        <div className="flex items-center gap-2 rounded-ui bg-danger/10 p-3 text-sm font-semibold text-danger">
          <AlertCircle size={16} />
          {erro}
        </div>
      ) : null}

      <Panel className="p-6">
        <form action={updateRubricaAction} className="grid gap-5 max-w-2xl">
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
            <Button type="submit" variant="primary">Salvar</Button>
            <a href="/rh/folha-v2/rubricas" className="ds-button ds-button-secondary">Cancelar</a>
          </div>
        </form>
      </Panel>

      <Panel className="p-6 border-danger/30">
        <p className="mb-3 text-xs font-bold uppercase tracking-kicker text-danger/70">Zona de perigo</p>
        <p className="mb-4 text-sm text-ink/70">
          Excluir esta rubrica remove permanentemente. Verifique se não está vinculada a perfis ou contratos antes.
        </p>
        <form action={deleteRubricaAction}>
          <input type="hidden" name="id" value={r.id} />
          <Button type="submit" variant="secondary" className="text-danger border-danger/40 hover:bg-danger/10">
            Excluir rubrica
          </Button>
        </form>
      </Panel>
    </div>
  );
}
