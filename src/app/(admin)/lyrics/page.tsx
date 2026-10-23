import { Notice } from "@/components/ui";
import { supabaseServer } from "@/lib/supabase/server";
import { Lyrics, type SharedSong } from "./lyrics";
import type { SongReview } from "./review";

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

  // Church songs that look like a public one, for an admin to settle (migration 0032; none before it).
  const { data: open } = await supabase
    .from("song_reviews")
    .select("id, church_song_id, public_song_id, church_id, similarity")
    .is("resolved_at", null)
    .order("created_at");
  const reviews: SongReview[] = (open ?? []).map((r) => ({
    id: r.id,
    churchSongId: r.church_song_id,
    publicSongId: r.public_song_id,
    church: names.get(r.church_id) ?? "A church",
    similarity: r.similarity,
  }));

  return (
    <main className="w-full px-4 py-8 sm:px-8">
      {error ? <Notice tone="error">Could not load songs: {error}. Has migration 0008 been run?</Notice> : <Lyrics songs={songs} reviews={reviews} />}
    </main>
  );
}
