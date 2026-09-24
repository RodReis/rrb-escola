import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { createHash } from "node:crypto";
import { consultarExtrato, type SicoobExtratoItem } from "@/lib/sicoob/extrato";
import { extrairDocumentoContraparte } from "@/lib/conciliacao/documento-contraparte";
import {
  casarTransferenciasIsaac,
  JANELA_DIAS,
  type CreditoExtrato,
  type TransferenciaPendente,
} from "@/lib/conciliacao/casar-transferencia-isaac";

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

/**
 * Converte o valor do extrato em número.
 *
 * O Sicoob manda string no formato americano (`"120779.92"`). A versão anterior
 * removia TODOS os pontos antes de trocar a vírgula, tratando o ponto sempre
 * como separador de milhar: `"120779.92"` virava `12077992` — o valor em
 * centavos, cem vezes maior, gravado no extrato sem erro nenhum. O teste que
 * existia (`"1.234,56"`) passava porque ali o ponto É milhar.
 *
 * Regra: o ponto só é separador de milhar quando a string também tem vírgula,
 * que é quem marca o decimal no formato brasileiro.
 *
 * O sandbox devolve texto fictício, que viraria NaN e seria rejeitado pela
 * coluna numeric — por isso o movimento é descartado em vez de derrubar a
 * sincronização inteira.
 */
export function parseValor(valor: string | number | undefined): number | null {
  if (typeof valor === "number") return Number.isFinite(valor) ? valor : null;
  if (!valor) return null;

  const texto = String(valor).trim();
  const normalizado = texto.includes(",")
    ? texto.replace(/\./g, "").replace(",", ".")
    : texto;

  const n = Number(normalizado);
  return Number.isFinite(n) ? n : null;
}

/**
 * Tira as transações da resposta do extrato.
 *
 * Produção embrulha o corpo num `resultado` (mesmo envelope em que o saldo vem como
 * `resultado.saldo`); o sandbox devolve os campos na raiz. O código lia só a raiz, então em
 * produção `transacoes` era sempre `undefined` e o `?? []` transformava isso em "mês sem
 * movimento" — HTTP 200, nenhum erro, extrato vazio todo dia.
 *
 * Aceita as duas formas de propósito: sandbox e produção têm que funcionar no mesmo código.
 */
export function extrairTransacoes(data: unknown): SicoobExtratoItem[] {
  if (!data || typeof data !== "object") return [];

  const raiz = data as Record<string, unknown>;
  if (Array.isArray(raiz.transacoes)) return raiz.transacoes as SicoobExtratoItem[];

  const resultado = raiz.resultado;
  if (resultado && typeof resultado === "object") {
    const dentro = (resultado as Record<string, unknown>).transacoes;
    if (Array.isArray(dentro)) return dentro as SicoobExtratoItem[];
  }

  return [];
}

/**
 * Identificador estável da linha do extrato.
 *
 * `transactionId` é a chave. Medido em produção em 24/09/2026: 87/87 e 50/50
 * valores distintos nas duas contas — um por transação.
 *
 * `numeroDocumento` era a chave antes e NÃO serve: as mesmas 87 transações
 * tinham só 23 números distintos (50 para 12 na outra conta). Isso derrubava o
 * upsert inteiro com `ON CONFLICT DO UPDATE command cannot affect row a second
 * time` (21000) e, sem o erro, teria feito o `unique (conta_id, id_transacao)`
 * colapsar 87 movimentos em 23 — 64 linhas sumindo em silêncio. Ele fica só
 * como fallback para resposta que não traga `transactionId`.
 *
 * O `ordinal` é a posição do item entre os itens idênticos da mesma resposta,
 * o que separa duas linhas iguais quando não há identificador nenhum. Risco
 * conhecido: se o Sicoob mudar a ORDEM dos itens entre consultas, a mesma
 * linha pode receber ordinal diferente e entrar duplicada. Isso é preferível a
 * perder movimento, e só afeta linhas sem `transactionId` nem
 * `numeroDocumento`.
 */
