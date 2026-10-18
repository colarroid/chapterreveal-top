import { NextResponse } from "next/server";
import { BUILT_IN_TRANSLATIONS } from "@/lib/scripture/translations";
import { getAdmin, supabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const BUILT_IN_IDS = new Set(BUILT_IN_TRANSLATIONS.map((t) => t.id));

// A Bible for the Translations page's reader.
//  - Built-in: fetched from the main app by this server. The browser can't
//    fetch it from the main app directly when that domain redirects
//    (reedark.com -> www.reedark.com): the redirect carries no cross-site
//    permission. A server follows redirects without that check.
//  - Added (licensed, ?v=<version>): read from the private bucket with the
//    platform admin's own sign-in. Platform admins only.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  if (BUILT_IN_IDS.has(id)) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL;
    if (!appUrl) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const res = await fetch(`${appUrl.replace(/\/+$/, "")}/bibles/${id}.json`, { cache: "no-store" });
    if (!res.ok || !res.body) return NextResponse.json({ error: `The main app answered ${res.status}` }, { status: 502 });
    return new NextResponse(res.body, {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        // Built-in Bibles don't change under the same name; the CDN keeps a copy.
        "Cache-Control": "public, max-age=86400, s-maxage=604800, stale-while-revalidate=2592000",
      },
    });
  }

  if (!(await getAdmin())) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const version = Number(new URL(req.url).searchParams.get("v"));
  if (!/^[a-z0-9][a-z0-9-]{1,15}$/.test(id) || !Number.isInteger(version) || version < 1) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const supabase = await supabaseServer();
  const { data, error } = await supabase.storage.from("bibles").download(`${id}/v${version}.json`);
  if (error || !data) return NextResponse.json({ error: "Not found" }, { status: 404 });
  // Licensed text: never kept by a shared cache.
  return new NextResponse(data, { headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "private, no-store" } });
}
