import Link from "next/link";
import { GraduationCap, HandCoins, Sparkles, Mail, Phone, ArrowRight, type LucideIcon } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Avatar } from "@/components/ui/avatar";
import { listBolsistas, type TipoVagaBolsa } from "@/lib/data/bolsistas";
import { getSignedFotoUrls } from "@/lib/storage/photos";
import { money } from "@/lib/constants";

const TIPO_LABEL: Record<TipoVagaBolsa, string> = {
  bolsa_integral: "Bolsa integral",
  bolsa_parcial: "Bolsa parcial",
  permuta: "Permuta",
  gratuita: "Gratuidade",
};

const TIPO_STYLE: Record<TipoVagaBolsa, string> = {
  bolsa_integral: "bg-brand/10 text-brand",
  bolsa_parcial: "bg-accent/10 text-accent",
  permuta: "bg-warning/10 text-warning",
  gratuita: "bg-success/10 text-success",
};

const TIPO_ICON: Record<TipoVagaBolsa, LucideIcon> = {
  bolsa_integral: GraduationCap,
  bolsa_parcial: GraduationCap,
  permuta: HandCoins,
  gratuita: Sparkles,
};

const SEGMENTO_LABEL: Record<string, string> = {
  INFANTIL: "Ed. Infantil",
  FUNDAMENTAL1: "Fund. I",
  FUNDAMENTAL2: "Fund. II",
  MEDIO: "Médio",
};

