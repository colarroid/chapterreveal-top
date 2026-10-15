import { NextResponse } from "next/server";
import { cloudinaryConfig, sign, SHARED_FOLDER, VIDEO_TRANSFORM } from "@/lib/cloudinary";
import { platformAdmin } from "../admin";

export const dynamic = "force-dynamic";

// A one-off signature so the browser can upload one shared background
// straight to Cloudinary, into the shared folder only.
export async function POST(req: Request) {
  const admin = await platformAdmin();
  if (admin instanceof NextResponse) return admin;
  const config = cloudinaryConfig();
  if (!config) return NextResponse.json({ error: "Cloudinary keys are missing from this site's .env.local." }, { status: 500 });
  const { kind } = (await req.json().catch(() => ({}))) as { kind?: unknown };

  const timestamp = Math.floor(Date.now() / 1000);
  // Videos: Cloudinary prepares the projector copy straight after upload.
  const params: Record<string, string | number> =
    kind === "video" ? { folder: SHARED_FOLDER, timestamp, eager: `${VIDEO_TRANSFORM}/mp4`, eager_async: "true" } : { folder: SHARED_FOLDER, timestamp };
  const fields: Record<string, string> = Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)]));
  return NextResponse.json({
    url: `https://api.cloudinary.com/v1_1/${config.cloudName}/auto/upload`,
    fields: { ...fields, api_key: config.apiKey, signature: sign(params, config.apiSecret) },
  });
}
