import { NextResponse } from "next/server";
import { cloudinaryConfig, destroy } from "@/lib/cloudinary";
import { supabaseServer } from "@/lib/supabase/server";
import { platformAdmin } from "../admin";

export const dynamic = "force-dynamic";

// Removes a shared background from Cloudinary and from every church's picker.
// Churches using it fall back to black on screen.
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await platformAdmin();
  if (admin instanceof NextResponse) return admin;
  const config = cloudinaryConfig();
  if (!config) return NextResponse.json({ error: "Cloudinary keys are missing from this site's .env.local." }, { status: 500 });

  const { id } = await params;
  const supabase = await supabaseServer();
  // Shared ones only: a church's own uploads are theirs to delete.
  const { data: bg } = await supabase.from("backgrounds").select("id, kind, public_id").eq("id", id).is("church_id", null).maybeSingle();
  if (!bg) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (!(await destroy(config, bg.kind as "image" | "video", bg.public_id))) {
    return NextResponse.json({ error: "Cloudinary didn't delete it. Try again." }, { status: 502 });
  }
  const { error } = await supabase.from("backgrounds").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
