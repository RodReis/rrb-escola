import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { consultarExtrato, type SicoobExtratoItem } from "@/lib/sicoob/extrato";

function normalizarTipo(tipo: string | undefined, valor: number): "credito" | "debito" {
  const t = (tipo ?? "").toLowerCase();
  if (t.includes("deb") || valor < 0) return "debito";
  return "credito";
}

function normalizarData(value: string | undefined): string {
  if (!value) return new Date().toISOString().slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
  const [d, m, y] = value.split(/[/-]/);
  if (d && m && y) return `${y.padStart(4, "20")}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  return new Date().toISOString().slice(0, 10);
}

// O extrato não traz endToEndId em campo próprio; quando o movimento é Pix, o
// identificador aparece dentro do texto complementar.
export function extrairEndToEndId(item: SicoobExtratoItem): string | null {
  const texto = `${item.descInfComplementar ?? ""} ${item.descricao ?? ""}`;
  return texto.match(/E\d{8}\d{12}[a-zA-Z0-9]{11}/)?.[0] ?? null;
}

function mapItem(item: SicoobExtratoItem, contaId: string, escolaId: string) {
  const valor = Math.abs(Number(item.valor ?? 0));
  const data = normalizarData(item.data);
  return {
    escola_id: escolaId,
    conta_id: contaId,
    id_transacao: String(item.numeroDocumento ?? `${data}-${item.descricao}-${item.valor}`),
    data,
    tipo: normalizarTipo(item.tipo, Number(item.valor ?? 0)),
    valor,
    descricao: String(item.descricao ?? "Movimento Sicoob"),
    end_to_end_id: extrairEndToEndId(item),
    contraparte_doc: item.cpfCnpj ?? null,
    payload: item,
  };
}

// A janela de 3 dias pode cruzar a virada do mês, e o extrato do Sicoob é
// mensal — então busca o mês corrente e, quando necessário, também o anterior.
export function competenciasDaJanela(hoje: Date): Array<{ mes: number; ano: number }> {
  const inicio = new Date(hoje);
  inicio.setDate(inicio.getDate() - 3);
  const atual = { mes: hoje.getMonth() + 1, ano: hoje.getFullYear() };
  const anterior = { mes: inicio.getMonth() + 1, ano: inicio.getFullYear() };
  const mesmaCompetencia = atual.mes === anterior.mes && atual.ano === anterior.ano;
  return mesmaCompetencia ? [atual] : [anterior, atual];
}

export async function syncExtratoSicoob(input?: { mes?: number; ano?: number }) {
  const supabase = createAdminClient();
  const hoje = new Date();
  const competencias =
    input?.mes && input?.ano ? [{ mes: input.mes, ano: input.ano }] : competenciasDaJanela(hoje);

  const { data: contas, error } = await supabase
    .from("contas_bancarias")
    .select("id, escola_id, conta")
    .eq("provedor", "sicoob")
    .eq("ativo", true);

  if (error) throw error;

  let inseridos = 0;
  for (const conta of contas ?? []) {
    for (const competencia of competencias) {
      const extrato = await consultarExtrato({
        contaCorrente: conta.conta,
        mes: competencia.mes,
        ano: competencia.ano,
      });
      if (!extrato.ok) throw new Error(extrato.reason);

      const itens = extrato.data.transacoes ?? [];
      const rows = itens.map((item) => mapItem(item, conta.id, conta.escola_id));
      if (rows.length === 0) continue;

      const { error: upsertError } = await supabase
        .from("extrato_bancario")
        .upsert(rows, { onConflict: "conta_id,id_transacao" });
      if (upsertError) throw upsertError;
      inseridos += rows.length;
    }
  }

  const { data: pendentes } = await supabase
    .from("extrato_bancario")
    .select("id, end_to_end_id")
    .eq("status_conciliacao", "pendente")
    .not("end_to_end_id", "is", null);

  for (const linha of pendentes ?? []) {
    const { data: pixRecebido } = await supabase
      .from("pix_recebido")
      .select("txid, valor")
      .eq("end_to_end_id", linha.end_to_end_id)
      .maybeSingle();

    if (!pixRecebido?.txid) continue;

    const { data: pixCobranca } = await supabase
      .from("pix_cobranca")
      .select("origem_tipo, origem_id")
      .eq("txid", pixRecebido.txid)
      .maybeSingle();

    if (pixCobranca?.origem_tipo !== "cobranca" || !pixCobranca.origem_id) continue;

    const { data: pagamento } = await supabase
      .from("pagamentos")
      .select("id")
      .eq("cobranca_id", pixCobranca.origem_id)
      .eq("forma_pagamento", "pix")
      .eq("valor_pago", pixRecebido.valor)
      .is("cancelado_em", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!pagamento?.id) continue;

    await supabase.from("conciliacao_vinculo").upsert({
      extrato_id: linha.id,
      alvo_tipo: "pagamento",
      alvo_id: pagamento.id,
      valor: Number(pixRecebido.valor ?? 0),
      origem: "auto",
    }, { onConflict: "extrato_id,alvo_tipo,alvo_id" });

    await supabase
      .from("extrato_bancario")
      .update({ status_conciliacao: "auto" })
      .eq("id", linha.id);
  }

  return { ok: true, competencias, contas: contas?.length ?? 0, movimentos: inseridos };
}
