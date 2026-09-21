/**
 * Normaliza nome para comparação sem sensibilidade a acento/caixa: trim,
 * lowercase, remove diacríticos via NFD. Usado em toda busca/comparação de
 * nome de aluno — fonte única para evitar reimplementações divergentes
 * (ex.: "CORTES" não achava "CÔRTES" antes desta função existir).
 */
export function normalizeNome(value: string | null | undefined): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase();
}
