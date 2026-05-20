"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCcw, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { rematricularAlunoAction } from "@/lib/actions/academics";

type Props = { matriculaId: string };

export function ReenrollButton({ matriculaId }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    if (loading) return;
    setLoading(true);
    try {
      const result = await rematricularAlunoAction(matriculaId);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      router.push(`/matriculas/${result.novaMatriculaId}?rematricula=1`);
    } catch {
      toast.error("Erro inesperado. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      className="ds-button ds-button-secondary disabled:opacity-50"
    >
      {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCcw size={14} />}
      Re-matricular
    </button>
  );
}
