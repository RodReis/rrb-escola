import type { Metadata } from "next";
import { LegalShell, type LegalTocItem } from "@/components/legal/legal-shell";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Política de Privacidade — RRB Escola",
  description:
    "Como a RRB Trading Ltda. trata dados pessoais no CRM de gestão escolar RRB Escola, incluindo integração com a Plataforma WhatsApp da Meta e a LGPD."
};

const UPDATED_AT = "1 de julho de 2026";

const toc: LegalTocItem[] = [
  { id: "quem-somos", label: "Quem somos" },
  { id: "papeis", label: "Controladora e operadora" },
  { id: "dados", label: "Dados que tratamos" },
  { id: "finalidades", label: "Finalidades e bases legais" },
  { id: "whatsapp", label: "WhatsApp e Meta" },
  { id: "biometria", label: "Reconhecimento facial" },
  { id: "compartilhamento", label: "Compartilhamento" },
  { id: "internacional", label: "Transferência internacional" },
  { id: "retencao", label: "Retenção e eliminação" },
  { id: "seguranca", label: "Segurança" },
  { id: "direitos", label: "Direitos do titular" },
  { id: "menores", label: "Crianças e adolescentes" },
  { id: "cookies", label: "Cookies" },
  { id: "encarregado", label: "Encarregado (DPO)" },
  { id: "alteracoes", label: "Alterações" }
];

