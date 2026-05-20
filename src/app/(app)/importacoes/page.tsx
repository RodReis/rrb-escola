import { ExternalLink, UploadCloud, FileUp, Inbox } from "lucide-react";
import { markImportProcessedAction, uploadStudentImportAction } from "@/lib/actions/imports";
import { getImportedFiles } from "@/lib/data/imports";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, Panel } from "@/components/ui/card";
import { requirePermission } from "@/lib/auth/session";

function tone(status: string) {
  if (status === "processado") return "green";
  if (status === "erro") return "red";
  return "gold";
}

function dateText(value: string) {
  return new Date(value).toLocaleString("pt-BR");
}

export default async function ImportaçõesPage() {
  await requirePermission("importacoes", "read");
  const files = await getImportedFiles();
  const processed = files.filter((file) => file.status === "processado").length;
  const pending = files.filter((file) => file.status === "pendente").length;
  const errors = files.filter((file) => file.status === "erro").length;

  const summary = [
    ["Arquivos", String(files.length)],
    ["Pendentes", String(pending)],
    ["Processados", String(processed)],
    ["Erros", String(errors)]
  ];

  return (
    <div className="grid gap-6">
      <section className="-mx-4 -mt-6 border-b border-line bg-surface px-4 py-8 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-8 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="flex items-center gap-3 text-[0.66rem] font-black uppercase tracking-[0.16em] text-ink/58">
              <span>PDF de alunos</span>
              <span className="text-line">/</span>
              <span className="text-brand">Importações</span>
            </p>
            <h1 className="mt-8 text-4xl font-black leading-none text-brand md:text-5xl">
              Importações <span className="font-serif italic text-ink/42">{files.length}</span>
            </h1>
            <p className="mt-4 max-w-2xl text-sm font-medium leading-6 text-ink/68">
              Controle de PDFs e planilhas recebidos para conferência e cadastro em lote na base local.
            </p>
          </div>

          <dl className="grid gap-0 sm:grid-cols-4">
            {summary.map(([label, value]) => (
              <div key={label} className="border-line py-1 sm:border-l sm:px-6 first:sm:border-l-0">
                <dt className="text-xs font-medium text-ink/62">{label}</dt>
                <dd className="mt-1 font-serif text-2xl italic leading-none text-brand">{value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        {summary.map(([label, value]) => (
          <Card key={label} className="p-5">
            <p className="ds-kicker">{label}</p>
            <strong className="mt-3 block text-3xl font-black text-ink">{value}</strong>
          </Card>
        ))}
      </section>

      <Panel className="grid gap-5">
        <div>
          <p className="ds-kicker">Novo arquivo</p>
          <h2 className="mt-2 flex items-center gap-2 text-xl font-black text-ink">
            <FileUp size={20} className="text-brand" />
            Enviar arquivo de alunos
          </h2>
        </div>
        <form action={uploadStudentImportAction} className="grid gap-4 md:grid-cols-[1fr_1fr_190px]">
          <label>
            Arquivo PDF ou planilha
            <input name="arquivo" type="file" accept="application/pdf,.pdf,.xlsx,.xls,.csv,text/csv" required />
          </label>
          <label>
            Observação
            <input name="observacao" placeholder="Ex.: fichas ou planilha 2026" />
          </label>
          <button className="ds-button ds-button-accent self-end">
            <UploadCloud size={17} />
            Processar arquivo
          </button>
        </form>
      </Panel>

      <section className="grid gap-3">
        {files.length === 0 ? (
          <Panel>
            <div className="flex flex-col items-center justify-center gap-2 py-10 text-ink/40">
              <Inbox size={28} />
              <p className="text-sm font-medium">Nenhum arquivo importado ainda.</p>
            </div>
          </Panel>
        ) : null}
        {files.map((file) => (
          <Panel key={file.id} className="grid gap-4 lg:grid-cols-[1fr_220px_270px] lg:items-center">
            <div>
              <h2 className="font-black text-ink">{file.nome_arquivo}</h2>
              <p className="mt-1 text-sm text-ink/65">{file.observacao || file.storage_path}</p>
              <p className="mt-1 text-xs font-medium text-ink/50">{dateText(file.created_at)}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <ButtonLink href={`/importacoes/${file.id}`} variant="primary">Revisar lote</ButtonLink>
                {file.signed_url ? (
                  <a href={file.signed_url} target="_blank" className="ds-button ds-button-secondary">
                    <ExternalLink size={14} /> Abrir arquivo
                  </a>
                ) : null}
              </div>
            </div>
            <div className="grid gap-2 self-center text-sm">
              <Badge tone={tone(file.status)}>{file.status}</Badge>
              <span className="text-muted">
                {file.total_linhas} linhas / {file.prontas} prontas / {file.importadas} importadas
              </span>
              {file.pendentes || file.duplicadas || file.erros ? (
                <span className="text-xs font-bold text-clay">
                  {file.pendentes} pendentes / {file.duplicadas} duplicadas / {file.erros} erros
                </span>
              ) : null}
            </div>
            <form action={markImportProcessedAction} className="grid grid-cols-[1fr_90px] gap-2 self-center">
              <input type="hidden" name="id" value={file.id} />
              <select name="status" defaultValue={file.status}>
                <option value="pendente">Pendente</option>
                <option value="processado">Processado</option>
                <option value="erro">Erro</option>
              </select>
              <button className="ds-button ds-button-primary min-h-0 px-3 py-2 text-xs">Salvar</button>
            </form>
          </Panel>
        ))}
      </section>
    </div>
  );
}
