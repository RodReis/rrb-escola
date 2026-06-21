"use client";

import { useRouter } from "next/navigation";
import type { IndicadoresPipeline } from "@/lib/actions/pipeline-indicadores";
import { STATUS_ANAMNESE } from "@/lib/validation/pipeline";
import type { StatusAnamnese } from "@/lib/validation/pipeline";

const STATUS_ANAMNESE_LABEL: Record<StatusAnamnese, string> = {
  nao_iniciada: "Não iniciada",
  enviada: "Enviada",
  pendente: "Pendente",
  em_analise: "Em análise",
  concluida: "Concluída",
  requer_atencao: "Requer atenção",
};

type Props = {
  dados: IndicadoresPipeline;
  periodoAtual: 30 | 90 | 180;
};

function MetricCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-xl border border-[rgb(var(--color-line))] bg-[rgb(var(--color-surface))] p-4">
      <p className="text-xs font-medium text-[rgb(var(--color-ink)/0.5)] uppercase tracking-wide">{label}</p>
      <p className="mt-1 text-2xl font-bold text-[rgb(var(--color-ink))]">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-[rgb(var(--color-ink)/0.45)]">{sub}</p>}
    </div>
  );
}

export function IndicadoresDashboard({ dados, periodoAtual }: Props) {
  const router = useRouter();

  function handlePeriodo(p: 30 | 90 | 180) {
    router.push(`/pipeline/indicadores?periodo=${p}`);
  }

  return (
    <div className="space-y-8">
      {/* Seletor de período */}
      <div className="flex gap-2">
        {([30, 90, 180] as const).map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => handlePeriodo(p)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              p === periodoAtual
                ? "bg-[rgb(var(--color-brand))] text-white"
                : "bg-[rgb(var(--color-muted))] text-[rgb(var(--color-ink)/0.7)] hover:bg-[rgb(var(--color-muted)/0.7)]"
            }`}
          >
            {p} dias
          </button>
        ))}
      </div>

      {/* Cards de métricas principais */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MetricCard
          label="Leads captados"
          value={dados.captacao.total}
          sub={`últimos ${dados.periodo} dias`}
        />
        <MetricCard
          label="Matrículas"
          value={dados.conversao.matriculas}
        />
        <MetricCard
          label="Reservas"
          value={dados.conversao.reservas}
        />
        <MetricCard
          label="Conversão"
          value={`${dados.conversao.taxa_pct}%`}
          sub="leads → matrícula"
        />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <MetricCard
          label="Cards parados"
          value={dados.parados.total}
          sub="além do prazo da coluna"
        />
        <MetricCard
          label="Docs pendentes"
          value={dados.documentos_pendentes}
        />
        <MetricCard
          label="Tempo médio"
          value={dados.tempo_medio_atendimento_dias != null ? `${dados.tempo_medio_atendimento_dias} dias` : "—"}
          sub="lead → matrícula"
        />
      </div>

      {/* Origem dos leads */}
      {dados.captacao.por_origem.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold text-[rgb(var(--color-ink))]">Origem dos leads</h2>
          <div className="rounded-xl border border-[rgb(var(--color-line))] overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[rgb(var(--color-line))] bg-[rgb(var(--color-muted)/0.4)]">
                  <th className="px-4 py-2 text-left text-xs font-medium text-[rgb(var(--color-ink)/0.5)]">Origem</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-[rgb(var(--color-ink)/0.5)]">Leads</th>
                </tr>
              </thead>
              <tbody>
                {dados.captacao.por_origem.map((row) => (
                  <tr key={row.origem} className="border-b border-[rgb(var(--color-line)/0.5)] last:border-0">
                    <td className="px-4 py-2 text-[rgb(var(--color-ink)/0.8)]">{row.origem}</td>
                    <td className="px-4 py-2 text-right font-medium text-[rgb(var(--color-ink))]">{row.total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Parados por coluna */}
      {dados.parados.por_coluna.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold text-[rgb(var(--color-ink))]">Cards parados por coluna</h2>
          <div className="rounded-xl border border-[rgb(var(--color-line))] overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[rgb(var(--color-line))] bg-[rgb(var(--color-muted)/0.4)]">
                  <th className="px-4 py-2 text-left text-xs font-medium text-[rgb(var(--color-ink)/0.5)]">Coluna</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-[rgb(var(--color-ink)/0.5)]">Cards</th>
                </tr>
              </thead>
              <tbody>
                {dados.parados.por_coluna
                  .sort((a, b) => b.total - a.total)
                  .map((row) => (
                    <tr key={row.coluna_id} className="border-b border-[rgb(var(--color-line)/0.5)] last:border-0">
                      <td className="px-4 py-2 text-[rgb(var(--color-ink)/0.8)]">{row.coluna_nome}</td>
                      <td className="px-4 py-2 text-right font-medium text-[rgb(var(--color-ink))]">{row.total}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Anamneses */}
      <section>
        <h2 className="mb-3 text-sm font-semibold text-[rgb(var(--color-ink))]">Anamneses por status</h2>
        <div className="flex flex-wrap gap-2">
          {STATUS_ANAMNESE.filter((s) => s !== "enviada" && s !== "pendente").map((s) => {
            const count = dados.anamneses[s] ?? 0;
            if (count === 0 && s === "nao_iniciada") return null;
            return (
              <div
                key={s}
                className="flex items-center gap-2 rounded-full border border-[rgb(var(--color-line))] px-3 py-1 text-xs"
              >
                <span className="text-[rgb(var(--color-ink)/0.6)]">{STATUS_ANAMNESE_LABEL[s]}</span>
                <span className="font-semibold text-[rgb(var(--color-ink))]">{count}</span>
              </div>
            );
          })}
        </div>
      </section>

      {/* Motivos de perda */}
      {dados.motivos_perda.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold text-[rgb(var(--color-ink))]">Motivos de perda</h2>
          <div className="space-y-1">
            {dados.motivos_perda.map((row) => (
              <div key={row.motivo} className="flex items-center justify-between text-sm">
                <span className="text-[rgb(var(--color-ink)/0.75)]">{row.motivo}</span>
                <span className="font-medium text-[rgb(var(--color-ink))]">{row.total}</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
