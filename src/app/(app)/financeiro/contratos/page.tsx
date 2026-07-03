import { AlertCircle, CheckCircle2, FileSignature, Plus, PlayCircle } from "lucide-react";
import { ButtonLink, Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { Panel } from "@/components/ui/card";
import { money } from "@/lib/constants";
import { getContratos } from "@/lib/data/contratos";
import { gerarLancamentosAction } from "@/lib/actions/contratos";
import { requirePermission } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function ContratosPage({
  searchParams
}: {
  searchParams: Promise<{ erro?: string; gerados?: string; mes?: string }>;
}) {
  await requirePermission("financeiro.contratos", "read");
  const { erro, gerados, mes } = await searchParams;
  const contratos = await getContratos();
  const compAtual = new Date().toISOString().slice(0, 7);

  return (
    <div className="grid gap-8">
      <PageHeader
        breadcrumb={[{ label: "Financeiro" }, { label: "Contratos de Receita" }]}
        title="Contratos de Receita"
        description="Receitas recorrentes (ex.: terceirização da lanchonete). Gere os lançamentos do mês."
        counter={contratos.length.toLocaleString("pt-BR")}
      />

      {erro ? (
        <div className="flex items-center gap-2 rounded-ui bg-danger/10 p-3 text-sm font-semibold text-danger">
          <AlertCircle size={16} /> {erro}
        </div>
      ) : null}
      {gerados ? (
        <div className="flex items-center gap-2 rounded-ui bg-success/10 p-3 text-sm font-semibold text-success">
          <CheckCircle2 size={16} /> {gerados} lançamento(s) gerado(s) para {mes}.
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <form action={gerarLancamentosAction} className="flex items-end gap-2">
          <label className="text-sm">
            Gerar competência
            <input type="month" name="competencia" defaultValue={compAtual} required />
          </label>
          <Button type="submit" variant="secondary"><PlayCircle size={14} /> Gerar lançamentos</Button>
        </form>
        <ButtonLink href="/financeiro/contratos/novo" variant="primary">
          <Plus size={14} /> Novo contrato
        </ButtonLink>
      </div>

      <Panel className="p-5">
        {contratos.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 rounded-ui bg-muted/30 py-12 text-ink/60">
            <FileSignature size={28} />
            <p className="text-sm">Nenhum contrato cadastrado.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-[0.66rem] font-bold uppercase tracking-kicker text-ink/60">
                  <th className="py-2 px-3">Descrição</th>
                  <th className="py-2 px-3">Contraparte</th>
                  <th className="py-2 px-3">Categoria</th>
                  <th className="py-2 px-3 text-right">Valor</th>
                  <th className="py-2 px-3 text-right">Dia venc.</th>
                  <th className="py-2 px-3">Ativo</th>
                </tr>
              </thead>
              <tbody>
                {contratos.map((c) => (
                  <tr key={c.id} className="border-t border-line">
                    <td className="py-2.5 px-3 font-medium text-ink">{c.descricao}</td>
                    <td className="py-2.5 px-3 text-ink/70">{c.contraparte ?? "—"}</td>
                    <td className="py-2.5 px-3 text-ink/70">{c.categoria_nome ?? "—"}</td>
                    <td className="py-2.5 px-3 text-right font-semibold tabular-nums">{money.format(c.valor)}</td>
                    <td className="py-2.5 px-3 text-right tabular-nums text-ink/70">{c.dia_vencimento}</td>
                    <td className="py-2.5 px-3">{c.ativo ? "Sim" : "Não"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
