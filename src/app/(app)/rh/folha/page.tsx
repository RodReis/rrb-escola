import { redirect } from "next/navigation";
import { currentUrlMonth } from "@/lib/payroll/date-utils";

export default function FolhaIndex() {
  redirect(`/rh/folha/${currentUrlMonth()}`);
}
