/* eslint-disable @next/next/no-img-element */
import type { StudentSheet } from "@/lib/types";
import { dateFormat } from "@/lib/constants";

function text(value: unknown) {
  return value ? String(value) : "";
}

function date(value: string | null) {
  return value ? dateFormat.format(new Date(`${value}T00:00:00Z`)) : "";
}

export function StudentSheetView({ student }: { student: StudentSheet }) {
  const endereco = student.enderecos_aluno[0];
  const medica = student.informacoes_medicas;
  const autorizacoes = student.autorizacoes_aluno;

  return (
    <div className="mx-auto max-w-[900px] bg-white p-4 shadow-soft">
      <h1 className="mb-1 text-center font-sans text-xl font-black text-black">Ficha do Aluno</h1>

      <table className="sheet-table">
        <tbody>
          <tr>
            <th colSpan={6}>Dados do Aluno</th>
          </tr>
          <tr>
            <td rowSpan={7} className="w-[125px] text-center">
              {student.foto_url ? (
                <img src={student.foto_url} alt={student.nome} width={105} height={135} className="mx-auto object-cover" />
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
            <td colSpan={2}><span className="sheet-label">Disciplina Eletiva</span></td>
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

      <div className="h-4" />

      <table className="sheet-table">
        <tbody>
          <tr><th colSpan={3}>Telefones de Contato</th></tr>
          {student.contatos_aluno.map((item) => (
            <tr key={item.nome}>
              <td>{item.nome}</td>
              <td>{text(item.celular || item.telefone)}</td>
              <td>{text(item.parentesco)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="h-4" />

      <table className="sheet-table">
        <thead>
          <tr><th colSpan={6}>Responsáveis do Aluno</th></tr>
          <tr><th>Nome</th><th>CPF</th><th>Telefone</th><th>Celular</th><th>Parentesco</th><th>E-Mail</th></tr>
        </thead>
        <tbody>
          {student.responsaveis_aluno.map((item) => (
            <tr key={item.nome}>
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

      <div className="h-4" />

      <table className="sheet-table">
        <thead>
          <tr><th colSpan={4}>Relação de Matrículas</th></tr>
          <tr><th>Série</th><th>Turma</th><th>Data Matrícula</th><th>Idade na Matrícula</th></tr>
        </thead>
        <tbody>
          {student.matriculas.map((item) => (
            <tr key={`${item.series?.nome}-${item.data_matricula}`}>
              <td>{text(item.series?.nome)}</td>
              <td className="text-center">{text(item.turmas?.nome)}</td>
              <td className="text-center">{date(item.data_matricula)}</td>
              <td className="text-center">{text(item.idade_na_matricula)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <table className="sheet-table">
        <thead>
          <tr><th colSpan={6}>Historico Completo de Matriculas</th></tr>
          <tr><th>Codigo</th><th>Ano</th><th>Serie</th><th>Turma</th><th>Plano</th><th>Status</th></tr>
        </thead>
        <tbody>
          {student.matriculas.map((item) => (
            <tr key={`hist-${item.id}`}>
              <td>{text(item.codigo)}</td>
              <td className="text-center">{text(item.ano_letivo)}</td>
              <td>{text(item.series?.nome)}</td>
              <td className="text-center">{text(item.turmas?.nome)}</td>
              <td>{text(item.planos?.nome)}</td>
              <td className="text-center">{text(item.status)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="h-4" />

      <table className="sheet-table">
        <tbody>
          <tr><th>Atributos Adicionais</th></tr>
        </tbody>
      </table>

      <div className="h-3" />

      <table className="sheet-table">
        <thead>
          <tr><th colSpan={3}>Pessoas Autorizadas a Buscar o Aluno</th></tr>
          <tr><th>Nome</th><th>Telefone</th><th>Obs</th></tr>
        </thead>
        <tbody>
          {student.pessoas_autorizadas.map((item) => (
            <tr key={item.nome}>
              <td>{item.nome}</td>
              <td>{text(item.telefone)}</td>
              <td>{text(item.observacao)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <table className="sheet-table">
        <tbody>
          <tr><th colSpan={4}>Informações Médicas</th></tr>
          <tr>
            <td colSpan={4}>
              Alergia: {medica?.alergia ? "( X )" : "(  )"}<br />
              Portador Nec. Especiais: {medica?.necessidade_especial ? "( X )" : "(  )"}<br />
              Nec. Apoio/Recurso: {medica?.necessita_apoio ? "( X )" : "(  )"}<br />
              Possui Doença Grave: {medica?.doenca_grave ? "( X )" : "(  )"}<br />
              Algum Remédio Especial: {medica?.remedio_especial ? "( X )" : "(  )"}<br />
              Tipo Sanguíneo: {text(medica?.tipo_sanguineo)}
            </td>
          </tr>
          <tr>
            <td><span className="sheet-label">Médico</span>{text(medica?.medico)}</td>
            <td><span className="sheet-label">Telefone</span>{text(medica?.telefone_medico)}</td>
            <td><span className="sheet-label">Plano de Saúde</span>{text(medica?.plano_saude)}</td>
            <td><span className="sheet-label">Telefone</span>{text(medica?.telefone_plano)}</td>
          </tr>
        </tbody>
      </table>

      <div className="h-4" />

      <table className="sheet-table">
        <tbody>
          <tr><th>Autorizações do Aluno</th></tr>
          <tr><td><strong>O aluno está autorizado a:</strong></td></tr>
          <tr><td>{autorizacoes?.nao_entregar_boletim ? "( X )" : "(  )"} Na entrega do boletim, a assinar o canhoto</td></tr>
          <tr><td>{autorizacoes?.assinar_comunicados ? "( X )" : "(  )"} Assinar todos os comunicados enviados aos pais</td></tr>
          <tr><td>{autorizacoes?.requerer_prova_substitutiva ? "( X )" : "(  )"} Quando necessário, requerer prova substitutiva na secretaria</td></tr>
        </tbody>
      </table>
    </div>
  );
}
