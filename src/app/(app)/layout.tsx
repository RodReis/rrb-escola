import { Topbar } from "@/components/layout/topbar";

export const dynamic = "force-dynamic";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="ds-shell">
      <Topbar />
      <main>
        <div className="mx-auto min-h-[calc(100vh-72px)] max-w-7xl px-4 py-6 sm:px-6 lg:px-8">{children}</div>
      </main>
    </div>
  );
}
