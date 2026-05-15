/* eslint-disable @next/next/no-img-element */
import { CheckSquare, Square } from "lucide-react";
import type { StudentSheet } from "@/lib/types";
import { dateFormat } from "@/lib/constants";

function text(value: unknown) {
  return value ? String(value) : "";
}

function date(value: string | null) {
  return value ? dateFormat.format(new Date(`${value}T00:00:00Z`)) : "";
}

function generatedAt(value: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(value);
}

function CheckBoxItem({ label, checked }: { label: string; checked: boolean }) {
  return (
    <span className="inline-flex items-center gap-1">
      {checked ? <CheckSquare size={14} className="text-ink" /> : <Square size={14} className="text-ink/60" />}
      <span>{label}</span>
    </span>
  );
}

export function StudentSheetView({
  student,
  fotoSrc,
  geradoEm
}: {
  student: StudentSheet;
  fotoSrc?: string | null;
  geradoEm?: Date;
}) {
  const endereco = student.enderecos_aluno[0];
  const medica = student.informacoes_medicas;
  const autorizacoes = student.autorizacoes_aluno;
  const matriculasOrdenadas = [...student.matriculas].sort((a, b) => (b.data_matricula ?? "").localeCompare(a.data_matricula ?? ""));

  return (
    <div className="mx-auto max-w-[900px] bg-white p-4 shadow-soft">
      <header className="mb-3 border-b border-ink/30 pb-2 text-center">
        <p className="text-xs font-bold uppercase tracking-wide text-ink">RRB Escola</p>
        <p className="text-[0.65rem] text-muted">Goiânia / GO · Gerado em {generatedAt(geradoEm ?? new Date())}</p>
        <h1 className="mt-2 text-lg font-black text-ink">Ficha do Aluno</h1>
      </header>

      <table className="sheet-table">
        <tbody>
          <tr>
            <th colSpan={6}>Dados do Aluno</th>
          </tr>
          <tr>
            <td rowSpan={7} className="w-[125px] text-center">
              {fotoSrc ? (
                <img src={fotoSrc} alt={student.nome} width={105} height={135} className="mx-auto object-cover" />
              ) : (
                <div className="mx-auto grid h-[135px] w-[105px] place-items-center border border-black bg-gray-100 text-[9px]">Foto</div>
              )}
            </td>
            <td><span className="sheet-label">Matrícula</span>{student.matricula_codigo}</td>
            <td colSpan={4}><span className="sheet-label">Nome</span>{student.nome}</td>
          </tr>
          <tr>
            <td><span className="sheet-label">Sexo</span>{text(student.sexo)}</td>
            <td><span className="sheet-label">Dt. Nascimento</span>{date(student.data_nascimento)}</td>
            <td colSpan={3}><span className="sheet-label">Celular</span>{text(student.celular)}</td>
          </tr>
          <tr>
            <td><span className="sheet-label">Naturalidade</span>{text(student.naturalidade)}</td>
            <td colSpan={4}></td>
          </tr>
          <tr>
            <td colSpan={5}><span className="sheet-label">Endereço</span>{text(endereco?.logradouro)}</td>
          </tr>
          <tr>
            <td><span className="sheet-label">Cidade</span>{text(endereco?.cidade)}{endereco?.uf ? `-${endereco.uf}` : ""}</td>
            <td><span className="sheet-label">CEP</span>{text(endereco?.cep)}</td>
            <td colSpan={3}></td>
          </tr>
          <tr>
            <td><span className="sheet-label">CPF</span>{text(student.cpf)}</td>
            <td><span className="sheet-label">RG</span>{text(student.rg)}</td>
            <td colSpan={3}></td>
          </tr>
          <tr>
            <td colSpan={2}><span className="sheet-label">Certidão Nasc.</span>Livro: {text(student.certidao_livro)} Folha: {text(student.certidao_folha)} Nº: {text(student.certidao_numero)} Cartório: {text(student.certidao_cartorio)}</td>
            <td colSpan={2}><span className="sheet-label">Disciplina Eletiva</span>{text(student.disciplina_eletiva)}</td>
            <td><span className="sheet-label">Cód. INEP</span>{text(student.codigo_inep)}</td>
          </tr>
          <tr>
            <td colSpan={3}><span className="sheet-label">E-Mail</span>{text(student.email)}</td>
            <td colSpan={3}><span className="sheet-label">Etnia</span>{text(student.etnia)}</td>
          </tr>
          <tr>
            <td colSpan={6}><span className="sheet-label">Informações Adicionais</span>{text(student.informacoes_adicionais)}</td>
          </tr>
        </tbody>
      </table>

      <div className="h-3" />

      <table className="sheet-table">
        <tbody>
          <tr><th colSpan={3}>Telefones de Contato</th></tr>
          {student.contatos_aluno.length === 0 ? (
            <tr><td colSpan={3} className="text-muted">—</td></tr>
          ) : student.contatos_aluno.map((item) => (
            <tr key={item.id}>
              <td>{item.nome}</td>
              <td>{text(item.celular || item.telefone)}</td>
              <td>{text(item.parentesco)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="h-3" />

      <table className="sheet-table">
        <thead>
          <tr><th colSpan={6}>Responsáveis do Aluno</th></tr>
          <tr><th>Nome</th><th>CPF</th><th>Telefone</th><th>Celular</th><th>Parentesco</th><th>E-Mail</th></tr>
        </thead>
        <tbody>
          {student.responsaveis_aluno.length === 0 ? (
            <tr><td colSpan={6} className="text-muted">—</td></tr>
          ) : student.responsaveis_aluno.map((item) => (
            <tr key={item.id}>
              <td>{item.nome}</td>
              <td>{text(item.cpf)}</td>
              <td>{text(item.telefone)}</td>
              <td>{text(item.celular)}</td>
              <td>{text(item.parentesco)}</td>
              <td>{text(item.email)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="h-3" />

      <table className="sheet-table">
        <thead>
          <tr><th colSpan={6}>Relação de Matrículas</th></tr>
          <tr><th>Ano</th><th>Série</th><th>Turma</th><th>Data Matrícula</th><th>Idade na Matrícula</th><th>Status</th></tr>
        </thead>
        <tbody>
          {matriculasOrdenadas.length === 0 ? (
            <tr><td colSpan={6} className="text-muted">—</td></tr>
          ) : matriculasOrdenadas.map((item) => (
            <tr key={item.id}>
              <td className="text-center">{text(item.ano_letivo)}</td>
              <td>{text(item.series?.nome)}</td>
              <td className="text-center">{text(item.turmas?.nome)}</td>
              <td className="text-center">{date(item.data_matricula)}</td>
              <td className="text-center">{text(item.idade_na_matricula)}</td>
              <td className="text-center">{text(item.status)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="h-3" />

      <table className="sheet-table">
        <thead>
          <tr><th colSpan={3}>Pessoas Autorizadas a Buscar o Aluno</th></tr>
          <tr><th>Nome</th><th>Telefone</th><th>Obs</th></tr>
        </thead>
        <tbody>
          {student.pessoas_autorizadas.length === 0 ? (
            <tr><td colSpan={3} className="text-muted">—</td></tr>
          ) : student.pessoas_autorizadas.map((item) => (
            <tr key={item.id}>
              <td>{item.nome}</td>
              <td>{text(item.telefone)}</td>
              <td>{text(item.observacao)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="h-3" />

      <table className="sheet-table">
        <tbody>
          <tr><th colSpan={4}>Informações Médicas</th></tr>
          <tr>
            <td colSpan={4}>
              <div className="grid grid-cols-2 gap-1 md:grid-cols-4">
                <CheckBoxItem label="Alergia" checked={medica?.alergia ?? false} />
                <CheckBoxItem label="Portador Nec. Especiais" checked={medica?.necessidade_especial ?? false} />
                <CheckBoxItem label="Nec. Apoio/Recurso" checked={medica?.necessita_apoio ?? false} />
                <CheckBoxItem label="Possui Doença Grave" checked={medica?.doenca_grave ?? false} />
              </div>
              <div className="mt-1 grid grid-cols-2 gap-1">
                <CheckBoxItem label="Algum Remédio Especial" checked={medica?.remedio_especial ?? false} />
                <span>Tipo Sanguíneo: {text(medica?.tipo_sanguineo)}</span>
              </div>
            </td>
          </tr>
          <tr>
            <td><span className="sheet-label">Médico</span>{text(medica?.medico)}</td>
            <td><span className="sheet-label">Telefone</span>{text(medica?.telefone_medico)}</td>
            <td><span className="sheet-label">Plano de Saúde</span>{text(medica?.plano_saude)}</td>
            <td><span className="sheet-label">Telefone Plano</span>{text(medica?.telefone_plano)}</td>
          </tr>
        </tbody>
      </table>

      <div className="h-3" />

      <table className="sheet-table">
        <tbody>
          <tr><th>Autorizações do Aluno</th></tr>
          <tr><td><strong>O aluno está autorizado a:</strong></td></tr>
          <tr><td><CheckBoxItem label="Na entrega do boletim, a assinar o canhoto" checked={autorizacoes?.nao_entregar_boletim ?? false} /></td></tr>
          <tr><td><CheckBoxItem label="Assinar todos os comunicados enviados aos pais" checked={autorizacoes?.assinar_comunicados ?? false} /></td></tr>
          <tr><td><CheckBoxItem label="Quando necessário, requerer prova substitutiva na secretaria" checked={autorizacoes?.requerer_prova_substitutiva ?? false} /></td></tr>
        </tbody>
      </table>
    </div>
  );
}
