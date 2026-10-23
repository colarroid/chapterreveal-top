import { Notice } from "@/components/ui";
import { supabaseServer } from "@/lib/supabase/server";
import { Lyrics, type SharedSong } from "./lyrics";

export const metadata = { title: "Lyrics" };

const PAGE = 1000;

// Every song on the platform: the shared library and every church's own
// (platform admins can read them all once migration 0029 is run), each
// with the church it came from.
export default async function LyricsPage() {
  const supabase = await supabaseServer();
  const { data: churches } = await supabase.rpc("admin_churches");
  const names = new Map(((churches ?? []) as { id: string; name: string }[]).map((c) => [c.id, c.name]));
  const songs: SharedSong[] = [];
  let error: string | null = null;
  for (let from = 0; ; from += PAGE) {
    const { data, error: e } = await supabase
      .from("songs")
      .select("id, title, author, first_line, source, church_id")
      .order("title")
      .order("id")
      .range(from, from + PAGE - 1);
    if (e) {
      error = e.message;
      break;
    }
    for (const r of data ?? []) {
      const church = r.church_id ? (names.get(r.church_id) ?? "A church") : null;
      songs.push({ id: r.id, title: r.title, author: r.author, firstLine: r.first_line, source: r.source, church });
    }
    if (!data || data.length < PAGE) break;
  }

  return (
    <main className="w-full px-4 py-8 sm:px-8">
      {error ? <Notice tone="error">Could not load songs: {error}. Has migration 0008 been run?</Notice> : <Lyrics songs={songs} />}
    </main>
  );
}
