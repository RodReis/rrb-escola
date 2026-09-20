"use client";

/**
 * Helpers de imagem para os geradores jsPDF. Precisam rodar no cliente: usam
 * `fetch`, `FileReader` e `Image`, que nao existem no runtime do servidor nem
 * no ambiente node dos testes. Por isso os geradores recebem as imagens ja
 * baixadas, em vez de buscarem sozinhos.
 */

/** Baixa uma imagem e devolve data URL + dimensoes naturais. Null se falhar. */
export async function urlToDataUrl(
  url: string | null
): Promise<{ data: string; w: number; h: number } | null> {
  if (!url) return null;
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    const blob = await res.blob();
    const data: string = await new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result as string);
      r.onerror = reject;
      r.readAsDataURL(blob);
    });
    const dims: { w: number; h: number } = await new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
      // Falha ao medir nao derruba a emissao: 100x100 deixa a imagem caber na
      // caixa, so sem preservar a proporcao real.
      img.onerror = () => resolve({ w: 100, h: 100 });
      img.src = data;
    });
    return { data, w: dims.w, h: dims.h };
  } catch {
    return null;
  }
}

/** Escala preservando proporcao para caber na caixa. */
export function imgFitInBox(
  orig: { w: number; h: number },
  maxW: number,
  maxH: number
): { w: number; h: number } {
  const ratio = Math.min(maxW / orig.w, maxH / orig.h);
  return { w: orig.w * ratio, h: orig.h * ratio };
}