export default function PoliticaPrivacidadePage() {
  return (
    <LegalShell
      kicker="Proteção de dados"
      title="Política de Privacidade"
      updatedAt={UPDATED_AT}
      toc={toc}
      otherDoc={{ href: "/termos", label: "Ler os Termos de Uso" }}
    >
      <p>
        Esta Política de Privacidade descreve como a <strong>RRB Trading Ltda.</strong> trata dados pessoais no
        contexto do <strong>RRB Escola</strong>, um sistema (CRM) de gestão escolar disponibilizado como serviço às
        instituições de ensino contratantes, incluindo a integração com a Plataforma do WhatsApp Business, da Meta, e o
        processamento de pagamentos. O documento observa a Lei nº 13.709/2018 (Lei Geral de Proteção de Dados — LGPD).
      </p>

      <h2 id="quem-somos">1. Quem somos</h2>
      <p>
        <strong>RRB Trading Ltda.</strong>, inscrita no CNPJ sob o nº 60.347.383/0001-09, com sede em São Paulo/SP
        (&ldquo;RRB&rdquo;, &ldquo;nós&rdquo;). Site institucional:{" "}
        <a href="https://www.rrbtrading.com.br" target="_blank" rel="noopener noreferrer">
          www.rrbtrading.com.br
        </a>
        . Encarregado pelo Tratamento de Dados Pessoais (DPO): Rodrigo Reis —{" "}
        <a href="mailto:contato@rrbtrading.com.br">contato@rrbtrading.com.br</a>.
      </p>

      <h2 id="papeis">2. Controladora e operadora: os dois papéis da RRB</h2>
      <p>
        A LGPD distingue quem <strong>decide</strong> como os dados são usados (controlador) de quem apenas os{" "}
        <strong>processa em nome de outra pessoa</strong> (operador). No RRB Escola, a RRB atua nos dois papéis,
        conforme o dado:
      </p>
      <ul>
        <li>
          <strong>RRB como operadora.</strong> Em relação aos dados de <strong>alunos, responsáveis, colaboradores e
          demais registros escolares</strong> inseridos por uma instituição contratante, a{" "}
          <strong>instituição de ensino é a controladora</strong> — é ela quem decide quais dados coletar e para quê. A
          RRB trata esses dados <strong>sob instrução</strong> da instituição, apenas para operar o sistema. Pedidos de
          titulares sobre esses dados devem ser dirigidos, em primeiro lugar, à respectiva instituição; a RRB dará
          suporte a ela.
        </li>
        <li>
          <strong>RRB como controladora.</strong> Em relação aos dados de <strong>cadastro da conta, contratação,
          assinatura, faturamento e dos usuários administradores</strong> do sistema, bem como a dados técnicos de
          segurança e prevenção a fraudes, a RRB é a controladora.
        </li>
      </ul>

      <h2 id="dados">3. Dados que tratamos</h2>
      <table>
        <thead>
          <tr>
            <th>Categoria</th>
            <th>Exemplos</th>
            <th>Papel da RRB</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Conta e contratação</td>
            <td>Razão social, CNPJ, responsável pelo contrato, e-mail, telefone, dados de faturamento.</td>
            <td>Controladora</td>
          </tr>
          <tr>
            <td>Usuários do sistema</td>
            <td>Nome, e-mail, perfil de acesso, senha (armazenada com hash), registros de login.</td>
            <td>Controladora</td>
          </tr>
          <tr>
            <td>Alunos e responsáveis</td>
            <td>Nome, data de nascimento, documentos, contatos, matrícula, turma, frequência, avaliações.</td>
            <td>Operadora</td>
          </tr>
          <tr>
            <td>Financeiro</td>
            <td>Mensalidades, boletos, PIX e status de pagamento, processados via gateway Asaas.</td>
            <td>Operadora</td>
          </tr>
          <tr>
            <td>Comunicação por WhatsApp</td>
            <td>Número de telefone, conteúdo de mensagens trocadas, mídias e status de entrega.</td>
            <td>Operadora</td>
          </tr>
          <tr>
            <td>Biometria facial (portaria)</td>
            <td>Representações matemáticas do rosto (templates) para controle de acesso, quando habilitado.</td>
            <td>Operadora</td>
          </tr>
          <tr>
            <td>Dados técnicos</td>
            <td>Endereço IP, dados do dispositivo/navegador, logs de uso e de segurança.</td>
            <td>Controladora</td>
          </tr>
        </tbody>
      </table>

      <h2 id="finalidades">4. Finalidades e bases legais</h2>
      <p>Tratamos dados pessoais para as seguintes finalidades, com as respectivas bases legais da LGPD:</p>
      <ul>
        <li>
          <strong>Prestar e operar o serviço</strong> (secretaria, matrículas, frequência, financeiro, comunicação):
          execução de contrato com a instituição contratante e legítimo interesse na operação do sistema (art. 7º, V e
          IX). Para os dados de aluno, a base legal é definida pela instituição controladora.
        </li>
        <li>
          <strong>Cobrança e pagamentos</strong>: execução de contrato e cumprimento de obrigação legal/regulatória
          (art. 7º, V e II).
        </li>
        <li>
          <strong>Comunicação por WhatsApp</strong> com responsáveis: execução de contrato e consentimento/opt-in do
          destinatário, conforme as políticas da Meta (art. 7º, I e V).
        </li>
        <li>
          <strong>Reconhecimento facial na portaria</strong>: quando habilitado, trata-se de dado pessoal sensível,
          tratado mediante base legal específica definida pela instituição controladora (art. 11) — ver seção 6.
        </li>
        <li>
          <strong>Segurança, prevenção a fraudes e cumprimento de obrigações legais</strong>: legítimo interesse e
          obrigação legal (art. 7º, II e IX; art. 11, II).
        </li>
      </ul>

      <h2 id="whatsapp">5. WhatsApp e a Plataforma da Meta</h2>
      <p>
        O RRB Escola utiliza a <strong>Plataforma do WhatsApp Business (WhatsApp Cloud API)</strong>, fornecida pela
        Meta Platforms, para permitir que a instituição se comunique com responsáveis (lembretes, comunicados e
        atendimento). Ao usar esse recurso:
      </p>
      <ul>
        <li>
          O envio de mensagens depende de <strong>opt-in</strong> — a instituição só contata pessoas que forneceram o
          número e autorizaram o contato, conforme a{" "}
          <a href="https://business.whatsapp.com/policy" target="_blank" rel="noopener noreferrer">
            Política de Mensagens do WhatsApp Business
          </a>
          .
        </li>
        <li>
          As mensagens trafegam pela infraestrutura da Meta e ficam também sujeitas à{" "}
          <a href="https://www.whatsapp.com/legal/privacy-policy" target="_blank" rel="noopener noreferrer">
            Política de Privacidade do WhatsApp
          </a>
          .
        </li>
        <li>
          Os dados obtidos por meio do WhatsApp são usados <strong>exclusivamente</strong> para prestar o serviço de
          comunicação escolar. <strong>Não</strong> utilizamos esses dados para publicidade, nem os vendemos a
          terceiros.
        </li>
        <li>
          O destinatário pode <strong>revogar o opt-in</strong> a qualquer momento, respondendo com pedido de descadastro
          ou solicitando à instituição.
        </li>
      </ul>

      <h2 id="biometria">6. Reconhecimento facial na portaria (dado sensível)</h2>
      <p>
        Quando a instituição habilita o controle de acesso por reconhecimento facial, o sistema gera uma{" "}
        <strong>representação matemática (template) do rosto</strong> para reconhecer a pessoa na entrada. Trata-se de{" "}
        <strong>dado pessoal sensível</strong> (art. 11 da LGPD) e, frequentemente, de <strong>dados de crianças e
        adolescentes</strong>, o que exige cuidado reforçado:
      </p>
      <ul>
        <li>
          A <strong>instituição de ensino é a controladora</strong> e responde pela base legal e pela obtenção do
          consentimento específico e destacado dos responsáveis, quando aplicável.
        </li>
        <li>
          Aplicamos <strong>minimização</strong>: armazenamos o template biométrico e o mínimo necessário para a
          finalidade de controle de acesso, não o utilizando para qualquer outro fim.
        </li>
        <li>
          O dado biométrico é <strong>eliminado</strong> quando o cadastro é removido, ao término da relação com a
          instituição, ou mediante solicitação válida do titular/responsável à instituição.
        </li>
        <li>
          O uso do reconhecimento facial é <strong>opcional</strong>; a instituição pode operar a portaria sem essa
          funcionalidade.
        </li>
      </ul>

      <h2 id="compartilhamento">7. Compartilhamento e suboperadores</h2>
      <p>
        Não vendemos dados pessoais. Compartilhamos dados apenas quando necessário para operar o serviço, com
        fornecedores que atuam como <strong>suboperadores</strong> sob obrigações de confidencialidade e segurança:
      </p>
      <ul>
        <li>
          <strong>Meta Platforms</strong> — envio e recebimento de mensagens via WhatsApp Business Platform.
        </li>
        <li>
          <strong>Asaas</strong> — processamento de cobranças (boletos, PIX) e pagamentos.
        </li>
        <li>
          <strong>Supabase</strong> — banco de dados, autenticação e armazenamento de arquivos.
        </li>
        <li>
          <strong>Resend</strong> — envio de e-mails transacionais.
        </li>
        <li>
          <strong>Autoridades e no cumprimento de obrigação legal</strong>, mediante requisição válida.
        </li>
      </ul>

      <h2 id="internacional">8. Transferência internacional</h2>
      <p>
        Alguns fornecedores acima podem processar dados em servidores localizados fora do Brasil. Nesses casos, adotamos
        salvaguardas contratuais e técnicas compatíveis com a LGPD para proteger os dados transferidos.
      </p>

      <h2 id="retencao">9. Retenção e eliminação</h2>
      <p>
        Mantemos os dados apenas pelo tempo necessário às finalidades informadas ou conforme instrução da instituição
        controladora, salvo obrigação legal de guarda (por exemplo, registros fiscais e financeiros). Encerrado o
        contrato, os dados sob responsabilidade da instituição são devolvidos ou eliminados conforme sua instrução,
        respeitados os prazos legais.
      </p>

      <h2 id="seguranca">10. Segurança</h2>
      <p>
        Adotamos medidas técnicas e organizacionais para proteger os dados, incluindo controle de acesso por perfil,
        criptografia de senhas, comunicação por HTTPS, verificação de assinatura nos webhooks e registros de auditoria.
        Nenhum sistema é totalmente imune a incidentes; em caso de incidente de segurança relevante, atuaremos conforme
        a LGPD e as orientações da ANPD, apoiando as instituições controladoras nas comunicações cabíveis.
      </p>

      <h2 id="direitos">11. Direitos do titular</h2>
      <p>
        Nos termos do art. 18 da LGPD, o titular pode solicitar: confirmação da existência de tratamento; acesso aos
        dados; correção; anonimização, bloqueio ou eliminação de dados desnecessários ou tratados em desconformidade;
        portabilidade; informação sobre compartilhamento; e revogação do consentimento.
      </p>
      <p>
        <strong>Como exercer:</strong> se o dado se refere a aluno, responsável ou registro escolar, contate primeiro a{" "}
        <strong>instituição de ensino</strong> (controladora). Para dados de conta/assinatura sob responsabilidade da
        RRB, ou para dúvidas sobre esta Política, contate o Encarregado:{" "}
        <a href="mailto:contato@rrbtrading.com.br">contato@rrbtrading.com.br</a>.
      </p>

      <h2 id="menores">12. Crianças e adolescentes</h2>
      <p>
        O sistema trata dados de crianças e adolescentes no interesse da atividade escolar, sempre sob responsabilidade
        da instituição controladora e no melhor interesse do menor (art. 14 da LGPD). Não direcionamos publicidade a
        menores e aplicamos minimização a esses dados.
      </p>

      <h2 id="cookies">13. Cookies e tecnologias semelhantes</h2>
      <p>
        Utilizamos apenas cookies e armazenamento local <strong>estritamente necessários</strong> ao funcionamento —
        por exemplo, para manter a sessão autenticada e a preferência de tema (claro/escuro). Não usamos cookies de
        publicidade.
      </p>

      <h2 id="encarregado">14. Encarregado (DPO) e ANPD</h2>
      <p>
        Encarregado: <strong>Rodrigo Reis</strong> —{" "}
        <a href="mailto:contato@rrbtrading.com.br">contato@rrbtrading.com.br</a>. Caso entenda que seus direitos não
        foram atendidos, você pode apresentar reclamação à Autoridade Nacional de Proteção de Dados (ANPD),{" "}
        <a href="https://www.gov.br/anpd" target="_blank" rel="noopener noreferrer">
          gov.br/anpd
        </a>
        .
      </p>

      <h2 id="alteracoes">15. Alterações desta Política</h2>
      <p>
        Podemos atualizar esta Política para refletir mudanças legais, técnicas ou do serviço. A versão vigente estará
        sempre disponível nesta página, com a data de última atualização. Alterações relevantes serão comunicadas pelos
        canais usuais.
      </p>
    </LegalShell>
  );
}
