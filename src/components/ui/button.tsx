import Link from "next/link";
import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Spinner } from "./spinner";

const variants = {
  primary: "ds-button-primary",
  accent: "ds-button-accent",
  secondary: "ds-button-secondary",
  warn: "ds-button-warn",
  // Emissões de documento do aluno — um matiz fixo por tipo.
  boletim: "ds-button-doc ds-button-boletim",
  historico: "ds-button-doc ds-button-historico",
  certificado: "ds-button-doc ds-button-certificado",
  ghost: "border-transparent bg-transparent text-ink hover:bg-muted"
};

type ButtonProps = ComponentPropsWithoutRef<"button"> & {
  variant?: keyof typeof variants;
  /** Mostra spinner, desabilita o botao e marca aria-busy. */
  loading?: boolean;
};

type ButtonLinkProps = ComponentPropsWithoutRef<typeof Link> & {
  children: ReactNode;
  variant?: keyof typeof variants;
};

export function Button({
  className,
  variant = "primary",
  loading = false,
  disabled,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn("ds-button", variants[variant], className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading && <Spinner className="mr-1.5" />}
      {children}
    </button>
  );
}

export function ButtonLink({ className, variant = "primary", ...props }: ButtonLinkProps) {
  return <Link className={cn("ds-button", variants[variant], className)} {...props} />;
}
