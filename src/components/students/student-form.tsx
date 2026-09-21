import { Panel } from "@/components/ui/card";
import { createStudentAction } from "@/lib/actions/students";
import { SubmitButton } from "@/components/ui/submit-button";

type Options = {
  series: Array<{ id: string; nome: string }>;
  turmas: Array<{ id: string; nome: string; ano_letivo: number; serie_id: string }>;
  planos: Array<{ id: string; nome: string }>;
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Panel className="grid gap-4">
      <h2 className="font-display text-2xl text-ink">{title}</h2>
      {children}
    </Panel>
  );
}

export function StudentForm({ options }: { options: Options }) {
  return (
    <form action={createStudentAction} className="grid gap-5">
      <Section title="Ficha do Aluno - Dados do Aluno">
        <div className="grid gap-4 md:grid-cols-4">
          <label>Matrícula<input name="matricula_codigo" required /></label>
          <label className="md:col-span-2">Nome<input name="nome" required /></label>
          <label>Sexo<select name="sexo"><option>Feminino</option><option>Masculino</option><option>Outro</option></select></label>
          <label>Dt. Nascimento<input name="data_nascimento" type="date" /></label>
          <label>Naturalidade<input name="naturalidade" /></label>
          <label>Celular<input name="celular" /></label>
          <label>Foto URL<input name="foto_url" /></label>
          <label>CPF<input name="cpf" /></label>
          <label>RG<input name="rg" /></label>
          <label>Cod. INEP<input name="codigo_inep" /></label>
          <label>Etnia<input name="etnia" /></label>
          <label>Livro<input name="certidao_livro" /></label>
          <label>Folha<input name="certidao_folha" /></label>
          <label>No.<input name="certidao_numero" /></label>
          <label>Cartório<input name="certidao_cartorio" /></label>
          <label className="md:col-span-2">E-mail<input name="email" type="email" /></label>
          <label className="md:col-span-2">Disciplina eletiva<input name="disciplina_eletiva" /></label>
          <label className="md:col-span-2">Informações adicionais<input name="informacoes_adicionais" /></label>
        </div>
      </Section>

      <Section title="Endereço">
        <div className="grid gap-4 md:grid-cols-6">
          <label className="md:col-span-4">Endereço<input name="logradouro" /></label>
          <label>Número<input name="numero" /></label>
          <label>CEP<input name="cep" /></label>
          <label className="md:col-span-2">Bairro<input name="bairro" /></label>
          <label className="md:col-span-2">Cidade<input name="cidade" /></label>
          <label>UF<input name="uf" maxLength={2} /></label>
          <label>Complemento<input name="complemento" /></label>
        </div>
      </Section>

      <Section title="Telefones de Contato">
        <div className="grid gap-4 md:grid-cols-4">
          <label>Nome<input name="contato_nome" /></label>
          <label>Telefone<input name="contato_telefone" /></label>
          <label>Celular<input name="contato_celular" /></label>
          <label>Parentesco<input name="contato_parentesco" /></label>
        </div>
      </Section>

      <Section title="Responsáveis do Aluno">
        <div className="grid gap-4 md:grid-cols-6">
          <label className="md:col-span-2">Nome<input name="responsavel_nome" /></label>
          <label>CPF<input name="responsavel_cpf" /></label>
          <label>Telefone<input name="responsavel_telefone" /></label>
          <label>Celular<input name="responsavel_celular" /></label>
          <label>Parentesco<input name="responsavel_parentesco" /></label>
          <label className="md:col-span-3">E-mail<input name="responsavel_email" type="email" /></label>
        </div>
      </Section>

      <Section title="Relação de Matrículas">
        <div className="grid gap-4 md:grid-cols-6">
          <label>Série<select name="serie_id"><option value="">Selecione</option>{options.series.map((item) => <option key={item.id} value={item.id}>{item.nome}</option>)}</select></label>
          <label>Turma<select name="turma_id"><option value="">Selecione</option>{options.turmas.map((item) => <option key={item.id} value={item.id}>{item.nome} - {item.ano_letivo}</option>)}</select></label>
          <label>Plano<select name="plano_id"><option value="">Selecione</option>{options.planos.map((item) => <option key={item.id} value={item.id}>{item.nome}</option>)}</select></label>
          <label>Data Matrícula<input name="data_matricula" type="date" /></label>
          <label>Idade<input name="idade_na_matricula" type="number" /></label>
          <label>Ano letivo<input name="ano_letivo" type="number" defaultValue={new Date().getFullYear()} /></label>
          <label>Tipo de vaga
            <select name="tipo_vaga" defaultValue="paga">
              <option value="paga">Paga</option>
              <option value="bolsa_integral">Bolsa integral</option>
              <option value="bolsa_parcial">Bolsa parcial</option>
              <option value="permuta">Permuta</option>
              <option value="gratuita">Gratuidade</option>
            </select>
          </label>
          <label>% Bolsa parcial
            <input
              name="percentual_bolsa"
              type="number"
              min={0}
              max={100}
              step={1}
              defaultValue={0}
              placeholder="0-100"
            />
          </label>
        </div>
        <p className="text-xs text-ink/60">
          % Bolsa parcial só é considerado quando o tipo é &quot;Bolsa parcial&quot;. Para outros tipos, deixe em 0.
        </p>
      </Section>

      <Section title="Informacoes Medicas">
        <div className="grid gap-3 md:grid-cols-5">
          {[
            ["alergia", "Alergia"],
            ["necessidade_especial", "Nec. especiais"],
            ["necessita_apoio", "Nec. apoio"],
            ["doenca_grave", "Doenca grave"],
            ["remedio_especial", "Remedio especial"]
          ].map(([name, label]) => (
            <label key={name} className="flex grid-cols-none items-center gap-2 rounded-ui border border-line bg-surface px-3 py-2 text-xs font-extrabold uppercase text-muted">
              <input name={name} type="checkbox" className="h-4 w-4" />
              {label}
            </label>
          ))}
        </div>
        <div className="grid gap-4 md:grid-cols-5">
          <label>Tipo sanguineo<input name="tipo_sanguineo" /></label>
          <label>Medico<input name="medico" /></label>
          <label>Telefone medico<input name="telefone_medico" /></label>
          <label>Plano de saude<input name="plano_saude" /></label>
          <label>Telefone plano<input name="telefone_plano" /></label>
        </div>
      </Section>

      <Section title="Autorizacoes do Aluno">
        <div className="grid gap-3">
          <label className="flex grid-cols-none items-center gap-3 rounded-ui border border-line bg-surface px-4 py-3 text-sm font-semibold text-ink"><input name="nao_entregar_boletim" type="checkbox" className="h-4 w-4" /> Na entrega do boletim, assinar o canhoto</label>
          <label className="flex grid-cols-none items-center gap-3 rounded-ui border border-line bg-surface px-4 py-3 text-sm font-semibold text-ink"><input name="assinar_comunicados" type="checkbox" className="h-4 w-4" /> Assinar todos os comunicados enviados aos pais</label>
          <label className="flex grid-cols-none items-center gap-3 rounded-ui border border-line bg-surface px-4 py-3 text-sm font-semibold text-ink"><input name="requerer_prova_substitutiva" type="checkbox" className="h-4 w-4" /> Requerer prova substitutiva na secretaria</label>
        </div>
      </Section>

      <div className="flex justify-end">
        <SubmitButton variant="accent" className="px-6">Salvar aluno</SubmitButton>
      </div>
    </form>
  );
}
