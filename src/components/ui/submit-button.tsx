"use client";

import { useFormStatus } from "react-dom";
import { Button } from "./button";
import type { ComponentPropsWithoutRef } from "react";

type Props = Omit<ComponentPropsWithoutRef<typeof Button>, "loading" | "type">;

/**
 * Botao de submit que se desabilita sozinho enquanto o `<form action={...}>`
 * em volta esta executando.
 *
 * Existe porque `<form action={serverAction}>` nao da estado de pendencia:
 * o botao segue clicavel durante a ida ao servidor e um clique duplo dispara
 * a action duas vezes — cobranca duplicada, matricula duplicada.
 *
 * `useFormStatus` le o estado do form ancestral, entao basta trocar
 * `<Button type="submit">` por `<SubmitButton>`: a action, o formulario e o
 * resto da pagina ficam como estao.
 *
 *     <form action={createChargeAction}>
 *       ...
 *       <SubmitButton>Criar cobranca</SubmitButton>
 *     </form>
 */
export function SubmitButton({ children, ...props }: Props) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" loading={pending} {...props}>
      {children}
    </Button>
  );
}
