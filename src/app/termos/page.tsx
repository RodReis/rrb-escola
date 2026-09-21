import type { Metadata } from "next";
import { LegalShell, type LegalTocItem } from "@/components/legal/legal-shell";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Termos de Uso — CRM Escola",
  description:
    "Termos e condições de uso do CRM de gestão escolar CRM Escola, fornecido pela RRB Trading Ltda., incluindo assinatura, pagamentos e uso do WhatsApp."
};

const UPDATED_AT = "1 de julho de 2026";

const toc: LegalTocItem[] = [
  { id: "objeto", label: "Objeto" },
  { id: "definicoes", label: "Definições" },
  { id: "conta", label: "Conta e acesso" },
  { id: "assinatura", label: "Assinatura e pagamento" },
  { id: "uso", label: "Regras de uso" },
  { id: "whatsapp", label: "Uso do WhatsApp" },
  { id: "dados", label: "Proteção de dados" },
  { id: "propriedade", label: "Propriedade intelectual" },
  { id: "disponibilidade", label: "Disponibilidade e suporte" },
  { id: "responsabilidade", label: "Responsabilidades e limites" },
  { id: "vigencia", label: "Vigência e rescisão" },
  { id: "alteracoes", label: "Alterações" },
  { id: "foro", label: "Lei e foro" },
  { id: "contato", label: "Contato" }
];

