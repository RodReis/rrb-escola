import Link from "next/link";
import { Panel } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { BracketsTable } from "@/components/rh/brackets/brackets-table";
import { NewVigenciaButton } from "@/components/rh/brackets/new-vigencia-button";
import { VigenciaSelect } from "@/components/rh/brackets/vigencia-select";
import { DeleteVigenciaButton } from "@/components/rh/brackets/delete-vigencia-button";
import { listBracketVigencias, listBracketsByVigencia } from "@/lib/data/brackets";
import { requirePerfil } from "@/lib/auth/session";
import type { InssBracketRow, IrBracketRow } from "@/lib/data/brackets";

export const dynamic = "force-dynamic";

export default async function BracketsPage({
  searchParams
}: {
  searchParams: Promise<{ tab?: string; vigencia?: string; ok?: string; erro?: string }>;
}) {
  await requirePerfil(["admin"]);
  const sp = await searchParams;

  const [inssVigencias, irVigencias] = await Promise.all([
    listBracketVigencias("inss"),
    listBracketVigencias("ir")
  ]);

  const inssVigSel = sp.vigencia && sp.tab === "inss" ? sp.vigencia : inssVigencias[0];
  const irVigSel = sp.vigencia && sp.tab === "ir" ? sp.vigencia : irVigencias[0];

  const [inssBrackets, irBrackets] = await Promise.all([
    inssVigSel ? listBracketsByVigencia("inss", inssVigSel) : Promise.resolve([] as InssBracketRow[]),
    irVigSel ? listBracketsByVigencia("ir", irVigSel) : Promise.resolve([] as IrBracketRow[])
  ]);

  return (
    <div className="grid gap-8">
      <PageHeader
        breadcrumb={[{ label: "RH" }, { label: "Configuração" }, { label: "Brackets" }]}
        title="Tabelas progressivas"
        description="Vigências de INSS e IRRF. A folha usa a vigência mais recente cuja data ≤ competência."
      />

      {sp.ok ? (
        <div className="rounded-ui bg-success/10 p-3 text-sm font-semibold text-success">Operação concluída.</div>
      ) : null}
      {sp.erro ? (
        <div className="rounded-ui bg-danger/10 p-3 text-sm font-semibold text-danger">{sp.erro}</div>
      ) : null}

      <Panel className="grid gap-4 p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-bold text-ink">INSS</h2>
          <div className="flex items-center gap-2">
            {inssVigencias.length > 0 ? (
              <VigenciaSelect table="inss" vigencias={inssVigencias} current={inssVigSel} />
            ) : (
              <span className="text-sm text-ink/55">Nenhuma vigência</span>
            )}
            <NewVigenciaButton table="inss" vigencias={inssVigencias} />
            {inssVigSel ? <DeleteVigenciaButton table="inss" vigencia={inssVigSel} /> : null}
          </div>
        </div>
        {inssVigSel ? (
          <BracketsTable table="inss" vigencia={inssVigSel} brackets={inssBrackets as InssBracketRow[]} />
        ) : (
          <p className="text-sm text-ink/55">Crie uma vigência para começar.</p>
        )}
      </Panel>

      <Panel className="grid gap-4 p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-bold text-ink">IRRF</h2>
          <div className="flex items-center gap-2">
            {irVigencias.length > 0 ? (
              <VigenciaSelect table="ir" vigencias={irVigencias} current={irVigSel} />
            ) : (
              <span className="text-sm text-ink/55">Nenhuma vigência</span>
            )}
            <NewVigenciaButton table="ir" vigencias={irVigencias} />
            {irVigSel ? <DeleteVigenciaButton table="ir" vigencia={irVigSel} /> : null}
          </div>
        </div>
        {irVigSel ? (
          <BracketsTable table="ir" vigencia={irVigSel} brackets={irBrackets as IrBracketRow[]} />
        ) : (
          <p className="text-sm text-ink/55">Crie uma vigência para começar.</p>
        )}
      </Panel>

      <Panel className="p-4 text-xs text-ink/55">
        <Link href="/rh/folha" className="font-semibold text-brand hover:underline">← Voltar para folha</Link>
      </Panel>
    </div>
  );
}
