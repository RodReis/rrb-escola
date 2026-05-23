// Normaliza um telefone brasileiro para E.164 sem "+" (ex: 5562999998888).
// Aceita máscara, com/sem DDI 55, fixo (10 díg) ou celular (11 díg).
// Retorna null se o número não for reconhecível.
export function normalizarTelefone(raw: string): string | null {
  const digitos = raw.replace(/\D/g, "");

  // Já com DDI 55: 12 (fixo) ou 13 (celular) dígitos.
  if (digitos.startsWith("55") && (digitos.length === 12 || digitos.length === 13)) {
    return digitos;
  }

  // Sem DDI: 10 (fixo) ou 11 (celular) dígitos → prefixa 55.
  if (digitos.length === 10 || digitos.length === 11) {
    return `55${digitos}`;
  }

  return null;
}