export default function TermosDeUsoPage() {
  return (
    <LegalShell
      kicker="Condições de uso"
      title="Termos de Uso"
      updatedAt={UPDATED_AT}
      toc={toc}
      otherDoc={{ href: "/privacidade", label: "Ler a Política de Privacidade" }}
    >
      <p>
        Estes Termos de Uso (&ldquo;Termos&rdquo;) regem o acesso e o uso do <strong>CRM Escola</strong>, sistema (CRM)
        de gestão escolar fornecido pela <strong>RRB Trading Ltda.</strong> (&ldquo;RRB&rdquo;). Ao contratar, acessar
        ou usar o sistema, a instituição contratante e seus usuários concordam com estes Termos. Se não concordar, não
        utilize o serviço.
      </p>

      <h2 id="objeto">1. Objeto</h2>
      <p>
        A RRB concede à instituição contratante (&ldquo;Cliente&rdquo;) uma licença de uso, não exclusiva e
        intransferível, do CRM Escola, disponibilizado no modelo software como serviço (SaaS) para gestão de
        secretaria, matrículas, frequência, financeiro, comunicação e demais funcionalidades ofertadas, conforme o
        plano contratado.
      </p>

      <h2 id="definicoes">2. Definições</h2>
      <ul>
        <li>
          <strong>Cliente</strong>: instituição de ensino que contrata o serviço.
        </li>
        <li>
          <strong>Usuário</strong>: pessoa autorizada pelo Cliente a acessar o sistema (gestor, secretaria, professor
          etc.).
        </li>
        <li>
          <strong>Titular de dados</strong>: pessoa a quem os dados pessoais se referem (aluno, responsável,
          colaborador).
        </li>
        <li>
          <strong>Plataforma</strong>: o software CRM Escola e seus módulos e integrações.
        </li>
      </ul>

      <h2 id="conta">3. Conta e acesso</h2>
      <ul>
        <li>O Cliente é responsável por manter a confidencialidade das credenciais e pelo uso feito por seus Usuários.</li>
        <li>Cada Usuário deve ter credenciais individuais; o compartilhamento de senha é vedado.</li>
        <li>
          O Cliente deve fornecer informações verdadeiras e atualizadas e é responsável por conceder e revogar acessos
          conforme seus perfis internos.
        </li>
        <li>A RRB pode suspender acessos diante de suspeita de uso indevido ou risco à segurança.</li>
      </ul>

      <h2 id="assinatura">4. Assinatura, planos e pagamento</h2>
      <ul>
        <li>
          O uso do serviço está sujeito ao plano e às condições comerciais contratadas (valores, periodicidade e
          funcionalidades).
        </li>
        <li>
          Os pagamentos (mensalidade da assinatura e demais cobranças) podem ser processados por gateway terceiro
          (Asaas), via boleto, PIX ou outros meios disponibilizados.
        </li>
        <li>
          O atraso no pagamento pode ensejar suspensão do acesso após comunicação, sem prejuízo da cobrança dos valores
          devidos.
        </li>
        <li>
          Salvo disposição em contrário no contrato ou na legislação aplicável, valores pagos por período já usufruído
          não são reembolsáveis.
        </li>
      </ul>

      <h2 id="uso">5. Regras de uso</h2>
      <p>O Cliente e os Usuários comprometem-se a não:</p>
      <ul>
        <li>usar o sistema para finalidade ilícita ou que viole direitos de terceiros;</li>
        <li>inserir dados sem base legal adequada ou sem as autorizações necessárias dos titulares;</li>
        <li>tentar acessar áreas, dados ou contas de terceiros sem autorização;</li>
        <li>realizar engenharia reversa, copiar, revender ou sublicenciar a Plataforma;</li>
        <li>introduzir código malicioso ou comprometer a segurança e a disponibilidade do serviço;</li>
        <li>utilizar a comunicação por WhatsApp para spam ou mensagens sem opt-in (ver seção 6).</li>
      </ul>

      <h2 id="whatsapp">6. Uso da integração com o WhatsApp</h2>
      <p>
        A funcionalidade de comunicação usa a Plataforma do WhatsApp Business, da Meta. Ao utilizá-la, o Cliente é o
        responsável pelo conteúdo enviado e deve:
      </p>
      <ul>
        <li>
          obter e manter o <strong>opt-in</strong> dos destinatários antes de enviar mensagens;
        </li>
        <li>
          respeitar as políticas da Meta, incluindo a{" "}
          <a href="https://business.whatsapp.com/policy" target="_blank" rel="noopener noreferrer">
            Política de Mensagens do WhatsApp Business
          </a>{" "}
          e a{" "}
          <a href="https://www.whatsapp.com/legal/commerce-policy" target="_blank" rel="noopener noreferrer">
            Política de Comércio
          </a>
          ;
        </li>
        <li>atender prontamente aos pedidos de descadastro dos destinatários.</li>
      </ul>
      <p>
        O descumprimento dessas regras pode levar à suspensão da funcionalidade ou da conta pela RRB e/ou pela Meta,
        sem prejuízo das responsabilidades do Cliente.
      </p>

      <h2 id="dados">7. Proteção de dados pessoais</h2>
      <p>
        Em relação aos dados de alunos, responsáveis e colaboradores inseridos pelo Cliente, a{" "}
        <strong>instituição é a controladora</strong> e a <strong>RRB atua como operadora</strong>, tratando os dados
        sob instrução do Cliente e conforme a{" "}
        <a href="/privacidade">Política de Privacidade</a>, que integra estes Termos. O Cliente declara possuir base
        legal para o tratamento que realiza por meio da Plataforma e é responsável por atender às solicitações dos
        titulares no que lhe couber.
      </p>

      <h2 id="propriedade">8. Propriedade intelectual</h2>
      <p>
        A Plataforma, seu código, design, marcas e materiais são de titularidade da RRB (ou de seus licenciadores). Estes
        Termos não transferem qualquer direito de propriedade intelectual ao Cliente, além da licença de uso aqui
        prevista. Os dados inseridos pelo Cliente permanecem de titularidade do Cliente/dos titulares.
      </p>

      <h2 id="disponibilidade">9. Disponibilidade e suporte</h2>
      <p>
        Envidamos esforços para manter o serviço disponível, podendo haver interrupções para manutenção, atualização ou
        por fatores externos (por exemplo, indisponibilidade de fornecedores como hospedagem, WhatsApp ou gateway de
        pagamento). Eventuais níveis de serviço e canais de suporte seguem o que estiver previsto no contrato ou plano
        contratado.
      </p>

      <h2 id="responsabilidade">10. Responsabilidades e limitações</h2>
      <ul>
        <li>
          O serviço é fornecido &ldquo;no estado em que se encontra&rdquo;, conforme as funcionalidades disponíveis no
          plano contratado.
        </li>
        <li>
          A RRB não se responsabiliza por conteúdo inserido pelo Cliente, por decisões tomadas com base no sistema, nem
          por falhas de serviços de terceiros integrados.
        </li>
        <li>
          Na máxima extensão permitida pela legislação, a responsabilidade da RRB por perdas e danos limita-se aos
          valores efetivamente pagos pelo Cliente nos 12 meses anteriores ao evento, salvo disposição legal cogente em
          contrário.
        </li>
      </ul>

      <h2 id="vigencia">11. Vigência, rescisão e exportação de dados</h2>
      <ul>
        <li>Estes Termos vigoram enquanto durar a contratação do serviço.</li>
        <li>
          Qualquer das partes pode encerrar a relação conforme o contrato. O inadimplemento ou a violação destes Termos
          pode ensejar suspensão ou rescisão.
        </li>
        <li>
          Encerrada a relação, o Cliente pode solicitar a <strong>exportação de seus dados</strong> em prazo razoável;
          após isso, os dados são devolvidos ou eliminados conforme sua instrução e os prazos legais.
        </li>
      </ul>

      <h2 id="alteracoes">12. Alterações destes Termos</h2>
      <p>
        A RRB pode alterar estes Termos para refletir mudanças legais, técnicas ou do serviço. A versão vigente estará
        sempre disponível nesta página. Alterações relevantes serão comunicadas, e o uso continuado após a vigência
        implica concordância.
      </p>

      <h2 id="foro">13. Lei aplicável e foro</h2>
      <p>
        Estes Termos são regidos pela legislação brasileira. Fica eleito o foro da Comarca de São Paulo/SP para dirimir
        controvérsias, salvo regra de competência legal que determine foro diverso (por exemplo, relações de consumo).
      </p>

      <h2 id="contato">14. Contato</h2>
      <p>
        RRB Trading Ltda. — CNPJ 60.347.383/0001-09 — São Paulo/SP.{" "}
        <a href="https://www.rrbtrading.com.br" target="_blank" rel="noopener noreferrer">
          www.rrbtrading.com.br
        </a>
        . Contato e Encarregado (DPO): Rodrigo Reis —{" "}
        <a href="mailto:contato@rrbtrading.com.br">contato@rrbtrading.com.br</a>.
      </p>
    </LegalShell>
  );
}
