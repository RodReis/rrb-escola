import { Topbar } from "@/components/layout/topbar";
import { requireSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();
  return (
    <div className="ds-shell">
      <Topbar perfil={session.profile} />
      <main>
        <div className="mx-auto min-h-[calc(100vh-72px)] max-w-7xl px-4 py-6 sm:px-6 lg:px-8">{children}</div>
      </main>
    </div>
  );
}
