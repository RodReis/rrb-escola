import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/session";
import { getItemLancamentos } from "@/lib/data/folha";
import { gerarHoleritePdf, HoleriteOpcoes } from "@/lib/folha/holerite-pdf";

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
       periodo_aquisitivo_id,
       folha_runs:run_id(competencia, tipo, companies:company_id(name, cnpj, endereco, cidade)),
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

  type CompanyShape = { name: string; cnpj: string; endereco: string | null; cidade: string | null };
  type RunShape = {
    competencia: string;
    tipo: string;
    companies: CompanyShape | null;
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

  const runTipo = run?.tipo ?? "mensal";
  const empresaNome = run?.companies?.name ?? "—";
  const empresaCnpj = run?.companies?.cnpj ?? "";
  const empresaEndereco = run?.companies?.endereco ?? "";
  const empresaCidade = run?.companies?.cidade ?? "";
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

  const lancamentos = await getItemLancamentos(itemId);

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

  let tipoFolhaLabel = "Folha Mensal";
  let opcoes: HoleriteOpcoes | undefined;

  if (runTipo === "ferias") {
    const periodoAquisitivoId = itemData.periodo_aquisitivo_id as string | null;

    let periodoAquisitivoStr = "—";
    let gozoStr = "—";

    if (periodoAquisitivoId) {
      const { data: periodo } = await supabase
        .from("folha_periodos_aquisitivos")
        .select("inicio, fim, gozo_inicio, gozo_dias")
        .eq("id", periodoAquisitivoId)
        .single();

      if (periodo) {
        const fmtD = (iso: string | null) => {
          if (!iso) return "—";
          const [y, m, d] = iso.split("-");
          return `${d}/${m}/${y}`;
        };
        periodoAquisitivoStr = `${fmtD(periodo.inicio)} a ${fmtD(periodo.fim)}`;
        const gozoDias = periodo.gozo_dias ?? 30;
        gozoStr = `${fmtD(periodo.gozo_inicio)} (${gozoDias} dias)`;
      }
    }

    tipoFolhaLabel = "Recibo de Férias";
    opcoes = {
      titulo: "Recibo de Férias",
      assinatura: true,
      cabecalhoExtra: [
        `Período aquisitivo: ${periodoAquisitivoStr}`,
        `Gozo: ${gozoStr}`,
      ],
      ferias: {
        periodoAquisitivo: periodoAquisitivoStr,
        gozo: gozoStr,
        empresaEndereco,
        empresaCidade,
      },
    };
  } else if (runTipo === "decimo_1a") {
    tipoFolhaLabel = "Recibo 13º Salário — 1ª parcela";
    opcoes = { titulo: tipoFolhaLabel };
  } else if (runTipo === "decimo_2a") {
    tipoFolhaLabel = "Recibo 13º Salário — 2ª parcela";
    opcoes = { titulo: tipoFolhaLabel };
  }

  const buffer = gerarHoleritePdf({
    empresa: { nome: empresaNome, cnpj: empresaCnpj, endereco: empresaEndereco, cidade: empresaCidade },
    funcionario: {
      codigo: funcionarioCodigo,
      nome: funcionarioNome,
      cpf: funcionarioCpf,
      cargo: funcionarioCargo,
      cbo: funcionarioCbo,
      admissao: funcionarioAdmissao,
    },
    competencia,
    tipoFolha: tipoFolhaLabel,
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
  }, opcoes);

  const safeName = `holerite_${funcionarioNome.replace(/\s+/g, "_")}_${competencia}_${runTipo}.pdf`;

  return new NextResponse(Buffer.from(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${safeName}"`,
      "Cache-Control": "no-store",
    },
  });
}
