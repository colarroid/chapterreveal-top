"use client";

import { BookPlus, ChevronDown, ChevronUp, Eye, EyeOff, FileUp, LibraryBig, Pencil, ShieldCheck, Trash2, TriangleAlert, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { confirmDialog } from "@/components/confirm";
import { useRef, useState } from "react";
import { Button, Chip, Field, IconButton, Notice } from "@/components/ui";
import { BOOKS } from "@/lib/scripture/books";
import { importBible, type ImportReport } from "@/lib/scripture/import";
import kjvShape from "@/lib/scripture/kjv-shape.json";
import { BUILT_IN_TRANSLATIONS, type AdminTranslation } from "@/lib/scripture/translations";
import { supabaseBrowser } from "@/lib/supabase/client";
import { useLeaveWarning } from "@/lib/use-leave-warning";

const bookName = (b: number) => BOOKS[b]?.name ?? "";
const BUILT_IN_IDS = new Set(BUILT_IN_TRANSLATIONS.map((t) => t.id));
const ID_RE = /^[a-z0-9][a-z0-9-]{1,15}$/;
const ACCEPT = ".usfm,.sfm,.xml,.osis,.json,.csv,.tsv,.txt";
const PREVIEW: [number, number, number][] = [
  [0, 1, 1],
  [18, 23, 1],
  [42, 3, 16],
  [44, 8, 28],
  [65, 22, 21],
];

const idFrom = (short: string) =>
  short
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 16);

function missingSummary(missing: number[]): string {
  if (!missing.length) return "";
  const ot = missing.filter((b) => b < 39).length;
  const nt = missing.length - ot;
  if (ot === 39 && nt === 0) return "Old Testament not included";
  if (nt === 27 && ot === 0) return "New Testament not included";
  if (missing.length <= 8) return `Not included: ${missing.map(bookName).join(", ")}`;
  return `${missing.length} books not included`;
}

/** One row of the list: a built-in translation, or one added here (`added`). */
export interface ListItem {
  id: string;
  short: string;
  name: string;
  added: AdminTranslation | null;
  hidden: boolean;
}