export default async function BolsistasPage() {
  const bolsistas = await listBolsistas();
  const signedFotos = await getSignedFotoUrls(bolsistas.map((b) => b.fotoUrl));

  const total = bolsistas.length;
  const receitaPerdida = bolsistas.reduce((s, b) => s + b.receitaPerdidaMes, 0);
  const porTipo = bolsistas.reduce<Record<TipoVagaBolsa, number>>(
    (acc, b) => {
      acc[b.tipoVaga] = (acc[b.tipoVaga] ?? 0) + 1;
      return acc;
    },
    { bolsa_integral: 0, bolsa_parcial: 0, permuta: 0, gratuita: 0 }
  );

  return (
    <div className="grid gap-6">
      <PageHeader
        breadcrumb={[{ label: "Secretaria" }, { label: "Bolsistas" }]}
        title="Bolsistas"
        counter={`${total}`}
        description="Alunos com benefício (bolsa, permuta, gratuidade) no ano letivo corrente."
      />

      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <article className="rounded-panel bg-surface p-5 shadow-soft">
          <p className="text-[0.66rem] font-bold uppercase tracking-kicker text-ink/55">Total</p>
          <strong className="mt-2 block text-3xl font-bold text-ink">{total}</strong>
          <p className="text-sm text-ink/60">alunos beneficiados</p>
        </article>

        <article className="rounded-panel bg-surface p-5 shadow-soft">
          <p className="text-[0.66rem] font-bold uppercase tracking-kicker text-ink/55">Por tipo</p>
          <ul className="mt-2 grid gap-1 text-sm">
            {(Object.keys(porTipo) as TipoVagaBolsa[]).map((t) =>
              porTipo[t] > 0 ? (
                <li key={t} className="flex items-center justify-between">
                  <span className="text-ink/70">{TIPO_LABEL[t]}</span>
                  <span className={`rounded-pill px-2 py-0.5 text-xs font-bold ${TIPO_STYLE[t]}`}>{porTipo[t]}</span>
                </li>
              ) : null
            )}
          </ul>
        </article>

        <article className="rounded-panel bg-warning/10 p-5 shadow-soft">
          <p className="text-[0.66rem] font-bold uppercase tracking-kicker text-warning/80">Receita não realizada</p>
          <strong className="mt-2 block text-2xl font-bold text-warning">{money.format(receitaPerdida)}</strong>
          <p className="text-sm text-warning/80">por mês</p>
        </article>

        <article className="rounded-panel bg-surface p-5 shadow-soft">
          <p className="text-[0.66rem] font-bold uppercase tracking-kicker text-ink/55">Anual estimado</p>
          <strong className="mt-2 block text-2xl font-bold text-ink">{money.format(receitaPerdida * 12)}</strong>
          <p className="text-sm text-ink/60">12 meses</p>
        </article>
      </section>

      <section className="rounded-panel bg-surface shadow-soft overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-[0.66rem] uppercase tracking-kicker text-ink/55">
                <th className="px-4 py-3 text-left">Aluno</th>
                <th className="px-4 py-3 text-left whitespace-nowrap">Etapa</th>
                <th className="px-4 py-3 text-left whitespace-nowrap">Série / Turma</th>
                <th className="px-4 py-3 text-left">Responsável</th>
                <th className="px-4 py-3 text-left">Contato</th>
                <th className="px-4 py-3 text-left whitespace-nowrap">Tipo</th>
                <th className="px-4 py-3 text-right whitespace-nowrap">Ação</th>
              </tr>
            </thead>
            <tbody>
              {bolsistas.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-ink/55">
                    Nenhum bolsista no ano letivo corrente.
                  </td>
                </tr>
              ) : (
                bolsistas.map((b) => {
                  const Icon = TIPO_ICON[b.tipoVaga];
                  const fotoSigned = b.fotoUrl ? signedFotos.get(b.fotoUrl) ?? null : null;
                  return (
                    <tr key={b.matriculaId} className="border-b border-line/60 hover:bg-muted/40">
                      <td className="px-4 py-3">
                        <Link href={`/alunos/${b.alunoId}`} className="flex items-center gap-3 group">
                          <Avatar src={fotoSigned} name={b.nome} size={36} />
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-ink group-hover:text-brand">{b.nome}</p>
                            {b.matriculaCodigo && (
                              <p className="text-xs text-ink/55">Mat. {b.matriculaCodigo}</p>
                            )}
                          </div>
                        </Link>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="rounded-pill bg-muted px-2 py-0.5 text-xs font-semibold text-ink/70 whitespace-nowrap">
                          {SEGMENTO_LABEL[b.segmento] ?? b.segmento}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-ink">{b.serie}</p>
                        <p className="text-xs text-ink/55">{b.turma}</p>
                      </td>
                      <td className="px-4 py-3">
                        {b.responsavelNome ? (
                          <>
                            <p className="font-medium text-ink">{b.responsavelNome}</p>
                            {b.responsavelParentesco && (
                              <p className="text-xs text-ink/55">{b.responsavelParentesco}</p>
                            )}
                          </>
                        ) : (
                          <span className="text-ink/40">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="grid gap-1">
                          {b.responsavelCelular && (
                            <span className="inline-flex items-center gap-1 text-xs text-ink/70">
                              <Phone size={12} /> {b.responsavelCelular}
                            </span>
                          )}
                          {b.celular && b.celular !== b.responsavelCelular && (
                            <span className="inline-flex items-center gap-1 text-xs text-ink/55">
                              <Phone size={12} /> {b.celular}
                            </span>
                          )}
                          {b.email && (
                            <span className="inline-flex items-center gap-1 text-xs text-ink/55">
                              <Mail size={12} /> {b.email}
                            </span>
                          )}
                          {!b.responsavelCelular && !b.celular && !b.email && (
                            <span className="text-ink/40">—</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1 rounded-pill px-2 py-0.5 text-xs font-semibold whitespace-nowrap ${TIPO_STYLE[b.tipoVaga]}`}>
                          <Icon size={12} />
                          {TIPO_LABEL[b.tipoVaga]}
                          {b.tipoVaga === "bolsa_parcial" && ` ${b.percentualBolsa.toFixed(0)}%`}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <Link
                          href={`/alunos/${b.alunoId}`}
                          className="inline-flex items-center gap-1 rounded-ui bg-brand/10 px-3 py-1.5 text-xs font-semibold text-brand hover:bg-brand/20 whitespace-nowrap"
                        >
                          Ver ficha
                          <ArrowRight size={12} />
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
