"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, Notice } from "@/components/ui";
import { supabaseBrowser } from "@/lib/supabase/client";

// How long a service may stay silent before it ends on its own: stops the
// transcription (and its cost) when someone forgets End service. Set here
// by platform admins only (migration 0036); 10 minutes unless changed.
export function SilenceSetting({ churchId, minutes }: { churchId: string; minutes: number }) {
  const router = useRouter();
  const [value, setValue] = useState(String(minutes));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const n = Number(value);
  const valid = Number.isInteger(n) && n >= 5 && n <= 120;

  async function save() {
    setBusy(true);
    setMessage(null);
    const { error } = await supabaseBrowser().rpc("admin_set_silence_minutes", { p_church: churchId, p_minutes: n });
    setBusy(false);
    if (error) setMessage({ tone: "error", text: error.message });
    else {
      setMessage({ tone: "ok", text: "Saved. It applies from the church's next service." });
      router.refresh();
    }
  }

  return (
    <form
      className="flex flex-wrap items-center gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (valid && n !== minutes) void save();
      }}
    >
      <span className="text-sm font-bold">End a silent service after</span>
      <label className="flex h-9 items-center gap-2 rounded-full bg-surface-2 px-4 text-sm">
        <span className="sr-only">Minutes of silence</span>
        <input
          type="number"
          min={5}
          max={120}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="w-12 bg-transparent text-right font-bold tabular-nums outline-none"
        />
        <span className="text-muted">minutes</span>
      </label>
      <Button type="submit" size="sm" variant="secondary" loading={busy} disabled={!valid || n === minutes}>
        Save
      </Button>
      <span className="text-xs text-muted">5 to 120. Stops listening if someone forgets End service.</span>
      {message && <Notice tone={message.tone}>{message.text}</Notice>}
    </form>
  );
}
