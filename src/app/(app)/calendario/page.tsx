import Link from "next/link";
import { CalendarDays } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Panel } from "@/components/ui/card";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { requirePermission } from "@/lib/auth/session";
import { excluirCalendarioAction } from "@/lib/actions/calendario";
import { getCalendario, listAnosLetivos } from "@/lib/data/calendario";
import { contarDiasLetivos } from "@/lib/calendario/dias-letivos";
import { CalendarioConfigForm } from "@/components/calendario/calendario-config-form";
import { ExcecaoForm } from "@/components/calendario/excecao-form";
import { ExcecoesList } from "@/components/calendario/excecoes-list";
import { GradeAnual } from "@/components/calendario/grade-anual";

const DIAS_LETIVOS_MIN = 200;

const DIA_LABEL: Record<number, string> = {
  0: "Dom", 1: "Seg", 2: "Ter", 3: "Qua", 4: "Qui", 5: "Sex", 6: "Sáb",
};

function isValidAno(v: string | undefined): boolean {
  if (!v) return false;
  const n = Number(v);
  return Number.isInteger(n) && n >= 2000 && n <= 2100;
}

export default async function CalendarioPage({
  searchParams,
}: {
  searchParams: Promise<{ ano?: string }>;
}) {
  await requirePermission("calendario", "read");
  const params = await searchParams;

  const anosCadastrados = await listAnosLetivos();
  const anoAtual = new Date().getFullYear();
  const anoSelecionado = isValidAno(params.ano)
    ? Number(params.ano)
    : (anosCadastrados[0] ?? anoAtual);

  const dados = await getCalendario(anoSelecionado);

  // Opções do seletor: anos cadastrados + ano atual + próximo ano (sem duplicar)
  const opcoesAno = Array.from(
    new Set([...anosCadastrados, anoAtual, anoAtual + 1]),
  ).sort((a, b) => b - a);

  const totalLetivos = dados
    ? contarDiasLetivos(dados.calendario, dados.excecoes)
    : 0;
  const atingeMinimo = totalLetivos >= DIAS_LETIVOS_MIN;

  return (
    <div className="grid gap-6">
      <PageHeader
        breadcrumb={[{ label: "Acadêmico" }, { label: "Calendário Letivo" }]}
        title="Calendário Letivo"
        description="Defina o período letivo, dias da semana, feriados e recessos."
      />

      <nav className="flex flex-wrap gap-1.5">
        {opcoesAno.map((ano) => (
          <Link
            key={ano}
            href={`/calendario?ano=${ano}`}
            className={`rounded-ui px-3 py-1.5 text-sm font-semibold transition-colors ${
              ano === anoSelecionado
                ? "bg-brand text-white"
                : "bg-muted text-ink/60 hover:text-ink"
            }`}
          >
            {ano}
          </Link>
        ))}
      </nav>

      {dados && (
        <Panel className="grid gap-3 sm:grid-cols-4 sm:items-center">
          <div>
            <p className="text-xs uppercase tracking-kicker text-ink/45">Período</p>
            <p className="text-sm font-semibold text-ink">
              {dados.calendario.dataInicio.split("-").reverse().join("/")} –{" "}
              {dados.calendario.dataFim.split("-").reverse().join("/")}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-kicker text-ink/45">Dias letivos da semana</p>
            <p className="text-sm font-semibold text-ink">
              {dados.calendario.diasSemanaLetivos
                .slice()
                .sort()
                .map((d) => DIA_LABEL[d])
                .join(", ")}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-kicker text-ink/45">Total de dias letivos</p>
            <p className="flex items-center gap-2 text-sm font-bold">
              <span className={atingeMinimo ? "text-success" : "text-danger"}>
                {totalLetivos}
              </span>
              <span
                className={`rounded-pill px-2 py-0.5 text-[0.6rem] font-semibold uppercase ${
                  atingeMinimo
                    ? "bg-success/15 text-success"
                    : "bg-danger/15 text-danger"
                }`}
              >
                {atingeMinimo ? "OK" : `mín. ${DIAS_LETIVOS_MIN}`}
              </span>
            </p>
          </div>
          <div className="flex sm:justify-end">
            <form action={excluirCalendarioAction}>
              <input type="hidden" name="id" value={dados.calendario.id} />
              <ConfirmButton
                message={`Excluir o calendário de ${anoSelecionado}? Todos os feriados e recessos cadastrados serão removidos. Você poderá criar um novo em seguida.`}
                className="ds-button ds-button-ghost text-xs text-danger"
              >
                Excluir calendário
              </ConfirmButton>
            </form>
          </div>
        </Panel>
      )}

      <CalendarioConfigForm
        anoLetivo={anoSelecionado}
        calendario={dados?.calendario ?? null}
      />

      {dados ? (
        <>
          <section className="grid gap-3">
            <h2 className="flex items-center gap-2 font-bold text-ink">
              <CalendarDays size={18} className="text-brand" />
              Visão anual {anoSelecionado}
            </h2>
            <GradeAnual calendario={dados.calendario} excecoes={dados.excecoes} />
          </section>

          <div className="grid gap-6 lg:grid-cols-2">
            <ExcecaoForm calendarioId={dados.calendario.id} />
            <ExcecoesList excecoes={dados.excecoes} />
          </div>
        </>
      ) : (
        <Panel>
          <p className="py-6 text-center text-sm text-ink/55">
            Configure o calendário acima para visualizar a grade e cadastrar feriados.
          </p>
        </Panel>
      )}
    </div>
  );
}
