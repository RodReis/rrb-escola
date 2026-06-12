import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/session";
import { getRunDetalhe, getItemLancamentos, getProvisoesSaldo } from "@/lib/data/folha";
import { gerarPacoteContador } from "@/lib/folha/pacote-contador";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ runId: string }> },
) {
  await requirePermission("rh.folha-v2", "read");
  const { runId } = await params;

  const run = await getRunDetalhe(runId);

  const company = run.companies as { name: string } | null;
  const empresa_nome = company?.name ?? "—";
  const competencia = run.competencia;

  type ItemDetalhe = {
    id: string;
    base_inss: number;
    base_fgts: number;
    total_proventos: number;
    total_descontos: number;
    liquido: number;
    status: string;
    folha_contratos: {
      employees: { name: string; cpf: string | null } | null;
      folha_perfis_calculo: { codigo: string; nome: string } | null;
    } | null;
  };

  const itensAtivos = ((run.folha_itens ?? []) as unknown as ItemDetalhe[]).filter(
    (i) => i.status === "ativo",
  );

  const itensComLanc = await Promise.all(
    itensAtivos.map(async (item) => {
      const lancRaw = await getItemLancamentos(item.id);

      type LancRow = {
        rubrica_codigo?: string;
        referencia: string | null;
        valor: number;
        origem: string;
        folha_rubricas: { codigo: string; nome: string; tipo: string } | null;
      };

      const lancamentos = (lancRaw as unknown as LancRow[]).map((l) => ({
        rubrica_codigo: l.folha_rubricas?.codigo ?? l.rubrica_codigo ?? "",
        rubrica_nome: l.folha_rubricas?.nome ?? "—",
        rubrica_tipo: l.folha_rubricas?.tipo ?? "informativa",
        referencia: l.referencia,
        valor: Number(l.valor),
        origem: l.origem,
      }));

      const contrato = item.folha_contratos;
      return {
        id: item.id,
        base_inss: Number(item.base_inss),
        base_fgts: Number(item.base_fgts),
        total_proventos: Number(item.total_proventos),
        total_descontos: Number(item.total_descontos),
        liquido: Number(item.liquido),
        employee_nome: contrato?.employees?.name ?? "—",
        employee_cpf: contrato?.employees?.cpf ?? "",
        perfil_codigo: contrato?.folha_perfis_calculo?.codigo ?? "",
        perfil_nome: contrato?.folha_perfis_calculo?.nome ?? "—",
        empresa_nome,
        lancamentos,
      };
    }),
  );

  const provisoesRaw = await getProvisoesSaldo();

  type ProvRow = {
    contrato_id: string;
    tipo: string;
    saldo_acumulado: number;
    folha_contratos: { employees: { name: string } | null } | null;
  };

  const provisoes = (provisoesRaw as unknown as ProvRow[]).map((p) => ({
    contrato_id: p.contrato_id,
    funcionario_nome: p.folha_contratos?.employees?.name ?? "—",
    tipo: p.tipo,
    saldo_acumulado: Number(p.saldo_acumulado),
  }));

  const supabase = await createServerClient();
  const { data: runItens } = await supabase
    .from("folha_itens")
    .select("contrato_id")
    .eq("run_id", runId)
    .eq("status", "ativo");

  const runContratoIds = new Set((runItens ?? []).map((i) => (i as { contrato_id: string }).contrato_id));
  const provisoesRun = provisoes.filter((p) => runContratoIds.has(p.contrato_id));

  const buffer = await gerarPacoteContador({
    competencia,
    empresa_nome,
    itens: itensComLanc,
    provisoes: provisoesRun,
  });

  return new NextResponse(buffer as unknown as BodyInit, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="folha-${competencia}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
