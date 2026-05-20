import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/card";
import {
  addStudentAddressAction,
  addStudentAuthorizedPersonAction,
  addStudentContactAction,
  addStudentGuardianAction,
  removeStudentRelatedRecordAction
} from "@/lib/actions/students";
import type { StudentSheet } from "@/lib/types";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Panel className="grid gap-4">
      <h2 className="font-serif text-2xl text-ink">{title}</h2>
      {children}
    </Panel>
  );
}

function RemoveButton({ alunoId, table, id }: { alunoId: string; table: string; id: string }) {
  return (
    <form action={removeStudentRelatedRecordAction}>
      <input type="hidden" name="aluno_id" value={alunoId} />
      <input type="hidden" name="table" value={table} />
      <input type="hidden" name="id" value={id} />
      <button className="text-xs font-bold text-clay">Remover</button>
    </form>
  );
}

export function StudentRelatedPanel({ student }: { student: StudentSheet }) {
  return (
    <div className="grid gap-5">
      <Section title="Enderecos do Aluno">
        <div className="grid gap-2">
          {student.enderecos_aluno.map((item) => (
            <div key={item.id} className="grid gap-2 border-b border-line py-3 md:grid-cols-[1fr_110px]">
              <p className="text-sm">
                <strong>{item.logradouro}</strong>
                <span className="block text-muted">
                  {item.numero || "s/n"} / {item.bairro || "sem bairro"} / {item.cidade || "sem cidade"}-{item.uf || ""}
                </span>
              </p>
              <RemoveButton alunoId={student.id} table="enderecos_aluno" id={item.id} />
            </div>
          ))}
        </div>
        <form action={addStudentAddressAction} className="grid gap-3 md:grid-cols-6">
          <input type="hidden" name="aluno_id" value={student.id} />
          <label className="md:col-span-3">Endereco<input name="logradouro" required /></label>
          <label>Numero<input name="numero" /></label>
          <label>Bairro<input name="bairro" /></label>
          <label>CEP<input name="cep" /></label>
          <label className="md:col-span-2">Cidade<input name="cidade" /></label>
          <label>UF<input name="uf" maxLength={2} /></label>
          <label className="md:col-span-2">Complemento<input name="complemento" /></label>
          <Button className="self-end" variant="accent">Adicionar endereco</Button>
        </form>
      </Section>

      <Section title="Telefones de Contato">
        <div className="grid gap-2">
          {student.contatos_aluno.map((item) => (
            <div key={item.id} className="grid gap-2 border-b border-line py-3 md:grid-cols-[1fr_110px]">
              <p className="text-sm">
                <strong>{item.nome}</strong>
                <span className="block text-muted">
                  {item.telefone || item.celular || "sem telefone"} / {item.parentesco || "sem parentesco"}
                </span>
              </p>
              <RemoveButton alunoId={student.id} table="contatos_aluno" id={item.id} />
            </div>
          ))}
        </div>
        <form action={addStudentContactAction} className="grid gap-3 md:grid-cols-5">
          <input type="hidden" name="aluno_id" value={student.id} />
          <label>Nome<input name="nome" required /></label>
          <label>Telefone<input name="telefone" /></label>
          <label>Celular<input name="celular" /></label>
          <label>Parentesco<input name="parentesco" /></label>
          <label>Observação<input name="observacao" /></label>
          <Button className="self-end" variant="accent">Adicionar contato</Button>
        </form>
      </Section>

      <Section title="Responsáveis do Aluno">
        <div className="grid gap-2">
          {student.responsaveis_aluno.map((item) => (
            <div key={item.id} className="grid gap-2 border-b border-line py-3 md:grid-cols-[1fr_110px]">
              <p className="text-sm">
                <strong>{item.nome}</strong>
                <span className="block text-muted">
                  {item.parentesco || "sem parentesco"} / {item.cpf || "sem CPF"} / {item.email || "sem e-mail"}
                </span>
              </p>
              <RemoveButton alunoId={student.id} table="responsaveis_aluno" id={item.id} />
            </div>
          ))}
        </div>
        <form action={addStudentGuardianAction} className="grid gap-3 md:grid-cols-6">
          <input type="hidden" name="aluno_id" value={student.id} />
          <label className="md:col-span-2">Nome<input name="nome" required /></label>
          <label>CPF<input name="cpf" /></label>
          <label>Telefone<input name="telefone" /></label>
          <label>Celular<input name="celular" /></label>
          <label>Parentesco<input name="parentesco" /></label>
          <label className="md:col-span-2">E-mail<input name="email" type="email" /></label>
          <label className="flex grid-cols-none items-center gap-2 self-end pb-3">
            <input name="responsavel_financeiro" type="checkbox" className="h-4 w-4" />
            Financeiro
          </label>
          <label className="flex grid-cols-none items-center gap-2 self-end pb-3">
            <input name="responsavel_pedagogico" type="checkbox" className="h-4 w-4" />
            Pedagógico
          </label>
          <Button className="self-end" variant="accent">Adicionar responsável</Button>
        </form>
      </Section>

      <Section title="Pessoas Autorizadas a Buscar o Aluno">
        <div className="grid gap-2">
          {student.pessoas_autorizadas.map((item) => (
            <div key={item.id} className="grid gap-2 border-b border-line py-3 md:grid-cols-[1fr_110px]">
              <p className="text-sm">
                <strong>{item.nome}</strong>
                <span className="block text-muted">
                  {item.telefone || "sem telefone"} / {item.observacao || "sem observação"}
                </span>
              </p>
              <RemoveButton alunoId={student.id} table="pessoas_autorizadas" id={item.id} />
            </div>
          ))}
        </div>
        <form action={addStudentAuthorizedPersonAction} className="grid gap-3 md:grid-cols-5">
          <input type="hidden" name="aluno_id" value={student.id} />
          <label>Nome<input name="nome" required /></label>
          <label>Telefone<input name="telefone" /></label>
          <label>Documento<input name="documento" /></label>
          <label>Observação<input name="observacao" /></label>
          <Button className="self-end" variant="accent">Adicionar pessoa</Button>
        </form>
      </Section>
    </div>
  );
}
