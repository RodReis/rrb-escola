/* eslint-disable @next/next/no-img-element */
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/card";
import { uploadStudentPhotoAction } from "@/lib/actions/students";

export function StudentPhotoUpload({ alunoId, fotoUrl, nome }: { alunoId: string; fotoUrl: string | null; nome: string }) {
  return (
    <Panel className="grid gap-4">
      <h2 className="font-serif text-2xl text-ink">Foto do aluno</h2>
      <div className="grid gap-5 md:grid-cols-[130px_1fr]">
        {fotoUrl ? (
          <img src={fotoUrl} alt={nome} className="h-[160px] w-[120px] rounded-ui border border-line object-cover" />
        ) : (
          <div className="grid h-[160px] w-[120px] place-items-center rounded-ui border border-line bg-surface text-xs font-bold text-muted">
            Sem foto
          </div>
        )}
        <form action={uploadStudentPhotoAction} className="grid content-end gap-3">
          <input type="hidden" name="aluno_id" value={alunoId} />
          <label>
            Enviar imagem
            <input name="foto" type="file" accept="image/jpeg,image/png,image/webp" required />
          </label>
          <p className="text-xs text-muted">A imagem sera salva no bucket local `alunos-fotos` do Supabase.</p>
          <div>
            <Button variant="accent">Salvar foto</Button>
          </div>
        </form>
      </div>
    </Panel>
  );
}
