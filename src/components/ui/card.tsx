import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Card({ className, ...props }: HTMLAttributes<HTMLElement>) {
  return <section className={cn("ds-card p-5", className)} {...props} />;
}

export function Panel({ className, ...props }: HTMLAttributes<HTMLElement>) {
  return <section className={cn("ds-panel p-5", className)} {...props} />;
}
