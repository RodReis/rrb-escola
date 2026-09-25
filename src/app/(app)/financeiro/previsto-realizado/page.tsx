import Link from "next/link";
import { Panel } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { requirePermission } from "@/lib/auth/session";
import { money } from "@/lib/constants";
import { getPrevistoRealizado } from "@/lib/data/previsto-realizado";
import { resumirPrevistoRealizado } from "@/lib/previsto/previsto-realizado";

function vizinho(competencia: string, delta: number) {
  const [y, m] = competencia.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function situacao(abertos: number, vencidos: number) {
  if (vencidos > 0) return `${vencidos} vencido(s)`;
  if (abertos > 0) return `${abertos} em aberto`;
  return "pago";
}

export default async function PrevistoRealizadoPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string; empresa?: string }>;
}) {
  await requirePermission("financeiro.lancamentos", "read");
  const params = await searchParams;
  const hoje = new Date().toISOString().slice(0, 10);
  const competencia = params.mes && /^\d{4}-\d{2}$/.test(params.mes) ? params.mes : hoje.slice(0, 7);
  const empresa = params.empresa || null;

  const { doMes, atrasados, empresas } = await getPrevistoRealizado(competencia, empresa);
  const resumo = resumirPrevistoRealizado(doMes, hoje);
  const qs = (mes: string) => `?mes=${mes}${empresa ? `&empresa=${empresa}` : ""}`;
  const totalAtrasado = atrasados.reduce((s, a) => s + Math.round(a.valor * 100), 0) / 100;

  return (
    <div className="grid gap-6">
      <PageHeader
        breadcrumb={[{ label: "Financeiro", href: "/financeiro" }, { label: "Previsto × Realizado" }]}
        title="Previsto × Realizado"
        description="O que estava previsto sair contra o que saiu, por categoria."
        actions={
          <div className="flex items-center gap-2">
            <Link href={qs(vizinho(competencia, -1))}><Button>‹</Button></Link>
            <span className="text-sm font-semibold tabular-nums">{competencia}</span>
            <Link href={qs(vizinho(competencia, 1))}><Button>›</Button></Link>
          </div>
        }
      />

      <form className="flex items-end gap-3">
        <input type="hidden" name="mes" value={competencia} />
        <label>
          Empresa
          <select name="empresa" defaultValue={empresa ?? ""}>
            <option value="">Consolidado</option>
            {empresas.map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}
          </select>
        </label>
        <Button type="submit">Filtrar</Button>
      </form>

      {atrasados.length > 0 ? (
        <Panel className="grid gap-2 border-danger/40">
          <h2 className="text-xs font-bold uppercase tracking-kicker text-danger">
            Previsto vencido sem pagamento — {atrasados.length} título(s), {money.format(totalAtrasado)}
          </h2>
          <ul className="grid gap-1 text-sm">
            {atrasados.slice(0, 20).map((a) => (
              <li key={a.id} className="flex justify-between gap-3">
                <span>{a.descricao} <span className="text-ink/50">(venceu {new Date(`${a.dataVencimento}T00:00:00`).toLocaleDateString("pt-BR")})</span></span>
                <span className="tabular-nums">{money.format(a.valor)}</span>
              </li>
            ))}
          </ul>
          {atrasados.length > 20 ? <p className="text-xs text-ink/60">…e mais {atrasados.length - 20}.</p> : null}
        </Panel>
      ) : null}

      <Panel>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase text-ink/60">
              <th>Categoria</th><th className="text-right">Previsto</th><th className="text-right">Realizado</th>
              <th className="text-right">Diferença</th><th>Situação</th>
            </tr>
          </thead>
          <tbody>
            {resumo.linhas.map((l) => (
              <tr key={l.categoria}>
                <td>{l.categoria}</td>
                <td className="text-right tabular-nums">{money.format(l.previsto)}</td>
                <td className="text-right tabular-nums">{money.format(l.realizado)}</td>
                <td className="text-right tabular-nums">{money.format(l.diferenca)}</td>
                <td>{situacao(l.abertos, l.vencidos)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="font-semibold">
              <td>Total</td>
              <td className="text-right tabular-nums">{money.format(resumo.totais.previsto)}</td>
              <td className="text-right tabular-nums">{money.format(resumo.totais.realizado)}</td>
              <td className="text-right tabular-nums">{money.format(resumo.totais.diferenca)}</td>
              <td />
            </tr>
          </tfoot>
        </table>
      </Panel>

      <Panel>
        <p className="text-sm text-ink/70">
          <strong>Realizado sem previsto:</strong> {resumo.realizadoSemPrevisto.quantidade} lançamento(s),{" "}
          {money.format(resumo.realizadoSemPrevisto.total)} — pagamentos que não tinham título (por exemplo, feitos pelo app do banco).
          Não é erro.
        </p>
      </Panel>
    </div>
  );
}
