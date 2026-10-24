"use client";

import { FileUp, GitCompare, LoaderCircle, Music, Pencil, Plus, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { memo, useEffect, useMemo, useRef, useState } from "react";
import { confirmDialog } from "@/components/confirm";
import { Dropdown } from "@/components/dropdown";
import { PageHead, SearchBox } from "@/components/page-head";
import { SongEditor, type SongFields } from "@/components/song-editor";
import { Button, Chip, IconButton, Notice } from "@/components/ui";
import { cleanSlides } from "@/lib/songs/cleanup";
import { firstLine, pairSingleLines, songBody, type SongSlide } from "@/lib/songs/songs";
import { alreadyIn, nearCopies, notSongReason } from "@/lib/songs/review";
import { LockedSongbookError, readSongbookFile, type ImportedSong, type SongbookRead } from "@/lib/songs/videopsalm";
import { supabaseBrowser } from "@/lib/supabase/client";
import { useLeaveWarning } from "@/lib/use-leave-warning";
import { ReviewPanel, type SongReview } from "./review";

export interface SharedSong {
  id: string;
  title: string;
  author: string;
  firstLine: string;
  source: string;
  /** The churches that have it in their library. */
  churches: string[];
}

type Which = "all" | "used" | "unused";
const WHICH: { value: Which; label: string }[] = [
  { value: "all", label: "All" },
  { value: "used", label: "In a church's library" },
  { value: "unused", label: "In none" },
];

interface FullSong extends SongFields {
  id: string;
}

type Pane = { kind: "empty" } | { kind: "view"; id: string } | { kind: "edit"; song: FullSong | null } | { kind: "import" } | { kind: "review" };

const SHOWN = 300;
const fold = (s: string) =>
  s
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase();

export function Lyrics({ songs, reviews }: { songs: SharedSong[]; reviews: SongReview[] }) {
  const router = useRouter();
  const [pane, setPane] = useState<Pane>({ kind: "empty" });
  const [query, setQuery] = useState("");
  const [lyricHits, setLyricHits] = useState<Set<string> | null>(null);
  const [which, setWhich] = useState<Which>("all");
  const shown = useMemo(() => (which === "all" ? songs : songs.filter((s) => (which === "used") === s.churches.length > 0)), [songs, which]);
  const used = songs.filter((s) => s.churches.length > 0).length;

  const folded = useMemo(() => shown.map((s) => ({ s, key: fold(`${s.title} ${s.author} ${s.firstLine} ${s.churches.join(" ")}`) })), [shown]);

  // Titles here as you type; every song's words on the server after a pause.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 3) {
      setLyricHits(null);
      return;
    }
    const t = setTimeout(async () => {
      const pattern = `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
      const { data } = await supabaseBrowser().from("songs").select("id").ilike("body", pattern).limit(300);
      setLyricHits(new Set((data ?? []).map((r) => r.id as string)));
    }, 250);
    return () => clearTimeout(t);
  }, [query]);

  const matches = useMemo(() => {
    const q = fold(query.trim());
    if (!q) return shown;
    return folded.filter(({ s, key }) => key.includes(q) || lyricHits?.has(s.id)).map(({ s }) => s);
  }, [folded, shown, query, lyricHits]);

  async function save(fields: SongFields, existing: FullSong | null): Promise<string | void> {
    const row = { ...fields, body: songBody(fields.slides), first_line: firstLine(fields.slides), updated_at: new Date().toISOString() };
    const supabase = supabaseBrowser();
    const { data, error } = existing
      ? await supabase.from("songs").update(row).eq("id", existing.id).select("id").single()
      : await supabase.from("songs").insert({ ...row, church_id: null, source: "manual" }).select("id").single();
    if (error || !data) return error?.message ?? "Could not save the song.";
    songCache.delete(data.id);
    setPane({ kind: "view", id: data.id });
    router.refresh();
  }

  const selectedId = pane.kind === "view" ? pane.id : pane.kind === "edit" ? pane.song?.id : undefined;

  return (
    <div className="space-y-4">
      <PageHead
        title="Lyrics"
        description={`${songs.length.toLocaleString()} ${songs.length === 1 ? "song" : "songs"} in ReedArk, each once; ${used.toLocaleString()} in at least one church's library. Detection listens for every song; churches add the ones they sing.`}
        right={
          <div className="flex gap-2">
            <Button variant={reviews.length ? "primary" : "secondary"} onClick={() => setPane({ kind: "review" })}>
              <GitCompare size={15} /> Review{reviews.length ? ` (${reviews.length})` : ""}
            </Button>
            <Button variant="secondary" onClick={() => setPane({ kind: "import" })}>
              <FileUp size={15} /> Import from VideoPsalm
            </Button>
            <Button onClick={() => setPane({ kind: "edit", song: null })}>
              <Plus size={15} /> Add song
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 lg:h-[calc(100dvh-13rem)] lg:min-h-[520px] lg:grid-cols-[minmax(280px,380px)_minmax(0,1fr)]">
        <aside className="flex min-h-[420px] flex-col rounded-lg bg-surface lg:min-h-0">
          <div className="space-y-2 p-3">
            <SearchBox value={query} onChange={setQuery} placeholder="Search titles, lyrics and churches" />
            <div className="inline-flex rounded-full bg-surface-2 p-0.5" role="group" aria-label="Which songs">
              {WHICH.map((w) => (
                <button
                  key={w.value}
                  type="button"
                  aria-pressed={which === w.value}
                  onClick={() => setWhich(w.value)}
                  className={`h-7 rounded-full px-3 text-xs font-bold transition ${which === w.value ? "bg-bg text-ink shadow-card" : "text-muted hover:text-ink"}`}
                >
                  {w.label}
                </button>
              ))}
            </div>
          </div>
          <ol className="min-h-0 flex-1 overflow-y-auto px-1.5 pb-2">
            {matches.slice(0, SHOWN).map((s) => (
              <Row key={s.id} song={s} active={s.id === selectedId} onOpen={() => setPane({ kind: "view", id: s.id })} />
            ))}
            {matches.length > SHOWN && <li className="px-3 py-3 text-center text-xs text-muted">{(matches.length - SHOWN).toLocaleString()} more. Search to narrow the list.</li>}
            {songs.length > 0 && matches.length === 0 && <li className="px-3 py-8 text-center text-sm text-muted">No songs match.</li>}
            {shown.length === 0 && <li className="px-4 py-10 text-center text-sm text-muted">No songs here yet.</li>}
          </ol>
        </aside>

        <section className="flex min-h-[420px] flex-col overflow-hidden rounded-lg bg-surface lg:min-h-0">
          {pane.kind === "view" && (
            <SongView
              key={pane.id}
              id={pane.id}
              churches={songs.find((s) => s.id === pane.id)?.churches ?? []}
              onEdit={(song) => setPane({ kind: "edit", song })}
              onDeleted={() => {
                setPane({ kind: "empty" });
                router.refresh();
              }}
            />
          )}
          {pane.kind === "edit" && (
            <SongEditor
              key={pane.song?.id ?? "new"}
              initial={pane.song}
              heading={pane.song ? "Edit song" : "Add a song"}
              onCancel={() => setPane(pane.song ? { kind: "view", id: pane.song.id } : { kind: "empty" })}
              onSave={(f) => save(f, pane.song)}
            />
          )}
          {pane.kind === "import" && <ImportPanel onClose={() => setPane({ kind: "empty" })} onDone={() => router.refresh()} />}
          {pane.kind === "review" && <ReviewPanel reviews={reviews} onClose={() => setPane({ kind: "empty" })} onResolved={() => router.refresh()} />}
          {pane.kind === "empty" && (
            <div className="grid flex-1 place-items-center px-6 text-center">
              <div>
                <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-surface-2 text-muted">
                  <Music size={24} />
                </span>
                <p className="mt-4 font-bold">Pick a song</p>
                <p className="mt-0.5 text-sm text-muted">Search by title or any line.</p>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

const Row = memo(function Row({ song, active, onOpen }: { song: SharedSong; active: boolean; onOpen: () => void }) {
  return (
    <li>
      <button type="button" onClick={onOpen} className={`block w-full rounded-md px-3 py-2 text-left transition ${active ? "bg-surface-3" : "hover:bg-surface-2"}`}>
        <span className="flex items-center gap-2">
          <span className="min-w-0 flex-1 truncate text-[15px] font-semibold">{song.title}</span>
          {song.churches.length > 0 && (
            <span className="max-w-32 shrink-0 truncate text-[10px] font-bold tracking-wider text-faint uppercase" title={song.churches.join(", ")}>
              {song.churches.length === 1 ? song.churches[0] : `${song.churches.length} churches`}
            </span>
          )}
        </span>
        <span className="block truncate text-xs text-muted">{song.firstLine || song.author || " "}</span>
      </button>
    </li>
  );
});

// ---------------------------------------------------------------------------

const songCache = new Map<string, Promise<FullSong | null>>();
function loadSong(id: string): Promise<FullSong | null> {
  let p = songCache.get(id);
  if (!p) {
    p = Promise.resolve(supabaseBrowser().from("songs").select("id, title, author, copyright, ccli_number, slides").eq("id", id).maybeSingle()).then(
      ({ data }) => (data as FullSong | null) ?? null,
    );
    songCache.set(id, p);
  }
  return p;
}

/** `churches`: the churches that have it in their library. */
function SongView({ id, churches, onEdit, onDeleted }: { id: string; churches: string[]; onEdit: (s: FullSong) => void; onDeleted: () => void }) {
  const [song, setSong] = useState<FullSong | null | undefined>(undefined);
  const [deleting, setDeleting] = useState(false);
  useEffect(() => {
    let live = true;
    loadSong(id).then((s) => live && setSong(s));
    return () => {
      live = false;
    };
  }, [id]);

  async function remove() {
    if (!song) return;
    const ok = await confirmDialog({
      title: `Delete "${song.title}"?`,
      body: churches.length
        ? `It's removed from ReedArk and from the libraries of ${churches.join(", ")}. This can't be undone.`
        : "It's removed from ReedArk. This can't be undone.",
      confirmLabel: "Delete",
      danger: true,
    });
    if (!ok) return;
    setDeleting(true);
    await supabaseBrowser().from("songs").delete().eq("id", song.id);
    songCache.delete(song.id);
    onDeleted();
  }

  if (song === undefined) {
    return (
      <div className="grid flex-1 place-items-center">
        <LoaderCircle size={20} className="animate-spin text-faint" />
      </div>
    );
  }
  if (song === null) return <p className="p-6 text-sm text-muted">This song no longer exists.</p>;

  return (
    <>
      <div className="flex shrink-0 flex-wrap items-start gap-3 border-b border-line px-5 py-4">
        <div className="min-w-0 flex-1">
          <h2 className="text-xl leading-tight font-bold">{song.title}</h2>
          <p className="mt-1 text-sm text-muted">{[song.author, song.ccli_number && `CCLI ${song.ccli_number}`, `${song.slides.length} slides`].filter(Boolean).join(" · ")}</p>
          {song.copyright && <p className="mt-0.5 text-xs text-faint">{song.copyright}</p>}
          <p className="mt-1.5 text-xs text-muted">{churches.length ? `In the library of ${churches.join(", ")}` : "In no church's library yet"}</p>
        </div>
        <Button variant="secondary" size="sm" onClick={() => onEdit(song)}>
          <Pencil size={13} /> Edit
        </Button>
        <IconButton label="Delete song" onClick={remove} disabled={deleting} className="hover:text-negative">
          {deleting ? <LoaderCircle size={16} className="animate-spin" /> : <Trash2 size={16} />}
        </IconButton>
      </div>
      <ol className="grid min-h-0 flex-1 auto-rows-min grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-2 overflow-y-auto p-4">
        {song.slides.map((s, i) => (
          <li key={i} className="flex flex-col rounded-lg bg-surface-2 p-3">
            <span className="mb-1.5 flex items-center gap-2 text-[11px] font-bold text-faint">
              {i + 1}
              {s.label && <Chip tone={s.label === "Chorus" ? "ok" : "neutral"}>{s.label}</Chip>}
            </span>
            <p className="text-sm leading-snug whitespace-pre-line">{s.text}</p>
          </li>
        ))}
      </ol>
    </>
  );
}

// ---------------------------------------------------------------------------
// VideoPsalm import, into the public library. After the files are read, a
// review: what isn't a song and which songs are near-copies start unticked,
// each with its reason, and anything can be ticked or unticked by hand.

const BATCH = 400;
const REVIEW_SHOWN = 300;

interface ReviewItem {
  song: ImportedSong;
  book: string;
  /** Why it isn't a song, if it looks like one of those. */
  notSong: string | null;
  /** The fuller version this is a near-copy of. */
  copyOf: string | null;
  /** The public library song it's already there as (perhaps with small changes). */
  inLibrary: string | null;
  /** …and that public song's id, for copying it into a church's library. */
  libraryId: string | null;
  include: boolean;
}

type ReviewView = "import" | "not-songs" | "library" | "copies";

const PAGE = 1000;

/** Every public library song's title and words, to check an import against. */
async function publicLibrary(): Promise<{ id: string; title: string; body: string }[]> {
  const supabase = supabaseBrowser();
  const out: { id: string; title: string; body: string }[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase.from("songs").select("id, title, body").is("church_id", null).order("id").range(from, from + PAGE - 1);
    if (error) throw error;
    out.push(...((data ?? []) as { id: string; title: string; body: string }[]));
    if (!data || data.length < PAGE) return out;
  }
}

function ImportPanel({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [books, setBooks] = useState<SongbookRead[]>([]);
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [problems, setProblems] = useState<string[]>([]);
  const [reading, setReading] = useState(false);
  const [pair, setPair] = useState(true);
  // A church to also get these songs in its own library (its songbook being imported).
  const [churches, setChurches] = useState<{ id: string; name: string }[]>([]);
  const [forChurch, setForChurch] = useState("");
  useEffect(() => {
    void supabaseBrowser()
      .rpc("admin_churches")
      .then(({ data }) => setChurches(((data ?? []) as { id: string; name: string }[]).sort((a, b) => a.name.localeCompare(b.name))));
  }, []);
  const [view, setView] = useState<ReviewView>("import");
  const [query, setQuery] = useState("");
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [result, setResult] = useState<{ added: number; skipped: number; toChurch: number; church: string | null } | null>(null);
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);
  // Ask before a refresh or close cuts off the import.
  useLeaveWarning(progress !== null);

  async function read(list: FileList | File[]) {
    const files = [...list];
    if (!files.length) return;
    setReading(true);
    setResult(null);
    setError("");
    const ok: SongbookRead[] = [];
    const issues: string[] = [];
    for (const f of files) {
      try {
        ok.push(await readSongbookFile(f.name, new Uint8Array(await f.arrayBuffer())));
      } catch (e) {
        issues.push(e instanceof LockedSongbookError ? e.message : `${f.name}: ${e instanceof Error ? e.message : "could not be read"}`);
      }
    }
    // Review across every file at once, so a song in two books counts once.
    const all = ok.flatMap((b) => b.songs.map((song) => ({ song, book: b.name })));
    const keep = nearCopies(all.map((x) => x.song));
    // Songs the public library has already, saved again with small changes.
    let there: ({ id: string; title: string } | null)[] = all.map(() => null);
    try {
      there = alreadyIn(
        all.map((x) => x.song),
        await publicLibrary(),
      );
    } catch {
      issues.push("Couldn't check which songs the library has already. Exact repeats are still skipped.");
    }
    setItems(
      all.map(({ song, book }, i) => {
        const notSong = notSongReason(song);
        const match = notSong ? null : there[i];
        const inLibrary = match?.title ?? null;
        const libraryId = match?.id ?? null;
        const copyOf = keep[i] !== i ? all[keep[i]].song.title : null;
        return { song, book, notSong, copyOf, inLibrary, libraryId, include: !notSong && !copyOf && !inLibrary };
      }),
    );
    setBooks(ok);
    setProblems(issues);
    setView("import");
    setQuery("");
    setReading(false);
  }

  const counts = useMemo(
    () => ({
      import: items.filter((x) => x.include).length,
      notSongs: items.filter((x) => x.notSong).length,
      library: items.filter((x) => !x.notSong && x.inLibrary).length,
      copies: items.filter((x) => !x.notSong && !x.inLibrary && x.copyOf).length,
    }),
    [items],
  );

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items
      .map((x, i) => ({ x, i }))
      .filter(({ x }) =>
        view === "import" ? x.include : view === "not-songs" ? !!x.notSong : view === "library" ? !x.notSong && !!x.inLibrary : !x.notSong && !x.inLibrary && !!x.copyOf,
      )
      .filter(({ x }) => !q || x.song.title.toLowerCase().includes(q) || x.song.slides.some((s) => s.text.toLowerCase().includes(q)));
  }, [items, view, query]);

  const toggle = (i: number) => setItems((all) => all.map((x, j) => (j === i ? { ...x, include: !x.include } : x)));

  const chosen = items.filter((x) => x.include).map((x) => x.song);
  const slidesBefore = chosen.reduce((n, s) => n + s.slides.length, 0);
  const slidesAfter = useMemo(() => chosen.reduce((n, s) => n + pairSingleLines(s.slides).length, 0), [chosen]);

  async function run() {
    setError("");
    setResult(null);
    const rows = chosen.map((s) => {
      // Headings typed as lyrics become labels; crammed slides are split.
      const slides: SongSlide[] = cleanSlides(pair ? pairSingleLines(s.slides) : s.slides);
      return {
        church_id: null,
        source: "videopsalm" as const,
        title: s.title,
        author: s.author,
        copyright: s.copyright,
        slides,
        body: songBody(slides),
        first_line: firstLine(slides),
        // The original's fingerprint: importing the same book again adds nothing.
        fingerprint: s.fingerprint,
      };
    });
    let added = 0;
    setProgress({ done: 0, total: rows.length });
    const supabase = supabaseBrowser();
    for (let i = 0; i < rows.length; i += BATCH) {
      const { data, error } = await supabase.from("songs").upsert(rows.slice(i, i + BATCH), { onConflict: "library,fingerprint", ignoreDuplicates: true }).select("id");
      if (error) {
        setProgress(null);
        setError(`Stopped after ${added.toLocaleString()} songs: ${error.message}`);
        if (added) onDone();
        return;
      }
      added += data?.length ?? 0;
      setProgress({ done: Math.min(i + BATCH, rows.length), total: rows.length });
    }
    // The church's copies: the songs just imported (or there already with the
    // same fingerprint), and the ones the library had under other words.
    let toChurch = 0;
    if (forChurch) {
      const ids = new Set(items.filter((x) => x.libraryId && !x.notSong).map((x) => x.libraryId!));
      const prints = rows.map((r) => r.fingerprint).filter((f): f is string => !!f);
      for (let i = 0; i < prints.length; i += BATCH) {
        const { data } = await supabase.from("songs").select("id").is("church_id", null).in("fingerprint", prints.slice(i, i + BATCH));
        for (const r of data ?? []) ids.add(r.id as string);
      }
      const all = [...ids];
      for (let i = 0; i < all.length; i += BATCH) {
        const { data, error } = await supabase.rpc("admin_tag_church", { p_church: forChurch, p_songs: all.slice(i, i + BATCH) });
        if (error) {
          setProgress(null);
          setError(/admin_tag_church/.test(error.message) ? "Adding to the church needs migration 0037." : error.message);
          onDone();
          return;
        }
        toChurch += Number(data ?? 0);
      }
    }
    setProgress(null);
    setResult({ added, skipped: rows.length - added, toChurch, church: churches.find((c) => c.id === forChurch)?.name ?? null });
    setBooks([]);
    setItems([]);
    onDone();
  }

  const busy = reading || progress !== null;
  const VIEWS: { id: ReviewView; label: string; n: number }[] = [
    { id: "import", label: "Will import", n: counts.import },
    { id: "not-songs", label: "Not songs", n: counts.notSongs },
    { id: "library", label: "Already in the library", n: counts.library },
    { id: "copies", label: "Near-copies", n: counts.copies },
  ];

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center gap-3 border-b border-line px-5 py-4">
        <div className="flex-1">
          <h2 className="text-xl font-bold">Import from VideoPsalm</h2>
          <p className="text-sm text-muted">Into the public library: churches can find these songs and copy them.</p>
        </div>
        <IconButton label="Close" onClick={onClose} disabled={progress !== null}>
          <X size={18} />
        </IconButton>
      </div>
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
        {items.length === 0 && (
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              if (!busy) void read(e.dataTransfer.files);
            }}
            className={`flex flex-col items-center rounded-lg border-2 border-dashed px-4 py-7 text-center transition ${dragging ? "border-accent bg-accent-fill/5" : "border-line-strong"}`}
          >
            <FileUp size={22} className="text-muted" />
            <p className="mt-2 text-sm font-bold">Drop songbook files here</p>
            <p className="mt-0.5 max-w-md text-xs text-muted">From VideoPsalm&apos;s SongBooks folder: .json files and unlocked .vpc files. Several at once is fine.</p>
            <Button type="button" variant="secondary" size="sm" className="mt-3" loading={reading} disabled={busy} onClick={() => input.current?.click()}>
              Choose files
            </Button>
            <input
              ref={input}
              type="file"
              multiple
              accept=".json,.vpc"
              className="hidden"
              onChange={(e) => {
                if (e.target.files) void read(e.target.files);
                e.target.value = "";
              }}
            />
          </div>
        )}

        {problems.map((p) => (
          <Notice key={p} tone="error">
            {p}
          </Notice>
        ))}

        {items.length > 0 && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="min-w-0 flex-1 font-semibold">{books.map((b) => b.name).join(", ")}</span>
              {books.some((b) => b.duplicates) && <Chip>{books.reduce((n, b) => n + b.duplicates, 0).toLocaleString()} exact duplicates dropped</Chip>}
              {books.some((b) => b.empty) && <Chip>{books.reduce((n, b) => n + b.empty, 0)} empty dropped</Chip>}
              <Button
                variant="outline"
                size="sm"
                disabled={busy}
                onClick={() => {
                  setItems([]);
                  setBooks([]);
                }}
              >
                Start over
              </Button>
            </div>

            {/* Review */}
            <div className="flex flex-wrap items-center gap-1.5">
              {VIEWS.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => setView(v.id)}
                  className={`h-8 rounded-full px-3.5 text-sm transition ${view === v.id ? "bg-ink font-bold text-bg" : "bg-surface-2 text-muted hover:text-ink"}`}
                >
                  {v.label} <span className="tabular-nums">{v.n.toLocaleString()}</span>
                </button>
              ))}
              <div className="ml-auto w-full sm:w-60">
                <SearchBox value={query} onChange={setQuery} placeholder="Search these songs" />
              </div>
            </div>
            <p className="text-xs text-muted">
              {view === "import"
                ? "Untick anything that shouldn't go in."
                : view === "not-songs"
                  ? "Announcements, account numbers, introductions, notes and dated service sets. Skipped unless you tick them."
                  : view === "library"
                    ? "Already in the public library, perhaps with small changes. Skipped unless you tick them; ticked, they go in as another copy."
                  : "Saved more than once with small edits. The fullest version is in “Will import”; tick another to keep it too."}
            </p>
            <ul className="max-h-[420px] divide-y divide-line overflow-y-auto rounded-lg bg-surface-2">
              {shown.slice(0, REVIEW_SHOWN).map(({ x, i }) => (
                <li key={i}>
                  <label className="flex cursor-pointer items-start gap-3 px-4 py-2.5 text-sm hover:bg-surface-3">
                    <input type="checkbox" checked={x.include} onChange={() => toggle(i)} className="mt-1 h-4 w-4 shrink-0 accent-[var(--color-accent-fill)]" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">{x.song.title}</span>
                      <span className="block truncate text-xs text-muted">{firstLine(x.song.slides)}</span>
                      {x.notSong && <span className="mt-0.5 block text-xs text-warning">{x.notSong}</span>}
                      {!x.notSong && x.inLibrary && <span className="mt-0.5 block text-xs text-faint">Already in the library as “{x.inLibrary}”</span>}
                      {!x.notSong && !x.inLibrary && x.copyOf && <span className="mt-0.5 block text-xs text-faint">Near-copy of “{x.copyOf}”</span>}
                    </span>
                    <span className="shrink-0 text-xs text-faint tabular-nums">{x.song.slides.length} slides</span>
                  </label>
                </li>
              ))}
              {shown.length === 0 && <li className="px-4 py-6 text-center text-sm text-muted">Nothing here.</li>}
              {shown.length > REVIEW_SHOWN && (
                <li className="px-4 py-3 text-center text-xs text-muted">{(shown.length - REVIEW_SHOWN).toLocaleString()} more. Search to find a song.</li>
              )}
            </ul>

            <label className="flex items-start gap-2.5 rounded-lg bg-surface-2 px-4 py-3 text-sm">
              <input type="checkbox" checked={pair} onChange={(e) => setPair(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--color-accent-fill)]" />
              <span>
                <span className="font-bold">Put two lines on each slide</span>
                <span className="mt-0.5 block text-muted">
                  Joins one-line slides in pairs: {slidesBefore.toLocaleString()} slides become {slidesAfter.toLocaleString()}. Untick to keep VideoPsalm&apos;s slides exactly.
                </span>
              </span>
            </label>
            <div className="flex flex-wrap items-center gap-3 rounded-lg bg-surface-2 px-4 py-3 text-sm">
              <span className="min-w-0 flex-1">
                <span className="block font-bold">Also add to a church&apos;s library</span>
                <span className="mt-0.5 block text-muted">
                  Its songbook: the songs go in its library, the new ones and the ones ReedArk had already. No copies of the words.
                </span>
              </span>
              <Dropdown
                ariaLabel="Church"
                searchable
                value={forChurch}
                onChange={setForChurch}
                options={[{ value: "", label: "No church" }, ...churches.map((c) => ({ value: c.id, label: c.name }))]}
                className="h-10 w-64 text-sm"
              />
            </div>
            <Button onClick={() => void run()} loading={progress !== null} disabled={!counts.import && !forChurch}>
              {progress ? `Importing ${progress.done.toLocaleString()} of ${progress.total.toLocaleString()}` : `Import ${counts.import.toLocaleString()} songs`}
            </Button>
          </div>
        )}

        {error && <Notice tone="error">{error}</Notice>}
        {result && (
          <Notice tone="ok">
            Added {result.added.toLocaleString()} {result.added === 1 ? "song" : "songs"} to ReedArk.
            {result.skipped > 0 && ` ${result.skipped.toLocaleString()} were already there.`}
            {result.church && ` ${result.toChurch.toLocaleString()} added to ${result.church}'s library.`}
          </Notice>
        )}
      </div>
    </div>
  );
}
