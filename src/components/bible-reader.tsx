"use client";

import { ArrowUp, BookOpen, ChevronLeft, ChevronRight, LoaderCircle, Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Dropdown } from "@/components/dropdown";
import { IconButton } from "@/components/ui";
import { formatRef, parseSearch, type BibleShape, type VerseRef } from "@/lib/scripture/parser";

// The Bible sidebar from the main app's console, as a reader: pick any
// translation (unpublished ones too, to check an upload before publishing),
// find a verse, browse its chapter.

export interface ReaderTranslation {
  id: string;
  short: string;
  name: string;
  url: string;
  hidden?: boolean;
}

interface Text {
  books: string[][][];
}

const cache = new Map<string, Promise<Text>>();
function load(url: string): Promise<Text> {
  let p = cache.get(url);
  if (!p) {
    // Always checks with the server (a quick 304 when unchanged). A copy the
    // browser kept from the main app, from before it allowed other sites to
    // read these files, would otherwise be refused here.
    p = fetch(url, { cache: "no-cache" }).then((r) => {
      if (!r.ok) throw new Error(String(r.status));
      return r.json() as Promise<Text>;
    });
    p.catch(() => cache.delete(url));
    cache.set(url, p);
  }
  return p;
}

const shapeOf = (t: Text): BibleShape => ({
  chapters: (b) => t.books[b]?.length ?? 0,
  verses: (b, c) => t.books[b]?.[c - 1]?.length ?? 0,
});

