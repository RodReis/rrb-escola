"use client";

import { AlertCircle, CheckCircle2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

type Props = {
  ok?: string;
  erro?: string;
};

/**
 * Mostra a mensagem de sucesso/erro vinda do redirect da Server Action e,
 * na sequência, limpa `?ok=`/`?erro=` da URL — senão um F5 reexibe a
 * mensagem como se a ação tivesse acabado de acontecer de novo.
 */
export function CompanyStatusBanner({ ok, erro }: Props) {
  const router = useRouter();

  useEffect(() => {
    if (!ok && !erro) return;
    const timeout = setTimeout(() => router.replace("/rh/empresas"), 4000);
    return () => clearTimeout(timeout);
  }, [ok, erro, router]);

  if (!ok && !erro) return null;

  return (
    <>
      {ok ? (
        <div className="flex items-center gap-2 rounded-ui bg-success/10 p-3 text-sm font-semibold text-success">
          <CheckCircle2 size={16} />
          Empresa {ok} com sucesso.
        </div>
      ) : null}
      {erro ? (
        <div className="flex items-center gap-2 rounded-ui bg-danger/10 p-3 text-sm font-semibold text-danger">
          <AlertCircle size={16} />
          {erro}
        </div>
      ) : null}
    </>
  );
}