export function idTransacao(
  item: SicoobExtratoItem,
  contaId: string,
  data: string,
  ordinal: number,
): string {
  if (item.transactionId) return String(item.transactionId);
  if (item.numeroDocumento) return String(item.numeroDocumento);
  const partes = [
    contaId,
    data,
    String(item.tipo ?? ""),
    String(item.valor ?? ""),
    String(item.descricao ?? ""),
    String(item.descInfComplementar ?? ""),
    String(ordinal),
  ].join("|");
  return `sha:${createHash("sha256").update(partes).digest("hex").slice(0, 32)}`;
}

function mapItem(item: SicoobExtratoItem, contaId: string, escolaId: string, ordinal: number) {
  const valorBruto = parseValor(item.valor);
  if (valorBruto === null) return null;
  const data = normalizarData(item.data);
  return {
    escola_id: escolaId,
    conta_id: contaId,
    id_transacao: idTransacao(item, contaId, data, ordinal),
    data,
    tipo: normalizarTipo(item.tipo, valorBruto),
    valor: Math.abs(valorBruto),
    descricao: String(item.descricao ?? "Movimento Sicoob"),
    end_to_end_id: extrairEndToEndId(item),
    contraparte_doc: extrairDocumentoContraparte(item),
    payload: item,
  };
}

/**
 * Mapeia a resposta do extrato para linhas do banco.
 *
 * O `ordinal` conta APENAS entre itens idênticos (mesma data, tipo, valor e
 * descrição), não a posição absoluta na resposta. Usar a posição absoluta faria
 * qualquer item novo no meio do mês deslocar todos os seguintes e reimportar o
 * extrato inteiro como se fosse movimento novo.
 *
 * O lote sai com `id_transacao` único: o upsert manda tudo num comando só, e o
 * Postgres recusa o comando INTEIRO quando duas linhas trazem a mesma chave
 * (`ON CONFLICT DO UPDATE command cannot affect row a second time`, 21000).
 * Hoje `transactionId` já garante isso; a guarda existe para a resposta que não
 * o traga — melhor uma chave desambiguada do que o mês inteiro sem gravar.
 */
