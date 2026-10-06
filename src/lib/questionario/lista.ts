export function moverItem<T>(lista: readonly T[], de: number, para: number): T[] {
  const copia = [...lista];
  if (de === para || de < 0 || para < 0 || de >= copia.length || para >= copia.length) return copia;
  const [item] = copia.splice(de, 1);
  copia.splice(para, 0, item);
  return copia;
}

/** Valores repetidos de um campo (`name` igual), aparados, sem os vazios. */
export function lerLista(formData: FormData, chave: string): string[] {
  return formData
    .getAll(chave)
    .map((v) => String(v).trim())
    .filter(Boolean);
}

export function lerTexto(formData: FormData, chave: string): string {
  const valor = formData.get(chave);
  return typeof valor === "string" ? valor.trim() : "";
}

export function normalizarBusca(texto: string): string {
  return texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}
