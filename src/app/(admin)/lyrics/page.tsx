import { Notice } from "@/components/ui";
import { supabaseServer } from "@/lib/supabase/server";
import { Lyrics, type SharedSong } from "./lyrics";

export const metadata = { title: "Lyrics" };

const PAGE = 1000;

// The shared song library every church sees. Churches' own songs aren't here.
export default async function LyricsPage() {
  const supabase = await supabaseServer();
  const songs: SharedSong[] = [];
  let error: string | null = null;
  for (let from = 0; ; from += PAGE) {
    const { data, error: e } = await supabase
      .from("songs")
      .select("id, title, author, first_line, source")
      .is("church_id", null)
      .order("title")
      .range(from, from + PAGE - 1);
    if (e) {
      error = e.message;
      break;
    }
    for (const r of data ?? []) songs.push({ id: r.id, title: r.title, author: r.author, firstLine: r.first_line, source: r.source });
    if (!data || data.length < PAGE) break;
  }

  return (
    <main className="w-full px-4 py-8 sm:px-8">
      {error ? <Notice tone="error">Could not load songs: {error}. Has migration 0008 been run?</Notice> : <Lyrics songs={songs} />}
    </main>
  );
}
