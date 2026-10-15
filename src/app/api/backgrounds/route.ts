import { NextResponse } from "next/server";
import { cloudinaryConfig, deliveryUrl, SHARED_FOLDER } from "@/lib/cloudinary";
import { supabaseServer } from "@/lib/supabase/server";
import { platformAdmin } from "./admin";

export const dynamic = "force-dynamic";

// Records a shared background the browser just uploaded, so every church can pick it.
export async function POST(req: Request) {
  const admin = await platformAdmin();
  if (admin instanceof NextResponse) return admin;
  const config = cloudinaryConfig();
  if (!config) return NextResponse.json({ error: "Cloudinary keys are missing from this site's .env.local." }, { status: 500 });

  const body = (await req.json().catch(() => ({}))) as { public_id?: unknown; resource_type?: unknown; bytes?: unknown; name?: unknown };
  const publicId = typeof body.public_id === "string" ? body.public_id : "";
  const kind = body.resource_type === "video" ? "video" : body.resource_type === "image" ? "image" : null;
  if (!kind || !publicId.startsWith(`${SHARED_FOLDER}/`) || !/^[\w/-]+$/.test(publicId)) {
    return NextResponse.json({ error: "That upload isn't in the shared folder." }, { status: 400 });
  }
  const name = typeof body.name === "string" ? body.name.trim().slice(0, 60) : "";

  const supabase = await supabaseServer();
  const { data, error } = await supabase
    .from("backgrounds")
    .insert({
      church_id: null,
      kind,
      name,
      public_id: publicId,
      url: deliveryUrl(config.cloudName, kind, publicId),
      bytes: typeof body.bytes === "number" ? Math.round(body.bytes) : 0,
      created_by: admin.id,
    })
    .select("id, kind, url, name, bytes, created_at")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data);
}
