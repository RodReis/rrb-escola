import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { CheckCircle2, XCircle } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Panel } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button";
import { requirePermission } from "@/lib/auth/session";
import type { RematricularLoteResultado } from "@/lib/actions/academics";

export default async function RematricularLoteResultadoPage() {
  await requirePermission("matriculas", "read");

  const cookieStore = await cookies();
  const raw = cookieStore.get("rematricula_lote_result")?.value;

  if (!raw) {
    redirect("/matriculas/rematricula-lote?step=1");
  }

  let resultado: RematricularLoteResultado;
  try {
    resultado = JSON.parse(raw) as RematricularLoteResultado;
  } catch {
    redirect("/matriculas/rematricula-lote?step=1");
  }

  // Clear cookie
  cookieStore.set("rematricula_lote_result", "", { maxAge: 0, httpOnly: true, path: "/" });

  const { anoDestino, ok, errors } = resultado;

  return (
    <div className="grid gap-8">
      <PageHeader
        breadcrumb={[
          { label: "Acadêmico", href: "/" },
          { label: "Matrículas", href: "/matriculas" },
          { label: "Re-matrícula em lote — Resultado" },
        ]}
        title="Resultado da re-matrícula em lote"
        description={`${ok.length} re-matriculados · ${errors.length} erros`}
      />

      <div className="grid gap-6 max-w-3xl">
        {ok.length > 0 && (
          <Panel className="grid gap-4">
            <div className="flex items-center gap-2 text-success">
              <CheckCircle2 size={18} />
              <span className="font-semibold">{ok.length} aluno{ok.length !== 1 ? "s" : ""} re-matriculado{ok.length !== 1 ? "s" : ""} com sucesso</span>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-ink/50">
                  <th className="pb-2 font-medium">Aluno</th>
                  <th className="pb-2 font-medium text-right">Nova matrícula</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {ok.map((row) => (
                  <tr key={row.novaMatriculaId}>
                    <td className="py-2 text-ink">{row.nome}</td>
                    <td className="py-2 text-right">
                      <a
                        href={`/matriculas/${row.novaMatriculaId}`}
                        className="text-brand hover:underline"
                      >
                        Ver matrícula →
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>
        )}

        {errors.length > 0 && (
          <Panel className="grid gap-4">
            <div className="flex items-center gap-2 text-danger">
              <XCircle size={18} />
              <span className="font-semibold">{errors.length} erro{errors.length !== 1 ? "s" : ""}</span>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-ink/50">
                  <th className="pb-2 font-medium">Aluno</th>
                  <th className="pb-2 font-medium">Motivo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {errors.map((row, i) => (
                  <tr key={i}>
                    <td className="py-2 text-ink">{row.nome}</td>
                    <td className="py-2 text-ink/60">{row.motivo}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>
        )}

        <div className="flex gap-3">
          <ButtonLink href={`/matriculas?ano=${anoDestino}`} variant="primary">
            Ver matrículas {anoDestino}
          </ButtonLink>
          <ButtonLink href="/matriculas/rematricula-lote?step=1" variant="secondary">
            Nova re-matrícula em lote
          </ButtonLink>
        </div>
      </div>
    </div>
  );
}
