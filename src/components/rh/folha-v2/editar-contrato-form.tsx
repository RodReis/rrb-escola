"use client";

import { updateContratoAction } from "@/lib/actions/folha-cadastros";
import { useAction } from "@/lib/hooks/use-action";
import { Button } from "@/components/ui/button";
import { CurrencyField } from "@/components/folha/currency-field";

type AulasPorTurno = { manha?: number | null; tarde?: number | null; noite?: number | null } | null;

type ContratoFull = {
  id: string;
  salario_base: number | null;
  valor_hora_aula: number | null;
  aulas_semanais: number | null;
  dependentes_irrf: number;
  data_admissao: string;
  data_desligamento: string | null;
  ativo: boolean;
  cargo: string | null;
  cbo: string | null;
  aulas_por_turno: AulasPorTurno;
  antecipa_13_com_ferias: boolean;
  janela_ferias: string | null;
  employees: { id: string; name: string } | null;
  companies: { id: string; name: string } | null;
  folha_perfis_calculo: { id: string; codigo: string; nome: string } | null;
};

export function EditarContratoForm({
  c,
  perfis,
  companies,
}: {
  c: ContratoFull;
  perfis: { id: string; codigo: string; nome: string }[];
  companies: { id: string; name: string }[];
}) {
  const { run, pending } = useAction(updateContratoAction, {
    success: "Contrato salvo.",
    error: "Falha ao salvar o contrato.",
  });

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    run(new FormData(e.currentTarget));
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-5">
      <input type="hidden" name="id" value={c.id} />
      <input type="hidden" name="funcionario_id" value={c.employees?.id ?? ""} />

      <div className="grid grid-cols-2 gap-4">
        <label className="flex flex-col gap-1 text-sm font-medium text-ink/80">
          Empresa
          <select name="company_id" required defaultValue={c.companies?.id ?? ""}>
            <option value="">Selecione…</option>
            {companies.map((co) => (
              <option key={co.id} value={co.id}>{co.name}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-ink/80">
          Perfil de cálculo
          <select name="perfil_calculo_id" required defaultValue={c.folha_perfis_calculo?.id ?? ""}>
            <option value="">Selecione…</option>
            {perfis.map((p) => (
              <option key={p.id} value={p.id}>{p.nome}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <CurrencyField
          name="salario_base"
          label="Salário base"
          defaultValue={c.salario_base}
          hint="Deixe em branco se hora-aula"
        />
        <CurrencyField
          name="valor_hora_aula"
          label="Valor hora-aula"
          defaultValue={c.valor_hora_aula}
          hint="Deixe em branco se salário"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <label className="flex flex-col gap-1 text-sm font-medium text-ink/80">
          Aulas semanais
          <input
            name="aulas_semanais"
            type="number"
            min="1"
            step="1"
            defaultValue={c.aulas_semanais ?? ""}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-ink/80">
          Dependentes IRRF
          <input name="dependentes_irrf" type="number" min="0" step="1" defaultValue={c.dependentes_irrf} />
        </label>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <label className="flex flex-col gap-1 text-sm font-medium text-ink/80">
          Aulas manhã
          <input name="aulas_manha" type="number" min="0" step="1" defaultValue={c.aulas_por_turno?.manha ?? ""} placeholder="—" />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-ink/80">
          Aulas tarde
          <input name="aulas_tarde" type="number" min="0" step="1" defaultValue={c.aulas_por_turno?.tarde ?? ""} placeholder="—" />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-ink/80">
          Aulas noite
          <input name="aulas_noite" type="number" min="0" step="1" defaultValue={c.aulas_por_turno?.noite ?? ""} placeholder="—" />
        </label>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <label className="flex flex-col gap-1 text-sm font-medium text-ink/80">
          Cargo
          <input name="cargo" type="text" maxLength={100} defaultValue={c.cargo ?? ""} placeholder="Ex.: Professor de Matemática" />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-ink/80">
          CBO
          <input name="cbo" type="text" maxLength={20} defaultValue={c.cbo ?? ""} placeholder="Ex.: 2312-05" />
        </label>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <label className="flex flex-col gap-1 text-sm font-medium text-ink/80">
          Data de admissão
          <input name="data_admissao" type="date" required defaultValue={c.data_admissao} className="w-48" />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-ink/80">
          Data de desligamento
          <input name="data_desligamento" type="date" defaultValue={c.data_desligamento ?? ""} className="w-48" />
        </label>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <label className="flex flex-col gap-1 text-sm font-medium text-ink/80">
          Janela de férias (ex.: J1)
          <input name="janela_ferias" type="text" maxLength={20}
            defaultValue={c.janela_ferias ?? ""} placeholder="Opcional" />
        </label>
        <div className="flex items-end pb-2">
          <label className="flex cursor-pointer items-center gap-2.5 text-sm font-medium text-ink/80">
            <input type="checkbox" name="antecipa_13_com_ferias"
              defaultChecked={c.antecipa_13_com_ferias} className="h-4 w-4 shrink-0 accent-brand" /> Antecipar 13º com férias
          </label>
        </div>
      </div>

      <label className="flex cursor-pointer items-center gap-2.5 text-sm font-medium text-ink/80">
        <input type="checkbox" name="ativo" defaultChecked={c.ativo} className="h-4 w-4 shrink-0 accent-brand" /> Contrato ativo
      </label>

      <div className="flex gap-3">
        <Button type="submit" variant="primary" loading={pending}>Salvar</Button>
        <a href="/rh/folha-v2/contratos" className="ds-button ds-button-secondary">Voltar</a>
      </div>
    </form>
  );
}
