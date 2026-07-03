import Link from "next/link";
import { ChevronLeft, ChevronRight, Plus, Filter, BookOpen, AlertCircle, Tag } from "lucide-react";
import { ButtonLink, Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { Panel } from "@/components/ui/card";
import { LancamentoRow } from "@/components/lancamentos/lancamento-row";
import { money } from "@/lib/constants";
import { getCategoriasFinanceiras, getLancamentosMensais } from "@/lib/data/lancamentos";
import {
  totalReceitasPagas,
  totalDespesasPagas,
  saldoCaixa,
  totalVencido
} from "@/lib/lancamentos/totals";
import { requirePermission } from "@/lib/auth/session";
import type { TipoLancamento } from "@/lib/validation/lancamentos";

export const dynamic = "force-dynamic";

function mesLabel(competencia: string) {
  const [y, m] = competencia.split("-");
  const meses = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
  return `${meses[Number(m) - 1]} ${y}`;
}

function adjacentMes(competencia: string, delta: number) {
  const [y, m] = competencia.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export default async function LancamentosPage({
  searchParams
}: {
  searchParams: Promise<{ mes?: string; tipo?: string; categoria_id?: string; status?: string; erro?: string }>;
}) {
  await requirePermission("financeiro.lancamentos", "read");
  const params = await searchParams;
  const now = new Date();
  const defaultMes = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const competencia = params.mes ?? defaultMes;
  const statusFilter = params.status ? params.status.split(",") : undefined;
  const tipoFilter: TipoLancamento | undefined =
    params.tipo === "receita" || params.tipo === "despesa" ? params.tipo : undefined;

  const [categorias, lancamentos] = await Promise.all([
    getCategoriasFinanceiras(),
    getLancamentosMensais(competencia, {
      tipo: tipoFilter,
      categoria_id: params.categoria_id || undefined,
      status: statusFilter
    })
  ]);

  const receitas = totalReceitasPagas(lancamentos);
  const despesas = totalDespesasPagas(lancamentos);
  const saldo = saldoCaixa(lancamentos);
  const vencido = totalVencido(lancamentos);

  return (
    <div className="grid gap-8">
      <PageHeader
        breadcrumb={[{ label: "Financeiro" }, { label: "Livro-Razão" }]}
        title="Livro-Razão"
        counter={mesLabel(competencia)}
        description="Receitas e despesas num só lugar. Totais por regime de caixa (data de pagamento)."
        kpis={[
          { label: "Receitas pagas", value: money.format(receitas), tone: "success" },
          { label: "Despesas pagas", value: money.format(despesas), tone: "danger" },
          { label: "Saldo (caixa)",  value: money.format(saldo),    tone: saldo >= 0 ? "success" : "danger" },
          { label: "Vencido",        value: money.format(vencido),  tone: "warning" }
        ]}
      />

      {params.erro ? (
        <div className="flex items-center gap-2 rounded-ui bg-danger/10 p-3 text-sm font-semibold text-danger">
          <AlertCircle size={16} />
          {params.erro}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex items-center gap-1 rounded-pill border border-line bg-surface p-1">
          <Link
            href={`/financeiro/lancamentos?mes=${adjacentMes(competencia, -1)}`}
            className="inline-flex h-8 w-8 items-center justify-center rounded-pill text-ink/60 transition hover:bg-muted hover:text-ink"
            aria-label="Mês anterior"
          >
            <ChevronLeft size={16} />
          </Link>
          <div className="px-3 text-sm font-semibold text-ink tabular-nums">{mesLabel(competencia)}</div>
          <Link
            href={`/financeiro/lancamentos?mes=${adjacentMes(competencia, 1)}`}
            className="inline-flex h-8 w-8 items-center justify-center rounded-pill text-ink/60 transition hover:bg-muted hover:text-ink"
            aria-label="Próximo mês"
          >
            <ChevronRight size={16} />
          </Link>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <ButtonLink href="/financeiro/lancamentos/categorias" variant="ghost">
            <Tag size={14} /> Categorias
          </ButtonLink>
          <ButtonLink href={`/financeiro/lancamentos/novo?mes=${competencia}`} variant="primary">
            <Plus size={14} /> Novo lançamento
          </ButtonLink>
        </div>
      </div>

      <Panel className="p-5">
        <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-kicker text-ink/60">
          <Filter size={12} />
          Filtros
        </div>
        <form className="flex flex-wrap items-end gap-3">
          <input type="hidden" name="mes" value={competencia} />
          <label>
            Tipo
            <select name="tipo" defaultValue={params.tipo ?? ""}>
              <option value="">Todos</option>
              <option value="receita">Receita</option>
              <option value="despesa">Despesa</option>
            </select>
          </label>
          <label>
            Categoria
            <select name="categoria_id" defaultValue={params.categoria_id ?? ""}>
              <option value="">Todas</option>
              {categorias.map((c) => (
                <option key={c.id} value={c.id}>{c.nome}</option>
              ))}
            </select>
          </label>
          <label>
            Status
            <select name="status" defaultValue={params.status ?? ""}>
              <option value="">Todos</option>
              <option value="aberta">Aberta</option>
              <option value="paga">Paga</option>
              <option value="cancelada">Cancelada</option>
            </select>
          </label>
          <Button type="submit" variant="secondary">Aplicar</Button>
          <ButtonLink href={`/financeiro/lancamentos?mes=${competencia}`} variant="ghost">Limpar</ButtonLink>
        </form>
      </Panel>

      <Panel className="p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-kicker text-ink/60">Lançamentos do mês</h2>
          {lancamentos.length > 0 && (
            <span className="text-xs text-ink/60">{lancamentos.length} {lancamentos.length === 1 ? "registro" : "registros"}</span>
          )}
        </div>
        {lancamentos.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 rounded-ui bg-muted/30 py-12 text-ink/60">
            <BookOpen size={28} />
            <p className="text-sm">Nenhum lançamento neste mês.</p>
            <ButtonLink href={`/financeiro/lancamentos/novo?mes=${competencia}`} variant="ghost" className="mt-2">
              <Plus size={14} /> Cadastrar primeiro
            </ButtonLink>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-[0.66rem] font-bold uppercase tracking-kicker text-ink/60">
                  <th className="py-2 px-3">Descrição</th>
                  <th className="py-2 px-3">Tipo</th>
                  <th className="py-2 px-3">Categoria</th>
                  <th className="py-2 px-3">Contraparte</th>
                  <th className="py-2 px-3">Venc.</th>
                  <th className="py-2 px-3">Pago em</th>
                  <th className="py-2 px-3 text-right">Valor</th>
                  <th className="py-2 px-3">Status</th>
                  <th className="py-2 px-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {lancamentos.map((l) => <LancamentoRow key={l.id} l={l} />)}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
