import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import { getPipelineBoard, getPrimeiroQuadro, getUsuariosDaEscola } from "@/lib/actions/pipeline";
import { PipelineClient } from "@/components/pipeline/pipeline-client";

export const dynamic = "force-dynamic";

export default async function PipelinePage() {
  const session = await requireSession();
  const perfil = session.profile.perfil;

  if (perfil !== "admin" && perfil !== "secretaria") {
    redirect("/acesso-negado");
  }

  const quadroId = await getPrimeiroQuadro();
  if (!quadroId) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <p className="text-sm text-[rgb(var(--color-ink)/0.5)]">
          Nenhum quadro de pipeline configurado para esta escola.
        </p>
        <p className="mt-1 text-xs text-[rgb(var(--color-ink)/0.35)]">
          Execute a migration para criar o quadro inicial.
        </p>
      </div>
    );
  }

  const [boardResult, usuarios] = await Promise.all([
    getPipelineBoard(quadroId),
    getUsuariosDaEscola(),
  ]);

  if (!boardResult.ok) {
    return (
      <div className="py-10 text-center text-sm text-[rgb(var(--color-danger))]">
        Erro ao carregar pipeline: {boardResult.error}
      </div>
    );
  }

  return (
    <PipelineClient
      data={boardResult.data}
      usuarios={usuarios}
      escolaId={session.profile.escola_id}
    />
  );
}
