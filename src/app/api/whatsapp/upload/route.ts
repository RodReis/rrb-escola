import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

const BUCKET = "whatsapp-inbox";
const MAX_SIZE = 5 * 1024 * 1024; // 5MB
const SIGNED_URL_EXPIRY = 60 * 60; // 1 hora — imagem é enviada logo após o upload

export async function POST(req: Request) {
  try {
    await requirePermission("whatsapp_inbox", "create");
  } catch {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "Arquivo ausente" }, { status: 400 });
    }
    if (!file.type.startsWith("image/")) {
      return NextResponse.json(
        { error: "Somente imagens são permitidas" },
        { status: 400 },
      );
    }
    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: "Arquivo muito grande (máx 5MB)" },
        { status: 400 },
      );
    }

    const ext = file.name.split(".").pop() ?? "jpg";
    const storagePath = `outbound/${randomUUID()}.${ext}`;
    const bytes = new Uint8Array(await file.arrayBuffer());

    const supabase = await createServerClient();

    const { error: upErr } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, bytes, { contentType: file.type, upsert: false });

    if (upErr) {
      return NextResponse.json({ error: upErr.message }, { status: 500 });
    }

    const { data: signed, error: signErr } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(storagePath, SIGNED_URL_EXPIRY);

    if (signErr || !signed?.signedUrl) {
      // Remove arquivo orphan se assinatura falhar
      void supabase.storage.from(BUCKET).remove([storagePath]);
      return NextResponse.json(
        { error: "Falha ao gerar URL assinada" },
        { status: 500 },
      );
    }

    return NextResponse.json({ url: signed.signedUrl, path: storagePath });
  } catch {
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
