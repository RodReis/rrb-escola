import { redirect } from "next/navigation";
import { currentUrlMonth } from "@/lib/payroll/date-utils";
import { requirePermission } from "@/lib/auth/session";

export default async function FolhaIndex() {
  await requirePermission("rh.folha", "read");
  redirect(`/rh/folha/${currentUrlMonth()}`);
}
