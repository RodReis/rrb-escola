// Funções puras de validação usadas pelas Server Actions do inbox de WhatsApp.
// Ficam fora de whatsapp-inbox.ts porque arquivos "use server" só podem exportar
// async functions — todo export vira uma Server Action pública.

// Path de storage permitido: gerado exclusivamente por POST /api/whatsapp/upload
// no formato `outbound/<uuid>.<ext>` (ver src/app/api/whatsapp/upload/route.ts).
// O client não pode ditar um path arbitrário do bucket — isso seria um IDOR
// (permitiria ler, via signed URL, imagens de outras conversas/escolas).
const PATH_IMAGEM_OUTBOUND_REGEX =
  /^outbound\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.[a-z0-9]{1,5}$/i;

export function validarPathImagem(path: string): boolean {
  return PATH_IMAGEM_OUTBOUND_REGEX.test(path);
}
