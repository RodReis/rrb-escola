export type TipoAcesso = "entrada" | "saida";

export type DadosNotificacaoPortaria = {
  nomeAluno: string;
  tipo: TipoAcesso;
  dataEvento: Date;
  fotoUrl: string | null;
};

export type TemplatesPortaria = {
  comFoto: string;
  semFoto: string;
};

export type NotificacaoPortaria = {
  templateName: string;
  variaveis: string[];
  imagemUrl?: string;
  textoLog: string;
};

function horarioSP(data: Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
  }).format(data);
}

// Decide o template (foto/texto) e monta as variáveis da notificação de portaria.
export function montarNotificacaoPortaria(
  dados: DadosNotificacaoPortaria,
  templates: TemplatesPortaria,
): NotificacaoPortaria {
  const verbo = dados.tipo === "entrada" ? "entrou" : "saiu";
  const horario = horarioSP(dados.dataEvento);
  const variaveis = [dados.nomeAluno, verbo, horario];
  const textoLog = `${dados.nomeAluno} ${verbo} na escola às ${horario}.`;

  if (dados.fotoUrl) {
    return {
      templateName: templates.comFoto,
      variaveis,
      imagemUrl: dados.fotoUrl,
      textoLog,
    };
  }

  return {
    templateName: templates.semFoto,
    variaveis,
    textoLog,
  };
}
