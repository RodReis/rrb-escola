import Link from "next/link";
import { CheckCircle2, ExternalLink, Save } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card, Panel } from "@/components/ui/card";
import { processImportStudentBatchAction, updateImportStudentRowAction } from "@/lib/actions/imports";
import { getImportDetail } from "@/lib/data/imports";

function tone(status: string): "green" | "red" | "gold" | "gray" {
  if (status === "pronto" || status === "importado" || status === "processado") return "green";
  if (status === "erro") return "red";
  if (status === "duplicado" || status === "pendente") return "gold";
  return "gray";
}

function dateText(value: string) {
  return new Date(value).toLocaleString("pt-BR");
}

export default async function ImportDetailPage({ params }: { params: { id: string } }) {
  const { file, rows } = await getImportDetail(params.id);
  const summary = [
    ["Linhas", String(file.total_linhas)],
    ["Prontas", String(file.prontas)],
    ["Pendentes", String(file.pendentes)],
    ["Importadas", String(file.importadas)]
  ];

  return (
    <div className="grid gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-line bg-paper px-6 py-7">
        <div>
          <p className="ds-kicker">Importacoes / Revisao</p>
          <h1 className="mt-7 font-serif text-4xl text-ink">{file.nome_arquivo}</h1>
          <p className="mt-3 max-w-3xl text-sm text-muted">
            Revise as linhas extraidas antes de gravar alunos, responsaveis e matriculas no Supabase local.
            Enviado em {dateText(file.created_at)}.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Badge tone={tone(file.status)}>{file.status}</Badge>
            {file.signed_url ? (
              <a href={file.signed_url} target="_blank" className="inline-flex items-center gap-1 text-sm font-bold text-brand">
                <ExternalLink size={14} /> Abrir arquivo original
              </a>
            ) : null}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <ButtonLink href="/importacoes" variant="secondary">Voltar</ButtonLink>
          <form action={processImportStudentBatchAction}>
            <input type="hidden" name="arquivo_id" value={file.id} />
            <Button variant="accent">
              <CheckCircle2 size={16} />
              Confirmar linhas prontas
            </Button>
          </form>
        </div>
      </header>

      <section className="grid gap-4 md:grid-cols-4">
        {summary.map(([label, value]) => (
          <Card key={label}>
            <p className="ds-kicker">{label}</p>
            <strong className="mt-3 block text-3xl text-ink">{value}</strong>
          </Card>
        ))}
      </section>

      <section className="grid gap-4">
        {rows.length === 0 ? (
          <Panel>
            <p className="text-sm text-muted">Nenhuma linha foi extraida deste arquivo.</p>
          </Panel>
        ) : null}

        {rows.map((row) => {
          const data = row.dados;
          return (
            <Panel key={row.id} className="grid gap-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="ds-kicker">Linha {row.linha}</p>
                  <h2 className="mt-1 font-serif text-2xl text-ink">{data.nome || "Aluno sem nome"}</h2>
                  <p className="mt-1 text-sm text-muted">Matricula {data.matricula_codigo || "nao informada"}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={tone(row.status)}>{row.status}</Badge>
                  {row.aluno_id ? (
                    <Link href={`/alunos/${row.aluno_id}`} className="text-sm font-bold text-brand">
                      Ver aluno
                    </Link>
                  ) : null}
                </div>
              </div>

              {row.erros.length ? (
                <div className="rounded-ui border border-clay/30 bg-clay/10 p-3 text-sm font-semibold text-clay">
                  {row.erros.join(" ")}
                </div>
              ) : null}

              <form action={updateImportStudentRowAction} className="grid gap-4">
                <input type="hidden" name="id" value={row.id} />
                <input type="hidden" name="arquivo_id" value={file.id} />

                <div className="grid gap-4 md:grid-cols-4">
                  <label>Matricula<input name="matricula_codigo" defaultValue={data.matricula_codigo} required /></label>
                  <label className="md:col-span-2">Nome<input name="nome" defaultValue={data.nome} required /></label>
                  <label>Sexo<input name="sexo" defaultValue={data.sexo ?? ""} /></label>
                  <label>Nascimento<input name="data_nascimento" type="date" defaultValue={data.data_nascimento ?? ""} /></label>
                  <label>CPF<input name="cpf" defaultValue={data.cpf ?? ""} /></label>
                  <label>RG<input name="rg" defaultValue={data.rg ?? ""} /></label>
                  <label>Celular<input name="celular" defaultValue={data.celular ?? ""} /></label>
                  <label className="md:col-span-2">E-mail<input name="email" type="email" defaultValue={data.email ?? ""} /></label>
                </div>

                <div className="grid gap-4 md:grid-cols-6">
                  <label className="md:col-span-3">Endereco<input name="logradouro" defaultValue={data.logradouro ?? ""} /></label>
                  <label>Numero<input name="numero" defaultValue={data.numero ?? ""} /></label>
                  <label>Bairro<input name="bairro" defaultValue={data.bairro ?? ""} /></label>
                  <label>CEP<input name="cep" defaultValue={data.cep ?? ""} /></label>
                  <label className="md:col-span-2">Cidade<input name="cidade" defaultValue={data.cidade ?? ""} /></label>
                  <label>UF<input name="uf" defaultValue={data.uf ?? ""} maxLength={2} /></label>
                </div>

                <div className="grid gap-4 md:grid-cols-6">
                  <label className="md:col-span-2">Responsavel<input name="responsavel_nome" defaultValue={data.responsavel_nome ?? ""} /></label>
                  <label>CPF responsavel<input name="responsavel_cpf" defaultValue={data.responsavel_cpf ?? ""} /></label>
                  <label>Telefone<input name="responsavel_telefone" defaultValue={data.responsavel_telefone ?? ""} /></label>
                  <label>Celular<input name="responsavel_celular" defaultValue={data.responsavel_celular ?? ""} /></label>
                  <label>Parentesco<input name="responsavel_parentesco" defaultValue={data.responsavel_parentesco ?? ""} /></label>
                  <label className="md:col-span-2">E-mail responsavel<input name="responsavel_email" type="email" defaultValue={data.responsavel_email ?? ""} /></label>
                </div>

                <div className="grid gap-4 md:grid-cols-6">
                  <label>Serie<input name="serie" defaultValue={data.serie ?? ""} required /></label>
                  <label>Turma<input name="turma" defaultValue={data.turma ?? ""} required /></label>
                  <label>Plano<input name="plano" defaultValue={data.plano ?? ""} /></label>
                  <label>Ano letivo<input name="ano_letivo" type="number" defaultValue={data.ano_letivo ?? new Date().getFullYear()} /></label>
                  <label>Data matricula<input name="data_matricula" type="date" defaultValue={data.data_matricula ?? ""} /></label>
                  <label>Idade<input name="idade_na_matricula" type="number" defaultValue={data.idade_na_matricula ?? ""} /></label>
                </div>

                <Button className="justify-self-start" variant="primary">
                  <Save size={16} />
                  Salvar e validar linha
                </Button>
              </form>
            </Panel>
          );
        })}
      </section>
    </div>
  );
}
