import { DEFAULT_SCHOOL_ID } from "@/lib/constants";
import { createServerClient } from "@/lib/supabase/server";
import type { LinhaLancamento } from "@/lib/previsto/previsto-realizado";

const LIMITE = 1000; // corte do PostgREST; um mês real tem ~130–400 linhas

type Bruta = {
  id: string; descricao: string; valor: number | string; status: string;
  origem_tipo: string; data_vencimento: string;
  categorias_financeiras: { nome: string } | { nome: string }[] | null;
};

function paraLinha(r: Bruta): LinhaLancamento {
  const cat = Array.isArray(r.categorias_financeiras) ? r.categorias_financeiras[0] : r.categorias_financeiras;
  return {
    id: r.id,
    descricao: r.descricao,
    categoria: cat?.nome ?? "Sem categoria",
    valor: Number(r.valor),
    status: r.status as "aberta" | "paga",
    origemTipo: r.origem_tipo,
    dataVencimento: r.data_vencimento,
  };
}

const CAMPOS = "id, descricao, valor, status, origem_tipo, data_vencimento, categorias_financeiras(nome)";

export async function getPrevistoRealizado(competencia: string, companyId: string | null) {
  const supabase = await createServerClient();

  let doMes = supabase
    .from("lancamento_financeiro").select(CAMPOS)
    .eq("escola_id", DEFAULT_SCHOOL_ID).eq("tipo", "despesa").eq("competencia", competencia)
    .in("status", ["aberta", "paga"]).limit(LIMITE);
  // Alerta de vencido olha TODAS as competências: conta esquecida de julho ainda é conta esquecida.
  let atrasados = supabase
    .from("lancamento_financeiro").select(CAMPOS)
    .eq("escola_id", DEFAULT_SCHOOL_ID).eq("tipo", "despesa").eq("status", "aberta")
    .lt("data_vencimento", new Date().toISOString().slice(0, 10))
    .order("data_vencimento").limit(LIMITE);

  if (companyId) {
    doMes = doMes.eq("company_id", companyId);
    atrasados = atrasados.eq("company_id", companyId);
  }

  const [mesRes, atrasadosRes, companiesRes] = await Promise.all([
    doMes, atrasados,
    supabase.from("companies").select("id, name").eq("ativo", true).order("name"),
  ]);
  if (mesRes.error) throw mesRes.error;
  if (atrasadosRes.error) throw atrasadosRes.error;

  // Truncar em silêncio faria o dashboard mentir; melhor quebrar alto.
  if ((mesRes.data?.length ?? 0) >= LIMITE) throw new Error("Resultado truncado: mais de 1000 lançamentos no mês.");

  return {
    doMes: ((mesRes.data ?? []) as unknown as Bruta[]).map(paraLinha),
    atrasados: ((atrasadosRes.data ?? []) as unknown as Bruta[]).map(paraLinha),
    empresas: (companiesRes.data ?? []).map((c) => ({ id: c.id as string, nome: c.name as string })),
  };
}
