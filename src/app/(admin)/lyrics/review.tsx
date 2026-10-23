"use client";

import { ArrowLeft, ArrowRight, LoaderCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { Button, Chip, IconButton, Notice } from "@/components/ui";
import type { SongSlide } from "@/lib/songs/songs";
import { supabaseBrowser } from "@/lib/supabase/client";

// Songs a church added that look like one already in the public library
// (migration 0032): both side by side, and the admin chooses which is the
// default. Keep the public one, make the church's words the public song's,
// or add the church's as a separate song.

export interface SongReview {
  id: number;
  churchSongId: string;
  publicSongId: string;
  church: string;
  /** How alike their words are, 0 to 1. */
  similarity: number;
}

interface Version {
  title: string;
  author: string;
  slides: SongSlide[];
}

type Choice = "keep" | "replace" | "separate";

async function load(id: string): Promise<Version | null> {
  const { data } = await supabaseBrowser().from("songs").select("title, author, slides").eq("id", id).maybeSingle();
  return (data as Version | null) ?? null;
}

export function ReviewPanel({ reviews, onClose, onResolved }: { reviews: SongReview[]; onClose: () => void; onResolved: () => void }) {
  const [at, setAt] = useState(0);
  const review = reviews[Math.min(at, reviews.length - 1)];
  const [pair, setPair] = useState<{ pub: Version | null; church: Version | null } | null>(null);
  const [busy, setBusy] = useState<Choice | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!review) return;
    let live = true;
    setPair(null);
    void Promise.all([load(review.publicSongId), load(review.churchSongId)]).then(([pub, church]) => live && setPair({ pub, church }));
    return () => {
      live = false;
    };
  }, [review]);

  async function choose(choice: Choice) {
    if (!review) return;
    setBusy(choice);
    setError("");
    const { error: e } = await supabaseBrowser().rpc("resolve_song_review", { p_review: review.id, p_choice: choice });
    setBusy(null);
    if (e) setError(e.message);
    else onResolved();
  }

  if (!review) {
    return (
      <div className="grid flex-1 place-items-center px-6 text-center">
        <div>
          <p className="font-bold">Nothing to review</p>
          <p className="mt-0.5 text-sm text-muted">Songs churches add that look like a public one show up here.</p>
          <Button size="sm" variant="secondary" className="mt-4" onClick={onClose}>
            Back to the songs
          </Button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="flex shrink-0 flex-wrap items-center gap-3 border-b border-line px-5 py-4">
        <div className="min-w-0 flex-1">
          <h2 className="text-xl leading-tight font-bold">Which should be the default?</h2>
          <p className="mt-1 text-sm text-muted">
            {review.church} added a song that looks like one in the public library ({Math.round(review.similarity * 100)}% the same words).
          </p>
        </div>
        <span className="text-sm text-muted tabular-nums">
          {Math.min(at, reviews.length - 1) + 1} of {reviews.length}
        </span>
        <IconButton label="Previous" onClick={() => setAt((i) => Math.max(0, i - 1))} disabled={at === 0}>
          <ArrowLeft size={16} />
        </IconButton>
        <IconButton label="Next" onClick={() => setAt((i) => Math.min(reviews.length - 1, i + 1))} disabled={at >= reviews.length - 1}>
          <ArrowRight size={16} />
        </IconButton>
      </div>

      {!pair ? (
        <div className="grid flex-1 place-items-center">
          <LoaderCircle size={20} className="animate-spin text-faint" />
        </div>
      ) : (
        <div className="grid min-h-0 flex-1 gap-3 overflow-y-auto p-4 md:grid-cols-2">
          <Side heading="Public library (default now)" version={pair.pub} />
          <Side heading={`From ${review.church}`} version={pair.church} />
        </div>
      )}

      <div className="flex shrink-0 flex-wrap items-center gap-2 border-t border-line px-5 py-3">
        <Button size="sm" onClick={() => void choose("keep")} disabled={busy !== null} loading={busy === "keep"}>
          Keep the public version
        </Button>
        <Button size="sm" variant="secondary" onClick={() => void choose("replace")} disabled={busy !== null} loading={busy === "replace"}>
          Use {review.church}&apos;s version
        </Button>
        <Button size="sm" variant="ghost" onClick={() => void choose("separate")} disabled={busy !== null} loading={busy === "separate"}>
          They&apos;re different songs: add it too
        </Button>
        {error && <Notice tone="error">{error}</Notice>}
      </div>
    </>
  );
}

function Side({ heading, version }: { heading: string; version: Version | null }) {
  return (
    <section className="flex min-w-0 flex-col gap-2 rounded-lg bg-surface-2 p-3">
      <p className="text-[11px] font-bold tracking-wider text-faint uppercase">{heading}</p>
      {!version ? (
        <p className="text-sm text-muted">This song no longer exists.</p>
      ) : (
        <>
          <div>
            <p className="font-bold">{version.title}</p>
            {version.author && <p className="text-xs text-muted">{version.author}</p>}
            <p className="text-xs text-faint">{version.slides.length} slides</p>
          </div>
          <ol className="space-y-1.5">
            {version.slides.map((s, i) => (
              <li key={i} className="rounded-md bg-surface p-2">
                <span className="mb-0.5 flex items-center gap-2 text-[11px] font-bold text-faint">
                  {i + 1}
                  {s.label && <Chip tone={s.label === "Chorus" ? "ok" : "neutral"}>{s.label}</Chip>}
                </span>
                <p className="text-sm leading-snug whitespace-pre-line">{s.text}</p>
              </li>
            ))}
          </ol>
        </>
      )}
    </section>
  );
}
