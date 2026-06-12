import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/session";
import { getItemLancamentos } from "@/lib/data/folha";
import { gerarHoleritePdf } from "@/lib/folha/holerite-pdf";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ itemId: string }> },
) {
  await requirePermission("rh.folha-v2", "read");
  const { itemId } = await params;

  const supabase = await createServerClient();

  const { data: item, error: itemErr } = await supabase
    .from("folha_itens")
    .select(
      `id, base_inss, base_irrf, base_fgts, total_proventos, total_descontos, liquido,
       folha_runs:run_id(competencia, companies:company_id(name, cnpj)),
       folha_contratos:contrato_id(
         folha_perfis_calculo:perfil_calculo_id(nome),
         employees:employee_id(name, cpf)
       )`
    )
    .eq("id", itemId)
    .single();

  if (itemErr || !item) {
    return NextResponse.json({ error: "Item não encontrado" }, { status: 404 });
  }

  const lancamentos = await getItemLancamentos(itemId);

  type RunShape = {
    competencia: string;
    companies: { name: string; cnpj: string } | null;
  };
  type ContratoShape = {
    folha_perfis_calculo: { nome: string } | null;
    employees: { name: string; cpf: string | null } | null;
  };

  const run = item.folha_runs as unknown as RunShape | null;
  const contrato = item.folha_contratos as unknown as ContratoShape | null;

  const empresaNome = run?.companies?.name ?? "—";
  const empresaCnpj = run?.companies?.cnpj ?? "";
  const competencia = run?.competencia ?? "";
  const funcionarioNome = contrato?.employees?.name ?? "—";
  const funcionarioCpf = contrato?.employees?.cpf ?? "";
  const perfil = contrato?.folha_perfis_calculo?.nome ?? "—";

  type LancRow = {
    valor: number;
    referencia: string | null;
    folha_rubricas: { nome: string; tipo: string } | null;
  };

  const rows = (lancamentos as unknown as LancRow[]).map((l) => ({
    nome: l.folha_rubricas?.nome ?? "—",
    referencia: l.referencia,
    valor: Number(l.valor),
    tipo: l.folha_rubricas?.tipo ?? "informativa",
  }));

  const buffer = gerarHoleritePdf({
    empresa: { nome: empresaNome, cnpj: empresaCnpj },
    funcionario: { nome: funcionarioNome, cpf: funcionarioCpf, perfil },
    competencia,
    lancamentos: rows,
    bases: {
      inss: Number((item as unknown as Record<string, unknown>).base_inss ?? 0),
      irrf: Number((item as unknown as Record<string, unknown>).base_irrf ?? 0),
      fgts: Number((item as unknown as Record<string, unknown>).base_fgts ?? 0),
    },
    totais: {
      proventos: Number((item as unknown as Record<string, unknown>).total_proventos ?? 0),
      descontos: Number((item as unknown as Record<string, unknown>).total_descontos ?? 0),
      liquido: Number((item as unknown as Record<string, unknown>).liquido ?? 0),
    },
  });

  const safeName = `holerite_${funcionarioNome.replace(/\s+/g, "_")}_${competencia}.pdf`;

  return new NextResponse(Buffer.from(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${safeName}"`,
      "Cache-Control": "no-store",
    },
  });
}
