import "server-only";

export type AsaasResult<T> =
  | { ok: true; data: T }
  | { ok: false; reason: string };

type AsaasConfig = {
  apiKey: string;
  apiUrl: string;
};

function getConfig(): AsaasConfig | null {
  const apiKey = process.env.ASAAS_API_KEY;
  const apiUrl = process.env.ASAAS_API_URL;
  if (!apiKey || !apiUrl) return null;
  return { apiKey, apiUrl: apiUrl.replace(/\/$/, "") };
}

async function asaasPost<T>(
  config: AsaasConfig,
  path: string,
  body: Record<string, unknown>,
): Promise<AsaasResult<T>> {
  try {
    const res = await fetch(`${config.apiUrl}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        access_token: config.apiKey,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15000),
    });

    const json = (await res.json().catch(() => null)) as any;

    if (!res.ok) {
      const erro = json?.errors?.[0]?.description ?? `Asaas HTTP ${res.status}`;
      return { ok: false, reason: String(erro).slice(0, 200) };
    }

    return { ok: true, data: json as T };
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : "falha Asaas" };
  }
}

// Cria um customer (pagador) no Asaas.
export async function criarCustomer(input: {
  nome: string;
  cpfCnpj: string;
  email?: string | null;
  celular?: string | null;
}): Promise<AsaasResult<{ id: string }>> {
  const config = getConfig();
  if (!config) return { ok: false, reason: "Asaas não configurado" };

  return asaasPost<{ id: string }>(config, "/customers", {
    name: input.nome,
    cpfCnpj: input.cpfCnpj.replace(/\D/g, ""),
    email: input.email ?? undefined,
    mobilePhone: input.celular ? input.celular.replace(/\D/g, "") : undefined,
  });
}

// Cria uma cobrança (boleto/PIX) no Asaas.
export async function criarCobranca(input: {
  customerId: string;
  valor: number;
  vencimento: string; // YYYY-MM-DD
  descricao: string;
}): Promise<AsaasResult<{ id: string; invoiceUrl: string; status: string }>> {
  const config = getConfig();
  if (!config) return { ok: false, reason: "Asaas não configurado" };

  return asaasPost<{ id: string; invoiceUrl: string; status: string }>(
    config,
    "/payments",
    {
      customer: input.customerId,
      billingType: "UNDEFINED",
      value: input.valor,
      dueDate: input.vencimento,
      description: input.descricao,
    },
  );
}
