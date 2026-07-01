/**
 * Utilitário de janela de atendimento WhatsApp (browser-safe, sem Node deps).
 */
export function janelaAberta(janelaExpiraEm: string | null, agora: Date): boolean {
  if (!janelaExpiraEm) return false;
  return new Date(janelaExpiraEm).getTime() > agora.getTime();
}
