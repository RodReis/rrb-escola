"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Tabs } from "@/components/ui/tabs";
import { maskCNPJ, maskPhone } from "@/lib/format/masks";
import { uploadCompanyLogoAction, removeCompanyLogoAction } from "@/lib/actions/rh";
import { companyLogoUrl } from "@/lib/storage/company-logo-url";
import type { Company } from "@/lib/data/rh";

type Props = {
  action: (formData: FormData) => void | Promise<void>;
  company?: Company;
  submitLabel?: string;
};

function LogoUploader({ company }: { company: Company }) {
  const logoUrl = companyLogoUrl(company.logo_path);

  return (
    <div className="flex items-center gap-4">
      <div className="flex h-20 w-32 items-center justify-center overflow-hidden rounded-ui border border-line bg-muted">
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoUrl} alt={`Logo de ${company.name}`} className="h-full w-full object-contain" />
        ) : (
          <span className="text-xs text-ink/50">Sem logo</span>
        )}
      </div>
      <div className="flex flex-col gap-2">
        <form action={uploadCompanyLogoAction}>
          <input type="hidden" name="id" value={company.id} />
          <label className="ds-button ds-button-secondary cursor-pointer text-xs">
            Atualizar foto
            <input
              type="file"
              name="logo"
              accept="image/png,image/jpeg,image/webp"
              className="sr-only"
              onChange={(e) => e.target.form?.requestSubmit()}
            />
          </label>
        </form>
        {company.logo_path ? (
          <form action={removeCompanyLogoAction}>
            <input type="hidden" name="id" value={company.id} />
            <Button type="submit" variant="ghost" className="text-xs">
              Remover imagem
            </Button>
          </form>
        ) : null}
      </div>
    </div>
  );
}

export function CompanyForm({ action, company, submitLabel = "Salvar" }: Props) {
  const [cnpj, setCnpj] = useState(maskCNPJ(company?.cnpj ?? ""));
  const [telefones, setTelefones] = useState(maskPhone(company?.telefones ?? ""));

  return (
    <div className="grid gap-6">
      {/* Fora do <form> principal: LogoUploader tem seus próprios <form>s
          (upload e remove) e HTML não permite <form> aninhado — isso causava
          hydration mismatch quando ficava dentro do form de dados gerais. */}
      {company ? <LogoUploader company={company} /> : null}

      <form action={action} className="grid gap-6">
      {company ? <input type="hidden" name="id" value={company.id} /> : null}

      <div className="grid gap-4 md:grid-cols-2">
        <label className="md:col-span-2">
          Razão social
          <input
            name="name"
            defaultValue={company?.name ?? ""}
            required
            minLength={3}
            placeholder="Ex.: Escola RRB Educação Ltda."
          />
        </label>

        <label>
          Nome fantasia
          <input name="nomeFantasia" defaultValue={company?.nome_fantasia ?? ""} />
        </label>

        <label>
          CNPJ
          <input
            name="cnpj"
            value={cnpj}
            onChange={(e) => setCnpj(maskCNPJ(e.target.value))}
            required
            placeholder="00.000.000/0000-00"
          />
        </label>

        {company ? (
          <label className="flex grid-cols-none items-center gap-2 self-end pb-3">
            <input name="ativo" type="checkbox" defaultChecked={company.ativo} className="h-4 w-4" />
            Ativa
          </label>
        ) : null}
      </div>

      {company ? (
        <Tabs
          defaultValue="endereco"
          items={[
            {
              value: "endereco",
              label: "Endereço",
              content: (
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="md:col-span-2">
                    Logradouro
                    <input name="endereco" defaultValue={company.endereco ?? ""} placeholder="Rua, Avenida..." />
                  </label>
                  <label>
                    Número
                    <input name="numero" defaultValue={company.numero ?? ""} />
                  </label>
                  <label>
                    Complemento
                    <input name="complemento" defaultValue={company.complemento ?? ""} placeholder="Q 24, L 17" />
                  </label>
                  <label>
                    Bairro
                    <input name="bairro" defaultValue={company.bairro ?? ""} />
                  </label>
                  <label>
                    Cidade
                    <input name="cidade" defaultValue={company.cidade ?? ""} />
                  </label>
                  <label>
                    UF
                    <input name="uf" maxLength={2} defaultValue={company.uf ?? ""} />
                  </label>
                  <label>
                    CEP
                    <input name="cep" defaultValue={company.cep ?? ""} placeholder="00000-000" />
                  </label>
                </div>
              )
            },
            {
              value: "assinaturas",
              label: "Assinaturas",
              content: (
                <div className="grid gap-4 md:grid-cols-2">
                  <label>
                    Nome do(a) secretário(a)
                    <input name="secretarioNome" defaultValue={company.secretario_nome ?? ""} />
                  </label>
                  <label>
                    Cargo do(a) secretário(a)
                    <input name="secretarioCargo" defaultValue={company.secretario_cargo ?? "Secretário(a)"} />
                  </label>

                  <label>
                    Nome do(a) diretor(a)
                    <input name="diretorNome" defaultValue={company.diretor_nome ?? ""} />
                  </label>
                  <label>
                    Cargo do(a) diretor(a)
                    <input name="diretorCargo" defaultValue={company.diretor_cargo ?? "Diretor(a)"} />
                  </label>

                  <label>
                    Nome da coordenação
                    <input name="coordenacaoNome" defaultValue={company.coordenacao_nome ?? ""} />
                  </label>
                  <label>
                    Cargo da coordenação
                    <input name="coordenacaoCargo" defaultValue={company.coordenacao_cargo ?? "Coordenador(a)"} />
                  </label>

                  <label>
                    Nome do financeiro
                    <input name="financeiroNome" defaultValue={company.financeiro_nome ?? ""} />
                  </label>
                  <label>
                    Cargo do financeiro
                    <input name="financeiroCargo" defaultValue={company.financeiro_cargo ?? "Financeiro"} />
                  </label>
                </div>
              )
            },
            {
              value: "outras",
              label: "Outras informações",
              content: (
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="md:col-span-2">
                    Portaria / Resolução
                    <input
                      name="resolucao"
                      defaultValue={company.resolucao ?? ""}
                      placeholder="Ex.: RENOVAÇÃO DE RECONHECIMENTO, RESOLUÇÃO CEE/CEB Nº 000/0000"
                    />
                  </label>

                  <label>
                    E-mail
                    <input name="email" type="email" defaultValue={company.email ?? ""} />
                  </label>
                  <label>
                    Site
                    <input name="site" type="url" defaultValue={company.site ?? ""} placeholder="https://" />
                  </label>
                  <label>
                    WhatsApp
                    <input name="whatsapp" defaultValue={company.whatsapp ?? ""} placeholder="(00) 00000-0000" />
                  </label>
                  <label>
                    Telefone
                    <input
                      name="telefones"
                      value={telefones}
                      onChange={(e) => setTelefones(maskPhone(e.target.value))}
                      placeholder="(00) 00000-0000"
                    />
                  </label>

                  <label>
                    Código INEP
                    <input name="codigoInep" defaultValue={company.codigo_inep ?? ""} />
                  </label>
                  <label className="md:col-span-2">
                    Entidade mantenedora
                    <input name="mantenedora" defaultValue={company.mantenedora ?? ""} />
                  </label>
                </div>
              )
            }
          ]}
        />
      ) : null}

      <div className="flex justify-end gap-2">
        <Button type="submit" variant="primary">
          {submitLabel}
        </Button>
      </div>
      </form>
    </div>
  );
}
