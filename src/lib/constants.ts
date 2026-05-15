export const DEFAULT_SCHOOL_ID = "00000000-0000-0000-0000-000000000001";

export const money = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL"
});

export const dateFormat = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "UTC"
});
