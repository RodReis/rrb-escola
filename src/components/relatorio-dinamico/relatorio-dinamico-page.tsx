"use client";

import { useCallback, useRef, useState, useTransition, type ReactNode } from "react";
import { Printer, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Tabs } from "@/components/ui/tabs";
import { gerarDadosRelatorioAction, listarRegistrosAction } from "@/app/(app)/relatorios/dinamico/actions";
import { configPadrao, validarEmissao, type ColunaMeta, type EmpresaRelatorio, type Entidade, type RegistroResumo, type TemplateConfig, type TemplateResumo } from "@/lib/relatorio-dinamico/tipos";
import { emitirArquivo, sanearConfig } from "@/lib/relatorio-dinamico/render/emitir";
import { LeiauteForm } from "./leiaute-form";
import { RegistrosLista } from "./registros-lista";
import { TemplateBar } from "./template-bar";

export type RelatorioDinamicoPageProps = {
  entidade: Entidade;
  colunas: ColunaMeta[];
  templates: TemplateResumo[];
  empresas: EmpresaRelatorio[];
  permissoes: { criar: boolean; editar: boolean; excluir: boolean };
  filtros: (onChange: (f: unknown) => void) => ReactNode;
};

const NOME_BASE: Record<Entidade, string> = { aluno: "etiquetas-alunos", funcionario: "etiquetas-funcionarios", professor: "etiquetas-professores" };

export function RelatorioDinamicoPage({ entidade, colunas, templates: iniciais, empresas, permissoes, filtros }: RelatorioDinamicoPageProps) {
  const [templates, setTemplates] = useState(iniciais);
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [config, setConfig] = useState<TemplateConfig>(() => sanearConfig(configPadrao(entidade), colunas).config);
  const [registros, setRegistros] = useState<RegistroResumo[]>([]);
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const filtrosAtuais = useRef<unknown>(null);
  const reqAtual = useRef(0);
  const [carregando, iniciarCarga] = useTransition();
  const [emitindo, iniciarEmissao] = useTransition();

  const aoFiltrar = useCallback((f: unknown) => {
    filtrosAtuais.current = f;
    const req = ++reqAtual.current;
    iniciarCarga(async () => {
      const r = await listarRegistrosAction({ entidade, filtros: f });
      if (req !== reqAtual.current) return; // resposta antiga de um filtro já trocado
      if (!r.ok) return void toast.error(r.error);
      setRegistros(r.registros);
      setSelecionados(new Set(r.registros.map((x) => x.id)));
    });
  }, [entidade]);

  const carregarTemplate = (id: string | null) => {
    setTemplateId(id);
    const t = templates.find((x) => x.id === id);
    const { config: limpa, removidas } = sanearConfig(t?.config ?? configPadrao(entidade), colunas);
    if (removidas.length) toast.warning(`Colunas indisponíveis foram removidas do template: ${removidas.join(", ")}`);
    setConfig(limpa);
  };

  const bloqueio = validarEmissao(config, selecionados.size);

  const emitir = () =>
    iniciarEmissao(async () => {
      const ids = registros.filter((r) => selecionados.has(r.id)).map((r) => r.id);
      const r = await gerarDadosRelatorioAction({ entidade, ids, colunas: config.colunas, ordenacao: config.ordenacao, filtros: filtrosAtuais.current });
      if (!r.ok) return void toast.error(r.error);
      try {
        const { avisos } = await emitirArquivo(config, r.dados, empresas, templates.find((t) => t.id === templateId)?.nome ?? NOME_BASE[entidade]);
        avisos.forEach((a) => toast.warning(a));
      } catch (e) {
        toast.error(e instanceof Error ? `Falha ao gerar o arquivo: ${e.message}` : "Falha ao gerar o arquivo.");
      }
    });

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-end gap-2 rounded-ui bg-muted px-4 py-3">
        {bloqueio ? <span className="mr-auto text-sm text-ink/60">{bloqueio}</span> : null}
        <Button type="button" variant="secondary" onClick={() => carregarTemplate(templateId)}>
          <X size={14} className="mr-1.5" /> Cancelar
        </Button>
        <Button type="button" loading={emitindo} disabled={Boolean(bloqueio)} onClick={emitir}>
          <Printer size={14} className="mr-1.5" /> Emitir
        </Button>
      </div>
      <Tabs
        defaultValue="filtros"
        items={[
          {
            value: "filtros",
            label: "Filtros",
            content: (
              <div className="grid gap-4">
                {filtros(aoFiltrar)}
                <RegistrosLista registros={registros} selecionados={selecionados} onChange={setSelecionados} carregando={carregando} />
              </div>
            ),
          },
          {
            value: "leiaute",
            label: "Leiaute",
            content: (
              <div className="grid gap-5">
                <TemplateBar
                  entidade={entidade} templates={templates} selecionadoId={templateId} config={config} permissoes={permissoes}
                  onSelecionar={carregarTemplate}
                  onSalvo={(t) => { setTemplates((ts) => [...ts.filter((x) => x.id !== t.id), t].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"))); setTemplateId(t.id); }}
                  onExcluido={(id) => { setTemplates((ts) => ts.filter((x) => x.id !== id)); carregarTemplate(null); }}
                />
                <LeiauteForm config={config} onChange={setConfig} colunas={colunas} empresas={empresas} />
              </div>
            ),
          },
        ]}
      />
    </div>
  );
}