export function BibleReader({ translations }: { translations: ReaderTranslation[] }) {
  const [id, setId] = useState(translations[0]?.id ?? "");
  const [bible, setBible] = useState<Text | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [browse, setBrowse] = useState<{ book: number; chapter: number } | null>(null);
  const [picked, setPicked] = useState<VerseRef | null>(null);

  const current = translations.find((t) => t.id === id) ?? translations[0];
  useEffect(() => {
    if (!current) return;
    let cancelled = false;
    setLoading(true);
    setError("");
    load(current.url).then(
      (t) => {
        if (cancelled) return;
        setBible(t);
        setLoading(false);
      },
      () => {
        if (cancelled) return;
        setError(`Could not load ${current.short}.`);
        setLoading(false);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [current]);

  const ref = useMemo(() => (bible && query.trim() ? parseSearch(query, shapeOf(bible), browse ?? {}) : null), [bible, query, browse]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!ref) return;
    setBrowse({ book: ref.book, chapter: ref.chapter });
    setPicked(ref.verseStart ? ref : null);
    setQuery("");
  }

  function move(dir: 1 | -1) {
    if (!bible || !browse) return;
    let { book, chapter } = browse;
    chapter += dir;
    if (chapter < 1) {
      if (book === 0) return;
      book -= 1;
      chapter = bible.books[book].length;
    } else if (chapter > (bible.books[book]?.length ?? 0)) {
      if (book >= bible.books.length - 1) return;
      book += 1;
      chapter = 1;
    }
    setBrowse({ book, chapter });
    setPicked(null);
  }

  const preview = ref && bible ? bible.books[ref.book]?.[ref.chapter - 1]?.[(ref.verseStart ?? 1) - 1] : "";

  return (
    <aside className="flex min-h-[460px] flex-col gap-3 rounded-lg bg-surface p-3 lg:sticky lg:top-4 lg:h-[calc(100dvh-6rem)] lg:min-h-0">
      <div className="flex items-center gap-2 px-1 pt-1">
        <h2 className="font-bold">Bible</h2>
        <Dropdown
          ariaLabel="Translation"
          value={id}
          onChange={setId}
          options={translations.map((t) => ({ value: t.id, label: t.short, hint: t.hidden ? `${t.name} (hidden)` : t.name }))}
          icon={loading ? <LoaderCircle size={14} className="animate-spin text-muted" /> : undefined}
          className="ml-auto h-9 w-28 text-sm font-bold"
          align="right"
        />
      </div>

      <form onSubmit={submit} className="inset-field shrink-0 rounded-[26px] bg-surface-2">
        <label className="flex items-center gap-1.5 p-1.5">
          <span className="grid h-9 w-9 shrink-0 place-items-center text-muted">
            <Search size={18} />
          </span>
          <span className="sr-only">Find a verse</span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Find a verse: Jn 3 16, ps 23"
            className="min-w-0 flex-1 bg-transparent py-1.5 text-[15px] outline-none placeholder:text-faint"
            autoComplete="off"
            spellCheck={false}
          />
          <button
            type="submit"
            disabled={!ref}
            aria-label="Open this verse"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent-fill text-on-accent transition hover:scale-105 disabled:bg-surface-3 disabled:text-faint"
          >
            <ArrowUp size={18} />
          </button>
        </label>
        {query.trim() && (
          <div className="border-t border-line p-1.5 text-sm">
            {ref ? (
              <button type="submit" className="flex w-full rounded-[20px] px-3 py-2.5 text-left transition hover:bg-ink/5">
                <p className="line-clamp-2 min-w-0 flex-1">
                  <span className="font-bold text-accent">{formatRef(ref)}</span> <span className="font-serif text-muted">{preview || "Not included in this translation"}</span>
                </p>
              </button>
            ) : (
              <p className="px-3 py-2.5 text-faint">No reference recognised yet.</p>
            )}
          </div>
        )}
      </form>

      {error ? (
        <p className="px-2 text-sm text-negative">{error}</p>
      ) : browse && bible ? (
        <Chapter bible={bible} book={browse.book} chapter={browse.chapter} picked={picked} onPick={setPicked} onMove={move} />
      ) : (
        <div className="flex min-h-[200px] flex-1 flex-col items-center justify-center rounded-lg border border-dashed border-line-strong px-6 text-center lg:min-h-0">
          <BookOpen size={20} className="text-faint" />
          <p className="mt-2 text-sm font-semibold">Search a verse to read its chapter</p>
          <p className="mt-0.5 max-w-60 text-xs leading-snug text-muted">Switch translation above to compare, or to check a new upload.</p>
        </div>
      )}
    </aside>
  );
}

function Chapter({
  bible,
  book,
  chapter,
  picked,
  onPick,
  onMove,
}: {
  bible: Text;
  book: number;
  chapter: number;
  picked: VerseRef | null;
  onPick: (r: VerseRef) => void;
  onMove: (dir: 1 | -1) => void;
}) {
  const verses = bible.books[book]?.[chapter - 1] ?? [];
  const on = (v: number) =>
    !!picked && picked.book === book && picked.chapter === chapter && v >= (picked.verseStart ?? 0) && v <= (picked.verseEnd ?? picked.verseStart ?? 0);
  const list = useRef<HTMLOListElement>(null);
  const first = picked?.book === book && picked.chapter === chapter ? picked.verseStart : undefined;
  useEffect(() => {
    if (first) list.current?.querySelector<HTMLElement>(`[data-verse="${first}"]`)?.scrollIntoView({ block: "nearest" });
    else list.current?.scrollTo({ top: 0 });
  }, [first, book, chapter]);

  return (
    <div className="flex min-h-[200px] flex-1 flex-col overflow-hidden rounded-lg bg-surface-2 lg:min-h-0">
      <div className="flex h-10 shrink-0 items-center gap-2 border-b border-line pr-1.5 pl-4">
        <span className="font-bold">{formatRef({ book, chapter })}</span>
        <IconButton label="Previous chapter" onClick={() => onMove(-1)} className="ml-auto h-8 w-8">
          <ChevronLeft size={17} />
        </IconButton>
        <IconButton label="Next chapter" onClick={() => onMove(1)} className="h-8 w-8">
          <ChevronRight size={17} />
        </IconButton>
      </div>
      <ol ref={list} className="min-h-0 flex-1 overflow-y-auto p-1.5">
        {verses.map((text, i) => {
          const v = i + 1;
          const active = on(v);
          return (
            <li key={v}>
              <button
                type="button"
                data-verse={v}
                onClick={() => onPick({ book, chapter, verseStart: v, verseEnd: v })}
                className={`flex w-full gap-3 rounded-md px-2.5 py-1.5 text-left text-sm leading-snug transition ${
                  active ? "bg-accent-fill/15 text-ink shadow-[inset_0_0_0_1px_var(--accent-fill)]" : "text-muted hover:bg-ink/5 hover:text-ink"
                }`}
              >
                <span className={`w-6 shrink-0 text-right text-xs font-bold tabular-nums ${active ? "text-accent" : "text-faint"}`}>{v}</span>
                {text ? <span className="font-serif">{text}</span> : <span className="text-faint italic">Not included in this translation</span>}
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
