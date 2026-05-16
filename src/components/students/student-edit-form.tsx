"use client";

import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { Panel } from "@/components/ui/card";
import { updateStudentAction } from "@/lib/actions/students";
import type { StudentSheet } from "@/lib/types";

const TABS = [
  { key: "pessoal",      label: "Pessoal" },
  { key: "endereco",     label: "Endereço" },
  { key: "responsavel",  label: "Responsável" },
  { key: "medico",       label: "Médico" },
  { key: "autorizacoes", label: "Autorizações" },
];

function dateValue(value: string | null) {
  return value ? value.slice(0, 10) : "";
}

function CheckLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="flex items-center gap-3 rounded-ui border border-line bg-surface px-4 py-3 text-sm font-semibold text-ink">
      {children}
    </label>
  );
}

export function StudentEditForm({ student }: { student: StudentSheet }) {
  const endereco    = student.enderecos_aluno[0];
  const contato     = student.contatos_aluno[0];
  const responsavel = student.responsaveis_aluno[0];
  const medica      = student.informacoes_medicas;
  const autorizacoes = student.autorizacoes_aluno;

  const pathname    = usePathname();
  const params      = useSearchParams();
  const router      = useRouter();
  const active      = params.get("ftab") ?? "pessoal";

  function go(key: string) {
    const p = new URLSearchParams(params.toString());
    p.set("ftab", key);
    router.push(`${pathname}?${p.toString()}`);
  }

  return (
    <Panel className="grid gap-0 !p-0 overflow-hidden">
      {/* tab bar */}
      <nav className="flex gap-1 border-b border-line px-5 pt-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => go(t.key)}
            className={[
              "px-4 py-3 text-sm font-black transition",
              active === t.key
                ? "border-b-2 border-brand text-brand"
                : "text-ink/50 hover:text-ink",
            ].join(" ")}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <form action={updateStudentAction} className="grid gap-5 p-5">
        <input type="hidden" name="aluno_id"       value={student.id} />
        <input type="hidden" name="endereco_id"    value={endereco?.id ?? ""} />
        <input type="hidden" name="contato_id"     value={contato?.id ?? ""} />
        <input type="hidden" name="responsavel_id" value={responsavel?.id ?? ""} />

        {/* ── PESSOAL ─────────────────────────────────────────────────── */}
        {active === "pessoal" && (
          <div className="grid gap-4 md:grid-cols-4">
            <label>Matrícula<input name="matricula_codigo" defaultValue={student.matricula_codigo} required /></label>
            <label className="md:col-span-2">Nome<input name="nome" defaultValue={student.nome} required /></label>
            <label>Sexo
              <select name="sexo" defaultValue={student.sexo ?? ""}>
                <option value="">Selecione</option>
                <option>Feminino</option>
                <option>Masculino</option>
                <option>Outro</option>
              </select>
            </label>
            <label>Dt. Nascimento<input name="data_nascimento" type="date" defaultValue={dateValue(student.data_nascimento)} /></label>
            <label>Naturalidade<input name="naturalidade" defaultValue={student.naturalidade ?? ""} /></label>
            <label>Celular<input name="celular" defaultValue={student.celular ?? ""} /></label>
            <label>CPF<input name="cpf" defaultValue={student.cpf ?? ""} /></label>
            <label>RG<input name="rg" defaultValue={student.rg ?? ""} /></label>
            <label>Cód. INEP<input name="codigo_inep" defaultValue={student.codigo_inep ?? ""} /></label>
            <label>Etnia<input name="etnia" defaultValue={student.etnia ?? ""} /></label>
            <label>Livro<input name="certidao_livro" defaultValue={student.certidao_livro ?? ""} /></label>
            <label>Folha<input name="certidao_folha" defaultValue={student.certidao_folha ?? ""} /></label>
            <label>Nº<input name="certidao_numero" defaultValue={student.certidao_numero ?? ""} /></label>
            <label>Cartório<input name="certidao_cartorio" defaultValue={student.certidao_cartorio ?? ""} /></label>
            <label className="md:col-span-2">E-mail<input name="email" type="email" defaultValue={student.email ?? ""} /></label>
            <label className="md:col-span-2">Disciplina eletiva<input name="disciplina_eletiva" defaultValue={student.disciplina_eletiva ?? ""} /></label>
            <label className="md:col-span-4">Informações adicionais<input name="informacoes_adicionais" defaultValue={student.informacoes_adicionais ?? ""} /></label>
          </div>
        )}

        {/* ── ENDEREÇO ────────────────────────────────────────────────── */}
        {active === "endereco" && (
          <div className="grid gap-4 md:grid-cols-6">
            <label className="md:col-span-4">Endereço<input name="logradouro" defaultValue={endereco?.logradouro ?? ""} /></label>
            <label>Número<input name="numero" defaultValue={endereco?.numero ?? ""} /></label>
            <label>CEP<input name="cep" defaultValue={endereco?.cep ?? ""} /></label>
            <label className="md:col-span-2">Bairro<input name="bairro" defaultValue={endereco?.bairro ?? ""} /></label>
            <label className="md:col-span-2">Cidade<input name="cidade" defaultValue={endereco?.cidade ?? ""} /></label>
            <label>UF<input name="uf" maxLength={2} defaultValue={endereco?.uf ?? ""} /></label>
            <label>Complemento<input name="complemento" defaultValue={endereco?.complemento ?? ""} /></label>
          </div>
        )}

        {/* ── RESPONSÁVEL ─────────────────────────────────────────────── */}
        {active === "responsavel" && (
          <div className="grid gap-5">
            <div className="grid gap-4 md:grid-cols-4">
              <p className="ds-kicker md:col-span-4">Contato</p>
              <label>Nome<input name="contato_nome" defaultValue={contato?.nome ?? ""} /></label>
              <label>Telefone<input name="contato_telefone" defaultValue={contato?.telefone ?? ""} /></label>
              <label>Celular<input name="contato_celular" defaultValue={contato?.celular ?? ""} /></label>
              <label>Parentesco<input name="contato_parentesco" defaultValue={contato?.parentesco ?? ""} /></label>
            </div>
            <div className="grid gap-4 md:grid-cols-4">
              <p className="ds-kicker md:col-span-4">Responsável principal</p>
              <label className="md:col-span-2">Nome<input name="responsavel_nome" defaultValue={responsavel?.nome ?? ""} /></label>
              <label>CPF<input name="responsavel_cpf" defaultValue={responsavel?.cpf ?? ""} /></label>
              <label>Parentesco<input name="responsavel_parentesco" defaultValue={responsavel?.parentesco ?? ""} /></label>
              <label>Telefone<input name="responsavel_telefone" defaultValue={responsavel?.telefone ?? ""} /></label>
              <label>Celular<input name="responsavel_celular" defaultValue={responsavel?.celular ?? ""} /></label>
              <label className="md:col-span-2">E-mail<input name="responsavel_email" type="email" defaultValue={responsavel?.email ?? ""} /></label>
            </div>
          </div>
        )}

        {/* ── MÉDICO ──────────────────────────────────────────────────── */}
        {active === "medico" && (
          <div className="grid gap-4">
            <div className="grid gap-3 md:grid-cols-5">
              <CheckLabel><input name="alergia" type="checkbox" className="h-4 w-4" defaultChecked={medica?.alergia ?? false} /> Alergia</CheckLabel>
              <CheckLabel><input name="necessidade_especial" type="checkbox" className="h-4 w-4" defaultChecked={medica?.necessidade_especial ?? false} /> Nec. especiais</CheckLabel>
              <CheckLabel><input name="necessita_apoio" type="checkbox" className="h-4 w-4" defaultChecked={medica?.necessita_apoio ?? false} /> Nec. apoio</CheckLabel>
              <CheckLabel><input name="doenca_grave" type="checkbox" className="h-4 w-4" defaultChecked={medica?.doenca_grave ?? false} /> Doença grave</CheckLabel>
              <CheckLabel><input name="remedio_especial" type="checkbox" className="h-4 w-4" defaultChecked={medica?.remedio_especial ?? false} /> Remédio especial</CheckLabel>
            </div>
            <div className="grid gap-4 md:grid-cols-5">
              <label>Tipo sanguíneo<input name="tipo_sanguineo" defaultValue={medica?.tipo_sanguineo ?? ""} /></label>
              <label>Médico<input name="medico" defaultValue={medica?.medico ?? ""} /></label>
              <label>Telefone médico<input name="telefone_medico" defaultValue={medica?.telefone_medico ?? ""} /></label>
              <label>Plano de saúde<input name="plano_saude" defaultValue={medica?.plano_saude ?? ""} /></label>
              <label>Telefone plano<input name="telefone_plano" defaultValue={medica?.telefone_plano ?? ""} /></label>
            </div>
          </div>
        )}

        {/* ── AUTORIZAÇÕES ────────────────────────────────────────────── */}
        {active === "autorizacoes" && (
          <div className="grid gap-3">
            <CheckLabel><input name="nao_entregar_boletim" type="checkbox" className="h-4 w-4" defaultChecked={autorizacoes?.nao_entregar_boletim ?? false} /> Na entrega do boletim, assinar o canhoto</CheckLabel>
            <CheckLabel><input name="assinar_comunicados" type="checkbox" className="h-4 w-4" defaultChecked={autorizacoes?.assinar_comunicados ?? false} /> Assinar todos os comunicados enviados aos pais</CheckLabel>
            <CheckLabel><input name="requerer_prova_substitutiva" type="checkbox" className="h-4 w-4" defaultChecked={autorizacoes?.requerer_prova_substitutiva ?? false} /> Requerer prova substitutiva na secretaria</CheckLabel>
          </div>
        )}

        <div className="flex justify-end border-t border-line pt-4">
          <button className="ds-button ds-button-accent px-6">Salvar alterações</button>
        </div>
      </form>
    </Panel>
  );
}
