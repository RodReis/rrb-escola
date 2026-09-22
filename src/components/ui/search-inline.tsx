"use client";

import { Search } from "lucide-react";
import type { InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import { Spinner } from "./spinner";

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "size"> & {
  containerClassName?: string;
  bordered?: boolean;
  /** Mostra spinner no lugar do ícone de lupa — pesquisa em andamento
   * (ex.: useTransition enquanto a lista busca no servidor). */
  loading?: boolean;
};

export function SearchInline({
  containerClassName,
  className,
  placeholder = "Buscar...",
  bordered = false,
  loading = false,
  ...rest
}: Props) {
  return (
    <label
      className={cn(
        "ds-search-inline",
        bordered && "rounded-ui border-2 border-ink/30 bg-surface px-3 py-1.5 transition hover:border-ink/45 focus-within:border-brand focus-within:shadow-ring",
        containerClassName
      )}
    >
      {loading ? <Spinner size={16} /> : <Search size={16} strokeWidth={2} />}
      <input type="search" placeholder={placeholder} className={className} {...rest} />
    </label>
  );
}
