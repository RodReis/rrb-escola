// Deriva o bimestre escolar a partir de uma data ISO (YYYY-MM-DD).
// Convenção brasileira padrão: 1=Jan-Mar, 2=Abr-Jun, 3=Jul-Set, 4=Out-Dez.
export function bimestreFromData(dateIso: string): 1 | 2 | 3 | 4 {
  const m = dateIso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const mes = m ? Number(m[2]) : new Date().getMonth() + 1;
  if (mes <= 3) return 1;
  if (mes <= 6) return 2;
  if (mes <= 9) return 3;
  return 4;
}
