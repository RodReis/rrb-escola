"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/auth/session";
import { formText, formNumber } from "@/lib/utils";
import { agendarGozo } from "@/lib/folha/aquisitivos";
import { gerarRunEspecial } from "@/lib/folha/runs-especiais";

const PERM = "rh.folha-v2" as const;
const REVALIDATE = "/rh/folha-v2";

export async function agendarGozoAction(formData: FormData) {
  await requirePermission(PERM, "update");

  const periodoId = formText(formData, "periodo_id");
  const gozoInicio = formText(formData, "gozo_inicio");
  const gozoDias = formNumber(formData, "gozo_dias");
  const diasAbono = formNumber(formData, "dias_abono") ?? 0;

  if (!periodoId || !gozoInicio || !gozoDias) {
    redirect(`${REVALIDATE}/ferias?erro=${encodeURIComponent("Preencha todos os campos obrigatórios")}`);
  }

  try {
    await agendarGozo(periodoId, gozoInicio, gozoDias, diasAbono);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro ao agendar gozo";
    redirect(`${REVALIDATE}/ferias?erro=${encodeURIComponent(msg)}`);
  }

  revalidatePath(`${REVALIDATE}/ferias`);
  redirect(`${REVALIDATE}/ferias?ok=1`);
}

export async function gerarRunEspecialAction(formData: FormData) {
  await requirePermission(PERM, "update");

  const companyId = formText(formData, "company_id");
  const competencia = formText(formData, "competencia");
  const tipo = formText(formData, "tipo") as "decimo_1a" | "decimo_2a" | "ferias";
  const janela = formText(formData, "janela") ?? undefined;

  if (!companyId || !competencia || !tipo) {
    redirect(`${REVALIDATE}?erro=${encodeURIComponent("Preencha empresa, competência e tipo")}`);
  }

  try {
    await gerarRunEspecial(companyId, competencia, tipo, "manual", janela || undefined);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro ao gerar run especial";
    redirect(`${REVALIDATE}?erro=${encodeURIComponent(msg)}`);
  }

  revalidatePath(REVALIDATE);
  redirect(`${REVALIDATE}?ok=1`);
}
