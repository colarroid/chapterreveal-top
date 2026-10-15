"use client";

import { ImagePlus, LoaderCircle, Plus, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import { confirmDialog } from "@/components/confirm";
import { PageHead } from "@/components/page-head";
import { Button, Field, Notice } from "@/components/ui";
import { deleteShared, IMAGE_MAX, nameFromFile, uploadShared, VIDEO_MAX, VIDEO_SECONDS, type SharedBackground } from "@/lib/backgrounds";
import { supabaseBrowser } from "@/lib/supabase/client";
import { useLeaveWarning } from "@/lib/use-leave-warning";

export interface SharedGradient {
  id: string;
  name: string;
  from_color: string;
  to_color: string;
  angle: number;
}

type Tab = "video" | "image" | "gradient";
const TABS: [Tab, string][] = [
  ["video", "Videos"],
  ["image", "Pictures"],
  ["gradient", "Gradients"],
];

const mb = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1)} MB`;
const css = (g: { from_color: string; to_color: string; angle: number }) => `linear-gradient(${g.angle}deg, ${g.from_color}, ${g.to_color})`;

export function Design({ initialBackgrounds, initialGradients }: { initialBackgrounds: SharedBackground[]; initialGradients: SharedGradient[] }) {
  const [tab, setTab] = useState<Tab>("video");
  const [items, setItems] = useState(initialBackgrounds);
  const [gradients, setGradients] = useState(initialGradients);
  const [progress, setProgress] = useState<number | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  // Ask before a refresh or close cuts off an upload or a delete.
  useLeaveWarning(progress !== null || deleting !== null);

  async function upload(file: File) {
    setError("");
    setProgress(0);
    try {
      const saved = await uploadShared(file, nameFromFile(file.name), setProgress);
      setItems((all) => [saved, ...all]);
      setTab(saved.kind);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setProgress(null);
    }
  }

  async function removeBackground(b: SharedBackground) {
    const ok = await confirmDialog({
      title: "Delete this background?",
      body: "It disappears from every church's Design picker. Churches showing it go back to black.",
      confirmLabel: "Delete",
      danger: true,
    });
    if (!ok) return;
    setError("");
    setDeleting(b.id);
    try {
      await deleteShared(b.id);
      setItems((all) => all.filter((x) => x.id !== b.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't delete it.");
    } finally {
      setDeleting(null);
    }
  }

  async function removeGradient(g: SharedGradient) {
    const ok = await confirmDialog({
      title: `Delete ${g.name}?`,
      body: "It's removed from every church's gradient picker. Churches already using it keep it until they change their design.",
      confirmLabel: "Delete",
      danger: true,
    });
    if (!ok) return;
    setError("");
    setDeleting(g.id);
    const { error } = await supabaseBrowser().from("gradients").delete().eq("id", g.id).is("church_id", null);
    setDeleting(null);
    if (error) return setError(error.message);
    setGradients((all) => all.filter((x) => x.id !== g.id));
  }

  const media = items.filter((b) => b.kind === tab);
  const count = (t: Tab) => (t === "gradient" ? gradients.length : items.filter((b) => b.kind === t).length);

  return (
    <>
      <PageHead
        title="Design"
        description="Backgrounds every church can pick in Design. They don't count toward a church's upload limit."
        right={
          tab === "gradient" ? (
            <Button disabled={adding} onClick={() => setAdding(true)}>
              <Plus size={15} /> Add gradient
            </Button>
          ) : (
            <Button loading={progress !== null} onClick={() => fileInput.current?.click()}>
              {progress === null && <ImagePlus size={15} />}
              {progress === null ? `Upload ${tab === "video" ? "video" : "picture"}` : `${Math.round(progress * 100)}%`}
            </Button>
          )
        }
      />

      <div role="tablist" aria-label="Kind of background" className="mt-5 inline-flex rounded-full bg-surface p-1">
        {TABS.map(([t, label]) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={`h-8 rounded-full px-4 text-sm transition ${tab === t ? "bg-surface-3 font-bold text-ink" : "text-muted hover:text-ink"}`}
          >
            {label} <span className="text-faint tabular-nums">{count(t)}</span>
          </button>
        ))}
      </div>

      {tab !== "gradient" && (
        <p className="mt-3 text-xs text-muted">
          {tab === "video"
            ? `MP4, MOV or WebM, up to ${VIDEO_SECONDS} seconds and ${VIDEO_MAX / 1024 / 1024} MB. It loops silently.`
            : `JPG, PNG or WebP, up to ${IMAGE_MAX / 1024 / 1024} MB. 1920 × 1080 is ideal.`}{" "}
          Only upload what you have the right to share with every church.
        </p>
      )}
      <input
        ref={fileInput}
        type="file"
        accept={tab === "video" ? "video/mp4,video/quicktime,video/webm" : "image/jpeg,image/png,image/webp"}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void upload(f);
          e.target.value = "";
        }}
      />

      {error && (
        <div className="mt-4">
          <Notice tone="error">{error}</Notice>
        </div>
      )}

      {tab === "gradient" ? (
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
          {adding && (
            <NewGradient
              onCancel={() => setAdding(false)}
              onAdded={(g) => {
                setGradients((all) => [...all, g]);
                setAdding(false);
              }}
            />
          )}
          {gradients.map((g) => (
            <figure key={g.id} className="group overflow-hidden rounded-xl bg-surface ring-1 ring-line">
              <div className="relative aspect-video" style={{ background: css(g) }}>
                <DeleteButton label={`Delete ${g.name}`} busy={deleting === g.id} onClick={() => void removeGradient(g)} />
              </div>
              <figcaption className="flex items-baseline gap-2 px-3 py-2 text-sm">
                <span className="min-w-0 flex-1 truncate font-bold">{g.name}</span>
                <span className="shrink-0 font-mono text-[11px] text-faint">
                  {g.from_color} → {g.to_color} · {g.angle}°
                </span>
              </figcaption>
            </figure>
          ))}
          {!adding && gradients.length === 0 && <p className="col-span-full py-10 text-center text-sm text-muted">No gradients. Add one for churches to pick.</p>}
        </div>
      ) : media.length === 0 ? (
        <p className="mt-10 text-center text-sm text-muted">No shared {tab === "video" ? "videos" : "pictures"} yet.</p>
      ) : (
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
          {media.map((b) => (
            <figure key={b.id} className="group overflow-hidden rounded-xl bg-surface ring-1 ring-line">
              <div className="relative aspect-video bg-black">
                {b.kind === "video" ? (
                  <video src={b.url} muted loop playsInline autoPlay preload="metadata" className="h-full w-full object-cover" />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element -- a thumbnail of a shared background
                  <img src={b.url} alt="" className="h-full w-full object-cover" />
                )}
                <DeleteButton label={`Delete ${b.name || "this background"}`} busy={deleting === b.id} onClick={() => void removeBackground(b)} />
              </div>
              <figcaption className="flex items-baseline gap-2 px-3 py-2 text-sm">
                <span className="min-w-0 flex-1 truncate font-bold">{b.name || "Untitled"}</span>
                {b.bytes > 0 && <span className="shrink-0 text-xs text-faint tabular-nums">{mb(b.bytes)}</span>}
              </figcaption>
            </figure>
          ))}
        </div>
      )}
    </>
  );
}

function DeleteButton({ label, busy, onClick }: { label: string; busy: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={busy}
      onClick={onClick}
      className="absolute top-2 right-2 grid h-8 w-8 place-items-center rounded-full bg-black/60 text-white opacity-0 transition group-hover:opacity-100 hover:bg-negative focus:opacity-100 disabled:opacity-100"
    >
      {busy ? <LoaderCircle size={15} className="animate-spin" /> : <Trash2 size={15} />}
    </button>
  );
}

/** The add form, as a card at the start of the grid with a live preview. */
function NewGradient({ onCancel, onAdded }: { onCancel: () => void; onAdded: (g: SharedGradient) => void }) {
  const [name, setName] = useState("");
  const [from, setFrom] = useState("#0b1a3a");
  const [to, setTo] = useState("#020617");
  const [angle, setAngle] = useState(90);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    if (!name.trim()) return setError("Give it a name.");
    setSaving(true);
    setError("");
    const { data, error } = await supabaseBrowser()
      .from("gradients")
      .insert({ name: name.trim().slice(0, 40), from_color: from, to_color: to, angle })
      .select("id, name, from_color, to_color, angle")
      .single();
    setSaving(false);
    if (error) return setError(error.message);
    onAdded(data as SharedGradient);
  }

  return (
    <div className="col-span-2 overflow-hidden rounded-xl bg-surface ring-2 ring-accent sm:col-span-3 xl:col-span-2">
      <div className="aspect-[32/9]" style={{ background: css({ from_color: from, to_color: to, angle }) }} />
      <form
        className="space-y-3 p-4"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <Field label="Name" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} placeholder="e.g. Sunrise" autoFocus />
        <div className="grid grid-cols-2 gap-3">
          <ColorInput label="From" value={from} onChange={setFrom} />
          <ColorInput label="To" value={to} onChange={setTo} />
        </div>
        <label className="block">
          <span className="flex justify-between text-sm font-bold">
            Direction <span className="font-normal text-muted tabular-nums">{angle}°</span>
          </span>
          <input type="range" min={0} max={360} step={5} value={angle} onChange={(e) => setAngle(Number(e.target.value))} className="mt-2 w-full accent-[var(--color-accent-fill)]" />
        </label>
        {error && <Notice tone="error">{error}</Notice>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" size="sm" loading={saving}>
            Add
          </Button>
        </div>
      </form>
    </div>
  );
}

function ColorInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="text-sm font-bold">{label}</span>
      <span className="inset-field mt-1.5 flex items-center gap-2 rounded-md bg-bg px-2 py-1.5">
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="h-8 w-8 shrink-0 cursor-pointer rounded border-0 bg-transparent p-0" />
        <span className="font-mono text-sm">{value}</span>
      </span>
    </label>
  );
}
