import Link from "next/link";
import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { cn } from "@/lib/utils";

const variants = {
  primary: "ds-button-primary",
  accent: "ds-button-accent",
  secondary: "ds-button-secondary",
  ghost: "border-transparent bg-transparent text-ink hover:bg-muted"
};

type ButtonProps = ComponentPropsWithoutRef<"button"> & {
  variant?: keyof typeof variants;
};

type ButtonLinkProps = ComponentPropsWithoutRef<typeof Link> & {
  children: ReactNode;
  variant?: keyof typeof variants;
};

export function Button({ className, variant = "primary", ...props }: ButtonProps) {
  return <button className={cn("ds-button", variants[variant], className)} {...props} />;
}

export function ButtonLink({ className, variant = "primary", ...props }: ButtonLinkProps) {
  return <Link className={cn("ds-button", variants[variant], className)} {...props} />;
}