export function Translations({ items: initial, orderReady }: { items: ListItem[]; orderReady: boolean }) {
  const router = useRouter();
  const supabase = supabaseBrowser();
  // Kept here so a move shows at once; the server copy replaces it on refresh.
  const [items, setItems] = useState(initial);
  const [synced, setSynced] = useState(initial);
  if (synced !== initial) {
    setSynced(initial);
    setItems(initial);
  }
  // null: list only; "new": adding one; otherwise the translation being edited.
  const [editing, setEditing] = useState<AdminTranslation | "new" | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");

  /** Saves every position, so the stored order always matches the list. */
  async function move(index: number, by: -1 | 1) {
    const to = index + by;
    if (to < 0 || to >= items.length) return;
    const next = [...items];
    [next[index], next[to]] = [next[to], next[index]];
    setItems(next);
    setBusy(`move-${items[index].id}`);
    setError("");
    const now = new Date().toISOString();
    const { error } = await supabase.from("translation_order").upsert(next.map((t, position) => ({ translation_id: t.id, position, updated_at: now })));
    setBusy(null);
    if (error) {
      setItems(items);
      setError(error.message);
    }
  }

  async function setHidden(t: ListItem, hidden: boolean) {
    setBusy(`hide-${t.id}`);
    setError("");
    const now = new Date().toISOString();
    const { error } = t.added
      ? await supabase.from("translations").update({ published: !hidden, updated_at: now }).eq("id", t.id)
      : // Every position too, so this row can't jump ahead of ones never placed.
        // (Added translations' rows keep hidden false: they use published.)
        await supabase.from("translation_order").upsert(
          items.map((x, position) => ({ translation_id: x.id, position, hidden: x.id === t.id ? hidden : !x.added && x.hidden, updated_at: now })),
        );
    setBusy(null);
    if (error) return setError(error.message);
    setItems((all) => all.map((x) => (x.id === t.id ? { ...x, hidden } : x)));
    router.refresh();
  }

  async function remove(t: AdminTranslation) {
    const ok = await confirmDialog({
      title: `Delete ${t.short}?`,
      body: "Its text is removed and churches using it switch back to the KJV. This can't be undone.",
      confirmLabel: "Delete",
      danger: true,
    });
    if (!ok) return;
    setBusy(`delete-${t.id}`);
    setError("");
    const { data: files } = await supabase.storage.from("bibles").list(t.id);
    if (files?.length) await supabase.storage.from("bibles").remove(files.map((f) => `${t.id}/${f.name}`));
    const { error } = await supabase.from("translations").delete().eq("id", t.id);
    if (!error) await supabase.from("translation_order").delete().eq("translation_id", t.id);
    setBusy(null);
    if (error) setError(error.message);
    else router.refresh();
  }

  const shown = items.filter((t) => !t.hidden).length;
  const arrow = "grid h-5 w-7 place-items-center rounded text-muted transition hover:bg-surface-2 hover:text-ink disabled:opacity-30";

  return (
    <main className="min-w-0">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold">Bible translations</h1>
          <p className="mt-1 text-sm text-muted">
            Every church sees this list in this order, in the console&apos;s translation picker and in Settings. People can star favourites to keep them at the
            top for themselves.
          </p>
        </div>
        {editing === null && (
          <Button onClick={() => setEditing("new")}>
            <BookPlus size={15} /> Add translation
          </Button>
        )}
      </div>

      <div className="mt-6 space-y-4">
        {!orderReady && <Notice tone="error">Ordering and hiding built-in translations need migration 0017. Run it in Supabase, then reload.</Notice>}
        {error && <Notice tone="error">{error}</Notice>}

        {editing !== null && (
          <TranslationForm
            key={editing === "new" ? "new" : editing.id}
            existing={editing === "new" ? null : editing}
            takenIds={new Set(items.filter((t) => t.added).map((t) => t.id))}
            onClose={() => setEditing(null)}
            onSaved={() => {
              setEditing(null);
              router.refresh();
            }}
          />
        )}

        <section className="rounded-lg bg-surface">
          <h2 className="px-5 pt-5 pb-2 text-sm font-bold text-muted">
            {shown} shown · {items.length - shown} hidden
          </h2>
          <ol className="divide-y divide-line">
            {items.map((t, i) => (
              <li key={t.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-5 py-3">
                <span className="flex shrink-0 flex-col">
                  <button type="button" aria-label={`Move ${t.short} up`} disabled={i === 0 || busy !== null || !orderReady} onClick={() => void move(i, -1)} className={arrow}>
                    <ChevronUp size={16} />
                  </button>
                  <button
                    type="button"
                    aria-label={`Move ${t.short} down`}
                    disabled={i === items.length - 1 || busy !== null || !orderReady}
                    onClick={() => void move(i, 1)}
                    className={arrow}
                  >
                    <ChevronDown size={16} />
                  </button>
                </span>
                <span className={`flex min-w-0 flex-1 items-center gap-3 ${t.hidden ? "opacity-55" : ""}`}>
                  <span className="w-14 shrink-0 font-bold">{t.short}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px]">{t.name}</span>
                    <span className="block text-xs text-muted">
                      {t.added ? `Added · ${t.added.verse_count.toLocaleString()} verses · version ${t.added.version}` : "Built in · public domain"}
                    </span>
                  </span>
                </span>
                {t.hidden && <Chip>Hidden</Chip>}
                <span className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    loading={busy === `hide-${t.id}`}
                    disabled={busy !== null || (!t.added && !orderReady)}
                    onClick={() => void setHidden(t, !t.hidden)}
                  >
                    {t.hidden ? <Eye size={13} /> : <EyeOff size={13} />}
                    {t.hidden ? "Show" : "Hide"}
                  </Button>
                  {t.added && (
                    <>
                      <IconButton label={`Edit ${t.short}`} onClick={() => setEditing(t.added)} disabled={busy !== null}>
                        <Pencil size={16} />
                      </IconButton>
                      <IconButton label={`Delete ${t.short}`} onClick={() => void remove(t.added!)} disabled={busy !== null} className="hover:text-negative">
                        <Trash2 size={16} />
                      </IconButton>
                    </>
                  )}
                </span>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </main>
  );
}

// ---------------------------------------------------------------------------

function TranslationForm({
  existing,
  takenIds,
  onClose,
  onSaved,
}: {
  existing: AdminTranslation | null;
  takenIds: Set<string>;
  onClose: () => void;
  onSaved: () => void;
}) {
  const supabase = supabaseBrowser();
  const fileInput = useRef<HTMLInputElement>(null);
  const [short, setShort] = useState(existing?.short ?? "");
  const [name, setName] = useState(existing?.name ?? "");
  const [language, setLanguage] = useState(existing?.language ?? "en");
  const [copyright, setCopyright] = useState(existing?.copyright ?? "");
  const [publish, setPublish] = useState(existing?.published ?? true);
  const [rights, setRights] = useState(!!existing);
  const [fileNames, setFileNames] = useState<string[]>([]);
  const [report, setReport] = useState<ImportReport | null>(null);
  const [reading, setReading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);
  // Ask before a refresh or close cuts off the upload.
  useLeaveWarning(saving);

  const isNew = !existing;
  // Made from the short name ("NKJV" -> "nkjv"), fixed once saved.
  const id = existing?.id ?? idFrom(short);
  const idProblem = !isNew
    ? ""
    : !id
      ? ""
      : !ID_RE.test(id)
        ? "Use at least 2 letters or numbers."
        : BUILT_IN_IDS.has(id) || takenIds.has(id)
          ? "Another translation already uses this short name."
          : "";

  async function readFiles(list: FileList | File[]) {
    const files = [...list];
    if (!files.length) return;
    setReading(true);
    setError("");
    try {
      const texts = await Promise.all(files.map(async (f) => ({ name: f.name, text: await f.text() })));
      const r = importBible(texts, kjvShape);
      if (r.verses === 0) {
        setReport(null);
        setFileNames([]);
        setError("No verses found in this file. Supported: USFM, OSIS or Zefania XML, CSV or TSV (book, chapter, verse, text), JSON, or text lines like “John 3:16 For God so loved…”.");
      } else {
        setReport(r);
        setFileNames(files.map((f) => f.name));
        if (!name && r.title) setName(r.title);
      }
    } catch (e) {
      setReport(null);
      setError(e instanceof Error ? `Could not read the file: ${e.message}` : "Could not read the file.");
    }
    setReading(false);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (isNew && !report) return setError("Choose the Bible file first.");
    if (idProblem) return;
    setSaving(true);
    setError("");
    const now = new Date().toISOString();
    const version = report ? (existing?.version ?? 0) + 1 : (existing?.version ?? 1);

    // New text first, then the row that points at it: a church never sees a
    // row whose file isn't there yet.
    if (report) {
      const body = JSON.stringify({ id, name, books: report.books });
      const { error: upErr } = await supabase.storage
        .from("bibles")
        .upload(`${id}/v${version}.json`, new Blob([body], { type: "application/json" }), {
          cacheControl: "31536000",
          contentType: "application/json",
          upsert: true,
        });
      if (upErr) {
        setSaving(false);
        return setError(`Upload failed: ${upErr.message}`);
      }
    }

    const row = {
      short: short.trim(),
      name: name.trim(),
      language: language.trim() || "en",
      copyright: copyright.trim(),
      version,
      published: publish,
      updated_at: now,
      ...(report ? { verse_count: report.verses } : {}),
    };
    const { error: dbErr } = isNew
      ? await supabase.from("translations").insert({ id, ...row })
      : await supabase.from("translations").update(row).eq("id", id);
    if (dbErr) {
      setSaving(false);
      return setError(dbErr.message);
    }
    // The old text is no longer pointed at.
    if (report && existing) await supabase.storage.from("bibles").remove([`${id}/v${existing.version}.json`]);
    setSaving(false);
    onSaved();
  }

  return (
    <section className="rounded-lg bg-surface p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-surface-2 text-ink">
          <LibraryBig size={18} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg leading-tight font-bold">{isNew ? "Add a translation" : `Edit ${existing.short}`}</h2>
          <p className="text-sm leading-snug text-muted">{isNew ? "Upload the whole Bible as one file, or one file per book." : "Change the details, or upload new text to replace it."}</p>
        </div>
        <IconButton label="Close" onClick={onClose}>
          <X size={18} />
        </IconButton>
      </div>

      <form className="mt-5 space-y-4" onSubmit={save}>
        {/* The file */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            void readFiles(e.dataTransfer.files);
          }}
          className={`flex flex-col items-center rounded-lg border-2 border-dashed px-4 py-6 text-center transition ${dragging ? "border-accent bg-accent-fill/5" : "border-line-strong"}`}
        >
          <FileUp size={22} className="text-muted" />
          <p className="mt-2 text-sm font-bold">{fileNames.length ? fileNames.join(", ") : isNew ? "Drop the Bible file here" : "Drop new text here to replace it"}</p>
          <p className="mt-0.5 text-xs text-muted">USFM, OSIS, Zefania XML, CSV, TSV, JSON or plain text</p>
          <Button type="button" variant="secondary" size="sm" className="mt-3" loading={reading} onClick={() => fileInput.current?.click()}>
            Choose files
          </Button>
          <input
            ref={fileInput}
            type="file"
            multiple
            accept={ACCEPT}
            className="hidden"
            onChange={(e) => {
              if (e.target.files) void readFiles(e.target.files);
              e.target.value = "";
            }}
          />
        </div>

        {report && <ReportView report={report} />}

        {/* The details */}
        <div className="grid gap-4 sm:grid-cols-[140px_1fr]">
          <Field
            label="Short name"
            value={short}
            onChange={(e) => setShort(e.target.value)}
            placeholder="WEB"
            required
            maxLength={12}
            aria-invalid={!!idProblem}
            hint={idProblem || (id ? `ID: ${id}` : "Shown next to every reference.")}
          />
          <Field label="Full name" value={name} onChange={(e) => setName(e.target.value)} placeholder="World English Bible" required minLength={2} maxLength={120} />
        </div>
        <div className="grid gap-4 sm:grid-cols-[140px_1fr]">
          <Field label="Language" value={language} onChange={(e) => setLanguage(e.target.value)} placeholder="en" maxLength={12} hint="en, yo, ig, ha" />
          <Field
            label="Credit line"
            value={copyright}
            onChange={(e) => setCopyright(e.target.value)}
            placeholder="Scripture taken from the … Used by permission."
            maxLength={300}
            hint="Shown in small text under every verse on the projector. Leave empty for public domain."
          />
        </div>

        <label className="flex items-center gap-2.5 text-sm font-semibold">
          <input type="checkbox" checked={publish} onChange={(e) => setPublish(e.target.checked)} className="h-4 w-4 accent-[var(--color-accent-fill)]" />
          Publish to every church now
        </label>

        {isNew && (
          <label className="flex items-start gap-2.5 rounded-lg bg-surface-2 px-3.5 py-3 text-sm">
            <input type="checkbox" checked={rights} onChange={(e) => setRights(e.target.checked)} required className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--color-accent-fill)]" />
            <span>
              <span className="flex items-center gap-1.5 font-bold">
                <ShieldCheck size={15} /> This translation is public domain, or we have written permission
              </span>
              <span className="mt-0.5 block text-muted">from its publisher to show it in this app to every church. Copyrighted translations (NKJV, NIV, NLT, AMP…) need that permission however the text was obtained.</span>
            </span>
          </label>
        )}

        {error && <Notice tone="error">{error}</Notice>}

        <div className="flex gap-2">
          <Button type="submit" loading={saving} disabled={reading || !!idProblem || (isNew && (!report || !rights))}>
            {isNew ? "Add translation" : report ? "Replace text and save" : "Save changes"}
          </Button>
          <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
        </div>
      </form>
    </section>
  );
}

