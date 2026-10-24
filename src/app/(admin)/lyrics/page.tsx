import { Notice } from "@/components/ui";
import { supabaseServer } from "@/lib/supabase/server";
import { Lyrics, type SharedSong } from "./lyrics";
import type { SongReview } from "./review";

export const metadata = { title: "Lyrics" };

const PAGE = 1000;

// The song library: every song once (migration 0037), with the churches
// that have it in their library (church_songs), and what's waiting in Review.
export default async function LyricsPage() {
  const supabase = await supabaseServer();
  const { data: churches } = await supabase.rpc("admin_churches");
  const names = new Map(((churches ?? []) as { id: string; name: string }[]).map((c) => [c.id, c.name]));

  // Which churches have each song.
  const tagged = new Map<string, string[]>();
  for (let from = 0; ; from += PAGE) {
    const { data, error: e } = await supabase.from("church_songs").select("song_id, church_id").order("song_id").range(from, from + PAGE - 1);
    if (e) break; // before 0037: no tags yet
    for (const r of data ?? []) tagged.set(r.song_id, [...(tagged.get(r.song_id) ?? []), names.get(r.church_id) ?? "A church"]);
    if (!data || data.length < PAGE) break;
  }

  const songs: SharedSong[] = [];
  let error: string | null = null;
  for (let from = 0; ; from += PAGE) {
    const { data, error: e } = await supabase.from("songs").select("id, title, author, first_line, source").order("title").order("id").range(from, from + PAGE - 1);
    if (e) {
      error = e.message;
      break;
    }
    for (const r of data ?? []) {
      songs.push({ id: r.id, title: r.title, author: r.author, firstLine: r.first_line, source: r.source, churches: (tagged.get(r.id) ?? []).sort() });
    }
    if (!data || data.length < PAGE) break;
  }

  // Duplicates to merge and suggested corrections (migration 0037; none before it).
  const { data: open } = await supabase
    .from("song_reviews")
    .select("id, kind, song_id, other_song_id, church_id, similarity, proposed")
    .is("resolved_at", null)
    .order("created_at");
  const reviews: SongReview[] = (open ?? []).map((r) => ({
    id: r.id,
    kind: r.kind,
    songId: r.song_id,
    otherSongId: r.other_song_id,
    church: r.church_id ? (names.get(r.church_id) ?? "A church") : "A church",
    similarity: r.similarity,
    proposed: r.proposed,
  }));

  return (
    <main className="w-full px-4 py-8 sm:px-8">
      {error ? <Notice tone="error">Could not load songs: {error}.</Notice> : <Lyrics songs={songs} reviews={reviews} />}
    </main>
  );
}
