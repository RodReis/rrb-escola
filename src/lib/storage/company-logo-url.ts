/**
 * Monta a URL pública do bucket `escola-logos` a partir do `logo_path`
 * salvo na company. Roda no cliente (company-form, emissao-form,
 * certificado-form são client components) — por isso não usa o
 * `getPublicUrl` de `public-urls.ts`, que depende do client Supabase do
 * servidor. A URL pública de um bucket público é sempre previsível, então
 * montar direto com `NEXT_PUBLIC_SUPABASE_URL` é seguro aqui.
 */
export function companyLogoUrl(logoPath: string | null | undefined): string | null {
  if (!logoPath) return null;
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/escola-logos/${logoPath}`;
}
