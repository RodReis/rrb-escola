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
         id,
         cargo,
         cbo,
         data_admissao,
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
    id: string;
    cargo: string | null;
    cbo: string | null;
    data_admissao: string | null;
    folha_perfis_calculo: { nome: string } | null;
    employees: { name: string; cpf: string | null } | null;
  };

  const run = item.folha_runs as unknown as RunShape | null;
  const contrato = item.folha_contratos as unknown as ContratoShape | null;
  const itemData = item as unknown as Record<string, unknown>;

  const empresaNome = run?.companies?.name ?? "—";
  const empresaCnpj = run?.companies?.cnpj ?? "";
  const competencia = run?.competencia ?? "";
  const funcionarioNome = contrato?.employees?.name ?? "—";
  const funcionarioCpf = contrato?.employees?.cpf ?? "";
  const funcionarioCodigo = (contrato?.id ?? "").slice(0, 8).toUpperCase();
  const funcionarioCargo = contrato?.cargo ?? "";
  const funcionarioCbo = contrato?.cbo ?? "";
  const funcionarioAdmissao = (() => {
    const raw = contrato?.data_admissao ?? null;
    if (!raw) return "";
    const [y, m, d] = raw.split("-");
    if (!y || !m || !d) return raw;
    return `${d}/${m}/${y}`;
  })();

  const baseInss = Number(itemData.base_inss ?? 0);
  const baseIrrf = Number(itemData.base_irrf ?? 0);
  const baseFgts = Number(itemData.base_fgts ?? 0);
  const totalVencimentos = Number(itemData.total_proventos ?? 0);
  const totalDescontos = Number(itemData.total_descontos ?? 0);
  const liquido = Number(itemData.liquido ?? 0);
  const fgtsMes = baseFgts * 0.08;

  type LancRow = {
    valor: number;
    referencia: string | null;
    folha_rubricas: { codigo: string; nome: string; tipo: string } | null;
  };

  const lancRows = (lancamentos as unknown as LancRow[]).map((l) => ({
    codigo: l.folha_rubricas?.codigo ?? "—",
    nome: l.folha_rubricas?.nome ?? "—",
    tipo: l.folha_rubricas?.tipo ?? "informativa",
    referencia: l.referencia,
    valor: Number(l.valor),
  }));

  const irrfLanc = lancRows.find(
    (l) =>
      l.tipo === "desconto" &&
      (l.codigo.toLowerCase() === "irrf" || l.codigo.toLowerCase().startsWith("irrf")),
  );
  const faixaIrrf =
    irrfLanc && baseIrrf > 0 && irrfLanc.valor > 0
      ? null
      : null;

  const irrfStoredRef = irrfLanc?.referencia ?? null;
  const faixaIrrfPct = (() => {
    if (irrfStoredRef) {
      const num = parseFloat(irrfStoredRef.replace(",", ".").replace("%", ""));
      if (!isNaN(num) && num > 0) return num;
    }
    return null;
  })();

  const salarioBase = (() => {
    const proventosBase = lancRows
      .filter((l) => l.tipo === "provento" && l.codigo.toLowerCase().includes("base"))
      .reduce((acc, l) => acc + l.valor, 0);
    return proventosBase > 0 ? proventosBase : null;
  })();

  const buffer = gerarHoleritePdf({
    empresa: { nome: empresaNome, cnpj: empresaCnpj },
    funcionario: {
      codigo: funcionarioCodigo,
      nome: funcionarioNome,
      cpf: funcionarioCpf,
      cargo: funcionarioCargo,
      cbo: funcionarioCbo,
      admissao: funcionarioAdmissao,
    },
    competencia,
    tipoFolha: "Folha Mensal",
    lancamentos: lancRows,
    bases: {
      inss: baseInss,
      irrf: baseIrrf,
      fgts: baseFgts,
      salarioBase,
      faixaIrrf: faixaIrrfPct,
    },
    totais: {
      vencimentos: totalVencimentos,
      descontos: totalDescontos,
      liquido,
      fgtsMes,
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
