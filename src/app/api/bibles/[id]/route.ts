import { NextResponse } from "next/server";
import { BUILT_IN_TRANSLATIONS } from "@/lib/scripture/translations";

export const dynamic = "force-dynamic";

const BUILT_IN_IDS = new Set(BUILT_IN_TRANSLATIONS.map((t) => t.id));

// A built-in Bible for the Translations page's reader, fetched from the main
// app by this server. The browser can't fetch it from the main app directly
// when that domain redirects (reedark.com -> www.reedark.com): the redirect
// carries no cross-site permission, so the browser blocks it. A server
// follows redirects without that check. Only built-in IDs, so this can't be
// used to fetch anything else.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!BUILT_IN_IDS.has(id) || !appUrl) return NextResponse.json({ error: "Not found" }, { status: 404 });

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
