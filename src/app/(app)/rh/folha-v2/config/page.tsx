import { AlertCircle, CheckCircle2 } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Panel } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { updateConfigAction } from "@/lib/actions/folha-cadastros";
import { getConfigOrNull, getCategoriasDespesa } from "@/lib/data/folha";
import { requirePermission } from "@/lib/auth/session";
import { createServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type RegraPageamento = { tipo: string; n: number };

export default async function ConfigPage({
  searchParams,
}: {
  searchParams: Promise<{ company_id?: string; erro?: string; ok?: string }>;
}) {
  await requirePermission("rh.folha-v2", "update");
  const { company_id, erro, ok } = await searchParams;

  const supabase = await createServerClient();
  const [companiesRes, categorias] = await Promise.all([
    supabase.from("companies").select("id, name").order("name"),
    getCategoriasDespesa(),
  ]);
  const companies = companiesRes.data ?? [];

  const selectedCompanyId = company_id ?? companies[0]?.id ?? "";
  const config = selectedCompanyId ? await getConfigOrNull(selectedCompanyId) : null;

  const feriados: string[] = Array.isArray(config?.feriados_locais)
    ? (config.feriados_locais as string[])
    : [];
  const regra = (config?.regra_pagamento as RegraPageamento | null) ?? { tipo: "dia_util", n: 5 };

  return (
    <div className="grid gap-8">
      <PageHeader
        breadcrumb={[
          { label: "RH", href: "/rh/funcionarios" },
          { label: "Folha v2", href: "/rh/folha-v2" },
          { label: "Configurações" },
        ]}
        title="Configurações da Folha"
        description="Parâmetros de cálculo por empresa."
      />

      {companies.length > 1 ? (
        <form method="get" className="flex items-end gap-3">
          <label className="flex flex-col gap-1 text-sm font-medium text-ink/80">
            Empresa
            <select name="company_id" defaultValue={selectedCompanyId} onChange={undefined}
              className="min-w-[200px]">
              {companies.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </label>
          <button type="submit" className="ds-button ds-button-secondary">Carregar</button>
        </form>
      ) : null}

      {erro ? (
        <div className="flex items-center gap-2 rounded-ui bg-danger/10 p-3 text-sm font-semibold text-danger">
          <AlertCircle size={16} /> {erro}
        </div>
      ) : null}
      {ok ? (
        <div className="flex items-center gap-2 rounded-ui bg-success/10 p-3 text-sm font-semibold text-success">
          <CheckCircle2 size={16} /> Configuração salva com sucesso.
        </div>
      ) : null}

      {selectedCompanyId ? (
        <Panel className="p-6">
          <form action={updateConfigAction} className="grid gap-6 max-w-2xl">
            <input type="hidden" name="company_id" value={selectedCompanyId} />

            <div className="grid grid-cols-3 gap-4">
              <label className="flex flex-col gap-1 text-sm font-medium text-ink/80">
                Divisor DSR
                <input name="divisor_dsr" type="number" step="1" min="1" defaultValue={config?.divisor_dsr ?? 6} />
              </label>
              <label className="flex flex-col gap-1 text-sm font-medium text-ink/80">
                % Hora atividade
                <input name="percentual_hora_atividade" type="number" step="0.01" min="0"
                  defaultValue={config?.percentual_hora_atividade ?? 5} />
              </label>
              <label className="flex flex-col gap-1 text-sm font-medium text-ink/80">
                Semanas/mês
                <input name="semanas_mes" type="number" step="0.01" min="1"
                  defaultValue={config?.semanas_mes ?? 4.5} />
              </label>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <label className="flex flex-col gap-1 text-sm font-medium text-ink/80">
                Dia fechamento
                <input name="dia_fechamento" type="number" step="1" min="1" max="31"
                  defaultValue={config?.dia_fechamento ?? 1} />
              </label>
              <label className="flex flex-col gap-1 text-sm font-medium text-ink/80">
                Vencimento GPS (dia)
                <input name="dia_vencimento_gps" type="number" step="1" min="1" max="31"
                  defaultValue={config?.dia_vencimento_gps ?? 20} />
              </label>
              <label className="flex flex-col gap-1 text-sm font-medium text-ink/80">
                Vencimento FGTS (dia)
                <input name="dia_vencimento_fgts" type="number" step="1" min="1" max="31"
                  defaultValue={config?.dia_vencimento_fgts ?? 20} />
              </label>
            </div>

            <fieldset className="rounded-ui border border-line p-4">
              <legend className="px-1 text-xs font-bold uppercase tracking-kicker text-ink/55">
                Regra de pagamento
              </legend>
              <div className="grid grid-cols-2 gap-4 pt-2">
                <label className="flex flex-col gap-1 text-sm font-medium text-ink/80">
                  Tipo
                  <select name="regra_tipo" defaultValue={regra.tipo}>
                    <option value="dia_util">Dia útil</option>
                    <option value="dia_fixo">Dia fixo</option>
                  </select>
                </label>
                <label className="flex flex-col gap-1 text-sm font-medium text-ink/80">
                  N (dia útil ou dia fixo)
                  <input name="regra_n" type="number" step="1" min="1" defaultValue={regra.n} />
                </label>
              </div>
            </fieldset>

            <div className="grid grid-cols-2 gap-4">
              <label className="flex flex-col gap-1 text-sm font-medium text-ink/80">
                Categoria despesa — Folha
                <select name="categoria_despesa_folha"
                  defaultValue={config?.categoria_despesa_folha ?? ""}>
                  <option value="">Nenhuma</option>
                  {categorias.map((c) => (
                    <option key={c.id} value={c.id}>{c.nome}</option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-sm font-medium text-ink/80">
                Categoria despesa — Encargos
                <select name="categoria_despesa_encargos"
                  defaultValue={config?.categoria_despesa_encargos ?? ""}>
                  <option value="">Nenhuma</option>
                  {categorias.map((c) => (
                    <option key={c.id} value={c.id}>{c.nome}</option>
                  ))}
                </select>
              </label>
            </div>

            <label className="flex flex-col gap-1 text-sm font-medium text-ink/80">
              Feriados locais (um por linha, formato AAAA-MM-DD)
              <textarea
                name="feriados_locais"
                rows={6}
                defaultValue={feriados.join("\n")}
                placeholder={"2025-02-03\n2025-02-04\n2025-06-19"}
                className="font-mono text-sm"
              />
              <span className="text-xs text-ink/50">
                Feriados móveis (Carnaval, Corpus Christi) devem ser cadastrados aqui anualmente.
              </span>
            </label>

            <div>
              <Button type="submit" variant="primary">Salvar configuração</Button>
            </div>
          </form>
        </Panel>
      ) : (
        <p className="text-sm text-ink/50">Nenhuma empresa disponível.</p>
      )}
    </div>
  );
}
