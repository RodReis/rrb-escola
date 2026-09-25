"use client";

import { carregarImagens } from "@/lib/documents/pdf-utils";
import type { ColunaMeta, DadosRelatorio, EmpresaRelatorio, TemplateConfig } from "../tipos";
import { repetirCopias } from "../ordenar";
import { gerarCsv } from "./csv";
import { baixarBlob, nomeArquivo } from "./baixar";
import { linhasQueCabem, renderEtiquetas } from "./etiqueta";
import { MODELOS_ETIQUETA } from "./modelos-etiqueta";
import { renderGrade } from "./grade";
import { renderTabular } from "./tabular";
import type { ImagemPdf } from "./cabecalho";

export function selecionarEmpresas(config: TemplateConfig, empresas: EmpresaRelatorio[]): { cabecalho: EmpresaRelatorio | null; logos: EmpresaRelatorio[] } {
  const escolhidas = (config.logosEmpresas ?? [])
    .map((id) => empresas.find((e) => e.id === id))
    .filter((e): e is EmpresaRelatorio => Boolean(e));
  const cabecalho = escolhidas[0] ?? empresas[0] ?? null;
  if (config.exibirLogos === false) return { cabecalho, logos: [] };
  const base = escolhidas.length > 0 ? escolhidas : empresas.filter((e) => e.logoUrl).slice(0, 1);
  return { cabecalho, logos: base.filter((e) => e.logoUrl).slice(0, 4) };
}

/** Aviso quando as colunas escolhidas não cabem fisicamente na etiqueta (modelo × fonte), ou null se couberem. */
export function avisoColunasNaoCabem(dados: DadosRelatorio, config: TemplateConfig): string | null {
  const modelo = MODELOS_ETIQUETA[config.modeloEtiqueta ?? "6180"];
  const cabem = linhasQueCabem(modelo, config.fonte ?? 7.5);
  if (dados.colunas.length <= cabem) return null;
  const sobram = dados.colunas.length - cabem;
  const nomes = dados.colunas.slice(cabem).map((c) => c.label).join(", ");
  return `Cabem ${cabem} de ${dados.colunas.length} colunas nesta etiqueta — as ${sobram} última${sobram === 1 ? "" : "s"} (${nomes}) não saíram. Diminua colunas, a fonte ou use uma etiqueta maior.`;
}

/** Template salvo pode citar coluna que saiu do catálogo ou que o usuário não pode ver. */
export function sanearConfig(config: TemplateConfig, colunas: ColunaMeta[]): { config: TemplateConfig; removidas: string[] } {
  const validas = new Set(colunas.map((c) => c.key));
  const removidas = config.colunas.filter((k) => !validas.has(k));
  if (removidas.length === 0) return { config, removidas };
  const cols = config.colunas.filter((k) => validas.has(k));
  return { config: { ...config, colunas: cols, ordenacao: config.ordenacao.filter((o) => cols.includes(o.key)) }, removidas };
}

export async function emitirArquivo(
  config: TemplateConfig, dados: DadosRelatorio, empresas: EmpresaRelatorio[], nomeBase: string
): Promise<{ avisos: string[] }> {
  const avisos: string[] = [];
  const comCopias: DadosRelatorio = { ...dados, linhas: repetirCopias(dados.linhas, config.copias) };

  if (config.formato === "csv") {
    baixarBlob(new Blob([gerarCsv(comCopias)], { type: "text/csv;charset=utf-8" }), nomeArquivo(nomeBase, "csv"));
    return { avisos };
  }
  if (config.formato === "etiqueta") {
    const aviso = avisoColunasNaoCabem(dados, config);
    if (aviso) avisos.push(aviso);
    renderEtiquetas(comCopias, {
      modelo: config.modeloEtiqueta ?? "6180", fonte: config.fonte ?? 7.5, rotulos: config.rotulos ?? true, descricao: config.descricaoImpressao,
    }).save(nomeArquivo(nomeBase, "pdf"));
    return { avisos };
  }

  const { cabecalho, logos } = selecionarEmpresas(config, empresas);
  const urls = logos.map((e) => e.logoUrl as string);
  const cache = await carregarImagens(urls);
  const imagens: ImagemPdf[] = [];
  logos.forEach((e, i) => {
    const img = cache.get(urls[i]);
    if (img) imagens.push(img);
    else avisos.push(`Não foi possível carregar a logo de ${e.nomeFantasia}.`);
  });
  const cab = {
    titulo: config.titulo?.trim() ?? "",
    subtitulo: config.subtitulo?.trim() || undefined,
    empresaNome: cabecalho?.nomeFantasia ?? null,
    resolucao: cabecalho?.resolucao ?? null,
    logos: imagens,
    emitidoEm: new Date(),
    descricao: config.descricaoImpressao?.trim() || undefined,
  };
  const doc = config.formato === "grade" ? renderGrade(comCopias, cab) : renderTabular(comCopias, cab);
  doc.save(nomeArquivo(config.titulo || nomeBase, "pdf"));
  return { avisos };
}