export function mapearLote(itens: SicoobExtratoItem[], contaId: string, escolaId: string) {
  const vistos = new Map<string, number>();
  const chavesUsadas = new Set<string>();
  const rows = [];
  for (const item of itens) {
    const assinatura = [
      normalizarData(item.data),
      String(item.tipo ?? ""),
      String(item.valor ?? ""),
      String(item.descricao ?? ""),
      String(item.descInfComplementar ?? ""),
    ].join("|");
    const ordinal = vistos.get(assinatura) ?? 0;
    vistos.set(assinatura, ordinal + 1);
    const row = mapItem(item, contaId, escolaId, ordinal);
    if (row === null) continue;

    if (chavesUsadas.has(row.id_transacao)) {
      let sufixo = 2;
      while (chavesUsadas.has(`${row.id_transacao}#${sufixo}`)) sufixo += 1;
      row.id_transacao = `${row.id_transacao}#${sufixo}`;
    }
    chavesUsadas.add(row.id_transacao);
    rows.push(row);
  }
  return rows;
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
    .select("id, escola_id, conta, credencial_ref")
    .eq("provedor", "sicoob")
    .eq("ativo", true);

  if (error) throw error;

  let inseridos = 0;
  let descartados = 0;
  // Falha de uma conta não pode derrubar a sincronização das outras: com dois
  // CNPJs, um certificado vencido deixaria o outro banco sem extrato nenhum.
  const falhas: string[] = [];
  for (const conta of contas ?? []) {
    for (const competencia of competencias) {
      const extrato = await consultarExtrato({
        contaCorrente: conta.conta,
        mes: competencia.mes,
        ano: competencia.ano,
        credencialRef: conta.credencial_ref,
      });
      if (!extrato.ok) {
        falhas.push(`conta ${conta.conta} (${competencia.mes}/${competencia.ano}): ${extrato.reason}`);
        continue;
      }

      const itens = extrairTransacoes(extrato.data);
      const rows = mapearLote(itens, conta.id, conta.escola_id);
      descartados += itens.length - rows.length;
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

  const repasses = await conciliarTransferenciasIsaac(supabase);

  return {
    ok: true,
    competencias,
    contas: contas?.length ?? 0,
    movimentos: inseridos,
    descartados,
    falhas,
    repasses,
  };
}

/**
 * Casa as transferências do repasse isaac com créditos do extrato.
 *
 * Roda depois do upsert, sobre o que está no banco — não sobre a resposta da
 * API — porque a transferência do dia 05 pode casar com um crédito importado
 * numa execução anterior.
 */
async function conciliarTransferenciasIsaac(supabase: ReturnType<typeof createAdminClient>) {
  const { data: pendentesRaw } = await supabase
    .from("isaac_transferencia")
    .select("id, repasse_id, data_prevista, valor, isaac_repasse(unidade_id, isaac_unidade(company_id))")
    .is("extrato_id", null);

  const pendentes: TransferenciaPendente[] = (pendentesRaw ?? []).map((row) => {
    const repasse = Array.isArray(row.isaac_repasse) ? row.isaac_repasse[0] : row.isaac_repasse;
    const unidade = repasse
      ? Array.isArray(repasse.isaac_unidade)
        ? repasse.isaac_unidade[0]
        : repasse.isaac_unidade
      : null;
    return {
      id: row.id as string,
      repasseId: row.repasse_id as string,
      dataPrevista: row.data_prevista as string,
      valor: Number(row.valor),
      companyId: (unidade?.company_id as string | undefined) ?? null,
    };
  });

  if (pendentes.length === 0) return { casadas: 0, alertas: [] as string[] };

  // Só créditos ainda não conciliados, na janela das transferências pendentes.
  const datas = pendentes.map((t) => t.dataPrevista).sort();
  const de = new Date(`${datas[0]}T12:00:00Z`);
  de.setDate(de.getDate() - JANELA_DIAS);
  const ate = new Date(`${datas[datas.length - 1]}T12:00:00Z`);
  ate.setDate(ate.getDate() + JANELA_DIAS);

  const { data: creditosRaw } = await supabase
    .from("extrato_bancario")
    .select("id, conta_id, data, valor, descricao, contas_bancarias(company_id)")
    .eq("tipo", "credito")
    .eq("status_conciliacao", "pendente")
    .gte("data", de.toISOString().slice(0, 10))
    .lte("data", ate.toISOString().slice(0, 10));

  const creditos: CreditoExtrato[] = (creditosRaw ?? []).map((row) => {
    const conta = Array.isArray(row.contas_bancarias) ? row.contas_bancarias[0] : row.contas_bancarias;
    return {
      id: row.id as string,
      contaId: row.conta_id as string,
      companyId: (conta?.company_id as string | undefined) ?? null,
      data: row.data as string,
      valor: Number(row.valor),
      descricao: String(row.descricao ?? ""),
    };
  });

  const { casamentos, alertas } = casarTransferenciasIsaac(pendentes, creditos);

  for (const casamento of casamentos) {
    await supabase
      .from("isaac_transferencia")
      .update({ extrato_id: casamento.extratoId })
      .eq("id", casamento.transferenciaId);

    await supabase.from("conciliacao_vinculo").upsert(
      {
        extrato_id: casamento.extratoId,
        alvo_tipo: "repasse_isaac",
        alvo_id: casamento.transferenciaId,
        valor: casamento.valor,
        origem: "auto",
      },
      { onConflict: "extrato_id,alvo_tipo,alvo_id" },
    );

    await supabase
      .from("extrato_bancario")
      .update({ status_conciliacao: "auto" })
      .eq("id", casamento.extratoId);
  }

  return {
    casadas: casamentos.length,
    alertas: alertas.map((a) => `${a.dataPrevista} (${a.tipo}): ${a.detalhe}`),
  };
}
