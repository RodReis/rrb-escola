import { CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Panel } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { ResolverPendenciaForm } from "@/components/isaac/resolver-pendencia-form";
import { requirePermission } from "@/lib/auth/session";
import { money, DEFAULT_SCHOOL_ID } from "@/lib/constants";
import { getPendenciasIsaac } from "@/lib/data/isaac";
import { createServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const MOTIVO: Record<string, { label: string; tom: "red" | "gold" | "gray"; explicacao: string }> = {
  sem_aluno: {
    label: "Aluno não encontrado",
    tom: "gray",
    explicacao: "O nome do isaac não casou com nenhum aluno do cadastro. Vincule para criar o apelido.",
  },
  tipo_vaga_incompativel: {
    label: "Bolsista/isento com mensalidade",
    tom: "red",
    explicacao:
      "O aluno está como bolsista, isento ou filho de professora aqui, mas o isaac cobrou mensalidade. Corrija o cadastro no isaac ou o tipo de vaga na matrícula.",
  },
  permuta_manual: {
    label: "Permuta — revisar valor",
    tom: "gold",
    explicacao: "Permuta não tem percentual fixo: cada caso é negociado, então o valor é conferido à mão.",
  },
};

export default async function PendenciasIsaacPage() {
  await requirePermission("financeiro.isaac", "read");

  const pendencias = await getPendenciasIsaac();

  const supabase = await createServerClient();
  const { data: alunosRaw } = await supabase
    .from("alunos")
    .select("id, nome")
    .eq("escola_id", DEFAULT_SCHOOL_ID)
    .order("nome");
  const alunos = (alunosRaw ?? []).map((a) => ({ id: a.id as string, nome: a.nome as string }));

  const porMotivo = new Map<string, typeof pendencias>();
  for (const p of pendencias) {
    const lista = porMotivo.get(p.motivoPendencia) ?? [];
    lista.push(p);
    porMotivo.set(p.motivoPendencia, lista);
  }

  return (
    <div className="grid gap-8">
      <PageHeader
        breadcrumb={[
          { label: "Financeiro", href: "/financeiro" },
          { label: "Repasse isaac", href: "/financeiro/isaac" },
          { label: "Pendências" },
        ]}
        title="Pendências do repasse"
        description="Parcelas que o isaac repassou mas que não viraram cobrança automaticamente. Ficam registradas no espelho do repasse; o dinheiro conferido não depende delas."
        kpis={[{ label: "Abertas", value: String(pendencias.length), tone: pendencias.length > 0 ? "warning" : "default" }]}
      />

      {pendencias.length === 0 ? (
        <Panel className="p-5">
          <div className="flex flex-col items-center justify-center gap-2 py-8 text-ink/60">
            <CheckCircle2 size={24} className="text-brand" />
            <p className="text-sm">Nenhuma pendência aberta.</p>
          </div>
        </Panel>
      ) : (
        Array.from(porMotivo.entries()).map(([motivo, lista]) => {
          const meta = MOTIVO[motivo] ?? { label: motivo, tom: "gray" as const, explicacao: "" };
          return (
            <Panel key={motivo} className="p-5">
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <Badge tone={meta.tom}>{meta.label}</Badge>
                <span className="text-sm text-ink/60">{lista.length} parcela(s)</span>
              </div>
              {meta.explicacao ? <p className="mb-3 text-xs text-ink/60">{meta.explicacao}</p> : null}

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-line text-left text-[0.66rem] font-bold uppercase tracking-kicker text-ink/60">
                      <th className="px-3 py-2">Nome no isaac</th>
                      <th className="px-3 py-2">Produto</th>
                      <th className="px-3 py-2">Competência</th>
                      <th className="px-3 py-2 text-right">Valor</th>
                      <th className="px-3 py-2">Repasse</th>
                      {motivo === "sem_aluno" ? <th className="px-3 py-2">Vincular aluno</th> : null}
                    </tr>
                  </thead>
                  <tbody>
                    {lista.map((p) => (
                      <tr key={p.id} className="border-b border-line/60 align-top">
                        <td className="px-3 py-2 text-ink">{p.nomeIsaac}</td>
                        <td className="px-3 py-2 text-ink/70">{p.produto}</td>
                        <td className="px-3 py-2 text-ink/70">{p.competencia}</td>
                        <td className="px-3 py-2 text-right text-ink">{money.format(p.valorBase)}</td>
                        <td className="px-3 py-2 text-ink/70">
                          {p.unidadeNome} · {p.competenciaRepasse}
                        </td>
                        {motivo === "sem_aluno" ? (
                          <td className="px-3 py-2">
                            <ResolverPendenciaForm parcelaId={p.id} nomeIsaac={p.nomeIsaac} alunos={alunos} />
                          </td>
                        ) : null}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>
          );
        })
      )}
    </div>
  );
}
