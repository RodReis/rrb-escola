"use client";

import { Search } from "lucide-react";
import type { InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "size"> & {
  containerClassName?: string;
};

export function SearchInline({ containerClassName, className, placeholder = "Buscar...", ...rest }: Props) {
  return (
    <label className={cn("ds-search-inline", containerClassName)}>
      <Search size={16} strokeWidth={2} />
      <input type="search" placeholder={placeholder} className={className} {...rest} />
    </label>
  );
}
