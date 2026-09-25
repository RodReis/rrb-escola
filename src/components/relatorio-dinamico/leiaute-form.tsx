"use client";

import { FORMATOS, FORMATO_LABEL, MODELOS_ETIQUETA_CODIGOS, type ColunaMeta, type EmpresaRelatorio, type Formato, type ModeloEtiqueta, type TemplateConfig } from "@/lib/relatorio-dinamico/tipos";
import { MODELOS_ETIQUETA, descricaoModelo } from "@/lib/relatorio-dinamico/render/modelos-etiqueta";
import { linhasQueCabem } from "@/lib/relatorio-dinamico/render/etiqueta";
import { Acordeao } from "./acordeao";
import { ListaDupla } from "./lista-dupla";
import { OrdenacaoEditor } from "./ordenacao-editor";
import { Segmentado } from "./segmentado";
import { Stepper } from "./stepper";

type Props = { config: TemplateConfig; onChange: (c: TemplateConfig) => void; colunas: ColunaMeta[]; empresas: EmpresaRelatorio[] };

export function LeiauteForm({ config, onChange, colunas, empresas }: Props) {
  const set = <K extends keyof TemplateConfig>(k: K, v: TemplateConfig[K]) => onChange({ ...config, [k]: v });
  const pdfRelatorio = config.formato === "grade" || config.formato === "tabular";
  const sufixo = config.formato === "grade" ? "grade" : "tabular";
  const comLogo = empresas.filter((e) => e.logoUrl);
  const selecionadasMeta = config.colunas.map((k) => colunas.find((c) => c.key === k)).filter((c): c is ColunaMeta => Boolean(c));
  const modelo = MODELOS_ETIQUETA[config.modeloEtiqueta ?? "6180"];
  const cabemNaEtiqueta = linhasQueCabem(modelo, config.fonte ?? 7.5);
  const colunasQueSobram = config.formato === "etiqueta" ? Math.max(0, config.colunas.length - cabemNaEtiqueta) : 0;

  const alternarLogo = (id: string) => {
    const atual = config.logosEmpresas ?? [];
    set("logosEmpresas", atual.includes(id) ? atual.filter((x) => x !== id) : [...atual, id].slice(0, 4));
  };
  const setColunas = (keys: string[]) =>
    onChange({ ...config, colunas: keys, ordenacao: config.ordenacao.filter((o) => keys.includes(o.key)) });

  return (
    <div className="grid gap-5">
      <div className="grid gap-4 md:grid-cols-4">
        <label>
          Formato de emissão
          <select value={config.formato} onChange={(e) => set("formato", e.target.value as Formato)}>
            {FORMATOS.map((f) => <option key={f} value={f}>{FORMATO_LABEL[f]}</option>)}
          </select>
        </label>
        {config.formato === "etiqueta" ? (
          <>
            <label>
              Formato da etiqueta
              <select value={config.modeloEtiqueta ?? "6180"} onChange={(e) => set("modeloEtiqueta", e.target.value as ModeloEtiqueta)}>
                {MODELOS_ETIQUETA_CODIGOS.map((m) => <option key={m} value={m}>{MODELOS_ETIQUETA[m].nome}</option>)}
              </select>
            </label>
            <div>
              <span className="mb-1 block text-sm font-medium text-ink">Fonte</span>
              <Stepper value={config.fonte ?? 7.5} onChange={(v) => set("fonte", v)} min={6} max={12} step={0.5} decimais={1} ariaLabel="Fonte" />
              <p className={`mt-1 text-xs ${colunasQueSobram > 0 ? "font-medium text-warning" : "text-ink/50"}`}>
                {colunasQueSobram > 0
                  ? `Cabem ${cabemNaEtiqueta} de ${config.colunas.length} colunas nesta etiqueta — as ${colunasQueSobram} últimas não saem. Diminua colunas, a fonte ou use uma etiqueta maior.`
                  : `Cabem até ${cabemNaEtiqueta} colunas nesta etiqueta.`}
              </p>
            </div>
            <div>
              <span className="mb-1 block text-sm font-medium text-ink">Rótulos dos campos</span>
              <Segmentado value={config.rotulos ?? true} onChange={(v) => set("rotulos", v)} ariaLabel="Rótulos dos campos" />
            </div>
          </>
        ) : null}

        {pdfRelatorio ? (
          <>
            <label>
              Título do relatório {sufixo}
              <input value={config.titulo ?? ""} maxLength={120} onChange={(e) => set("titulo", e.target.value)} required />
            </label>
            <label>
              Subtítulo do relatório {sufixo}
              <input value={config.subtitulo ?? ""} maxLength={120} onChange={(e) => set("subtitulo", e.target.value)} />
            </label>
          </>
        ) : null}

        {config.formato !== "csv" ? (
          <label className={config.formato === "etiqueta" ? "" : "md:col-span-2"}>
            Descrição para impressão
            <input value={config.descricaoImpressao ?? ""} maxLength={200} onChange={(e) => set("descricaoImpressao", e.target.value)} />
          </label>
        ) : null}

        <div>
          <span className="mb-1 block text-sm font-medium text-ink" title="Quantas vezes cada registro sai no arquivo">Qtd de cópias</span>
          <Stepper value={config.copias} onChange={(v) => set("copias", v)} min={1} max={10} step={1} ariaLabel="Quantidade de cópias" />
        </div>

        {config.formato === "etiqueta" ? (
          <p className="md:col-span-3 self-end text-xs text-ink/55">{descricaoModelo(modelo)}</p>
        ) : null}

        {pdfRelatorio ? (
          <div className="md:col-span-4 grid gap-2">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-ink">Exibir logos</span>
              <div className="w-40"><Segmentado value={config.exibirLogos ?? true} onChange={(v) => set("exibirLogos", v)} ariaLabel="Exibir logos" /></div>
            </div>
            {config.exibirLogos !== false ? (
              <fieldset className="flex flex-wrap items-center gap-3">
                <legend className="mb-1 text-xs text-ink/60">Logos das empresas (até 4, na ordem de marcação; nenhuma = logo padrão)</legend>
                {comLogo.length === 0 ? <p className="text-sm text-ink/55">Nenhuma empresa com logo cadastrada em RH › Empresas.</p> : null}
                {comLogo.map((e) => {
                  const pos = (config.logosEmpresas ?? []).indexOf(e.id);
                  return (
                    <label key={e.id} className="flex items-center gap-2 rounded-ui border border-line px-3 py-2 text-sm">
                      <input type="checkbox" className="h-4 w-4 shrink-0 accent-brand" checked={pos >= 0} onChange={() => alternarLogo(e.id)} disabled={pos < 0 && (config.logosEmpresas ?? []).length >= 4} />
                      {pos >= 0 ? <span className="text-xs font-semibold text-brand">{pos + 1}º</span> : null}
                      {e.nomeFantasia}
                    </label>
                  );
                })}
              </fieldset>
            ) : null}
          </div>
        ) : null}
      </div>

      <Acordeao
        titulo={`Colunas · ${config.colunas.length} selecionada${config.colunas.length === 1 ? "" : "s"}${colunasQueSobram > 0 ? ` (${colunasQueSobram} não cabem na etiqueta)` : ""}`}
        defaultOpen
      >
        <ListaDupla disponiveis={colunas} selecionadas={config.colunas} onChange={setColunas} />
      </Acordeao>
      <Acordeao titulo={`Ordenação${config.ordenacao.length ? ` · ${config.ordenacao.length}` : ""}`}>
        <OrdenacaoEditor colunas={selecionadasMeta} valor={config.ordenacao} onChange={(o) => set("ordenacao", o)} />
      </Acordeao>
    </div>
  );
}
