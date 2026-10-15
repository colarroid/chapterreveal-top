"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { confirmDialog } from "@/components/confirm";
import { Notice } from "@/components/ui";
import { supabaseBrowser } from "@/lib/supabase/client";

type Plan = "free" | "paid";

// Free: 2 projector backgrounds. Paid: no limit. (The main app and the
// database hold the same numbers.)
export function PlanSwitch({ churchId, churchName, plan }: { churchId: string; churchName: string; plan: Plan }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function change(next: Plan) {
    if (next === plan) return;
    const ok = await confirmDialog(
      next === "paid"
        ? { title: `Move ${churchName} to the Paid plan?`, body: "They can upload as many pictures and videos, and save as many gradients, as they like.", confirmLabel: "Make paid" }
        : {
            title: `Move ${churchName} to the Free plan?`,
            body: "What they already have stays, but they can't add more beyond the Free plan's 5 pictures, 2 videos and 10 gradients.",
            confirmLabel: "Make free",
            danger: true,
          },
    );
    if (!ok) return;
    setBusy(true);
    setError("");
    const { error } = await supabaseBrowser().rpc("admin_set_church_plan", { p_church: churchId, p_plan: next });
    setBusy(false);
    if (error) setError(error.message);
    else router.refresh();
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <span className="text-sm font-bold">Plan</span>
      <div className={`inline-flex rounded-full bg-surface-2 p-0.5 ${busy ? "opacity-60" : ""}`}>
        {(["free", "paid"] as Plan[]).map((p) => (
          <button
            key={p}
            type="button"
            disabled={busy}
            onClick={() => void change(p)}
            className={`h-8 rounded-full px-4 text-sm transition ${plan === p ? "bg-surface-3 font-bold text-ink" : "text-muted hover:text-ink"}`}
          >
            {p === "free" ? "Free" : "Paid"}
          </button>
        ))}
      </div>
      <span className="text-xs text-muted">{plan === "free" ? "2 projector backgrounds" : "Unlimited backgrounds"}</span>
      {error && <Notice tone="error">{error}</Notice>}
    </div>
  );
}
