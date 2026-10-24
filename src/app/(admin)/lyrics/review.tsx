"use client";

import { ArrowLeft, ArrowRight, LoaderCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { Button, Chip, IconButton, Notice } from "@/components/ui";
import type { SongSlide } from "@/lib/songs/songs";
import { supabaseBrowser } from "@/lib/supabase/client";

// What's waiting for the admin in the song library (migration 0037), side
// by side. A duplicate: a song added that looks like one there already;
// keep one (everything pointing at the other moves to it) or keep both. An
// edit: a church's change to a song others have too; it keeps its version
// either way, and accepting makes it everyone's.

export interface SongReview {
  id: number;
  kind: "duplicate" | "edit";
  /** The song added (duplicate) or edited (edit). */
  songId: string;
  /** The song it looks like (duplicate). */
  otherSongId: string | null;
  church: string;
  /** How alike their words are, 0 to 1 (duplicate). */
  similarity: number;
  /** The church's version (edit). */
  proposed: Version | null;
}

interface Version {
  title: string;
  author: string;
  slides: SongSlide[];
}

type Choice = "keep_existing" | "keep_new" | "separate" | "accept" | "reject";

async function load(id: string): Promise<Version | null> {
  const { data } = await supabaseBrowser().from("songs").select("title, author, slides").eq("id", id).maybeSingle();
  return (data as Version | null) ?? null;
}

export function ReviewPanel({ reviews, onClose, onResolved }: { reviews: SongReview[]; onClose: () => void; onResolved: () => void }) {
  const [at, setAt] = useState(0);
  const review = reviews[Math.min(at, reviews.length - 1)];
  const [pair, setPair] = useState<{ before: Version | null; after: Version | null } | null>(null);
  const [busy, setBusy] = useState<Choice | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!review) return;
    let live = true;
    setPair(null);
    const loaded =
      review.kind === "edit" ? load(review.songId).then((before) => ({ before, after: review.proposed })) : Promise.all([load(review.otherSongId ?? ""), load(review.songId)]).then(([before, after]) => ({ before, after }));
    void loaded.then((p) => live && setPair(p));
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
          <p className="mt-0.5 text-sm text-muted">Songs added that look like one there already, and churches&apos; corrections, show up here.</p>
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
          <h2 className="text-xl leading-tight font-bold">{review.kind === "edit" ? "Use this change for everyone?" : "The same song twice?"}</h2>
          <p className="mt-1 text-sm text-muted">
            {review.kind === "edit"
              ? `${review.church} changed this song. They keep their version either way; accepted, every church gets it.`
              : `${review.church} added a song that looks like one already there (${Math.round(review.similarity * 100)}% the same words).`}
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
          <Side heading={review.kind === "edit" ? "Now" : "There already"} version={pair.before} />
          <Side heading={review.kind === "edit" ? `${review.church}'s change` : `Added by ${review.church}`} version={pair.after} />
        </div>
      )}

      <div className="flex shrink-0 flex-wrap items-center gap-2 border-t border-line px-5 py-3">
        {review.kind === "edit" ? (
          <>
            <Button size="sm" onClick={() => void choose("accept")} disabled={busy !== null} loading={busy === "accept"}>
              Use it for everyone
            </Button>
            <Button size="sm" variant="secondary" onClick={() => void choose("reject")} disabled={busy !== null} loading={busy === "reject"}>
              Keep it as it is
            </Button>
          </>
        ) : (
          <>
            <Button size="sm" onClick={() => void choose("keep_existing")} disabled={busy !== null} loading={busy === "keep_existing"}>
              Keep the one there already
            </Button>
            <Button size="sm" variant="secondary" onClick={() => void choose("keep_new")} disabled={busy !== null} loading={busy === "keep_new"}>
              Keep {review.church}&apos;s
            </Button>
            <Button size="sm" variant="ghost" onClick={() => void choose("separate")} disabled={busy !== null} loading={busy === "separate"}>
              They&apos;re different songs: keep both
            </Button>
          </>
        )}
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