function ReportView({ report }: { report: ImportReport }) {
  const missing = missingSummary(report.missingBooks);
  // A few hundred gaps is normal (modern translations leave out verses the
  // KJV has); thousands mean part of the file wasn't read.
  const manyGaps = report.gaps > 600 + report.missingBooks.length * 1000;
  return (
    <div className="space-y-3 rounded-lg bg-bg p-4 ring-1 ring-line">
      <div className="flex flex-wrap gap-2">
        <Chip tone="ok">{report.verses.toLocaleString()} verses</Chip>
        <Chip>{report.booksFound} of 66 books</Chip>
        <Chip>{report.formats.map((f) => f.toUpperCase()).join(", ")}</Chip>
        {report.gaps > 0 && <Chip tone={manyGaps ? "warn" : "neutral"}>{report.gaps.toLocaleString()} gaps</Chip>}
      </div>
      {missing && <p className="text-sm text-muted">{missing}</p>}
      {manyGaps && (
        <p className="flex items-start gap-2 text-sm text-warning">
          <TriangleAlert size={15} className="mt-0.5 shrink-0" /> Many verses are missing. Check the preview below; part of the file may not have been read.
        </p>
      )}
      {report.unknownBooks.length > 0 && <p className="text-sm text-warning">Skipped books it couldn&apos;t match: {report.unknownBooks.join(", ")}</p>}
      <ul className="space-y-2">
        {PREVIEW.map(([b, c, v]) => {
          const text = report.books[b]?.[c - 1]?.[v - 1];
          return (
            <li key={`${b}-${c}-${v}`} className="text-sm">
              <span className="font-bold text-accent">
                {bookName(b)} {c}:{v}
              </span>{" "}
              {text ? <span className="font-serif">{text}</span> : <span className="text-faint">not in this file</span>}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
