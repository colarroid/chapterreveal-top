"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ThemeToggle } from "@/components/theme";
import { Button, Field, Logo, Notice } from "@/components/ui";
import { supabaseBrowser } from "@/lib/supabase/client";

// Same accounts as the main app. Only platform admins get past this page.
export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const supabase = supabaseBrowser();
    const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error || !data.user) {
      setBusy(false);
      return setError(error?.message === "Invalid login credentials" ? "Wrong email or password." : (error?.message ?? "Could not sign in."));
    }
    const { data: admin } = await supabase.from("platform_admins").select("user_id").eq("user_id", data.user.id).maybeSingle();
    if (!admin) {
      // Don't leave a church member half signed in to the admin site.
      await supabase.auth.signOut();
      setBusy(false);
      return setError("This account isn't a platform admin.");
    }
    router.replace("/");
    router.refresh();
  }

  return (
    <main className="grid min-h-dvh place-items-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-2.5">
          <Logo href="/login" compact />
          <span className="rounded-full bg-ink px-2.5 py-1 text-[11px] font-bold tracking-wider text-bg uppercase">Admin</span>
        </div>
        <h1 className="mt-6 text-2xl font-bold">Sign in</h1>
        <p className="mt-1 text-sm text-muted">For people who run the platform.</p>

        <form onSubmit={submit} className="mt-6 space-y-4">
          <Field label="Email address" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <Field label="Password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          {error && <Notice tone="error">{error}</Notice>}
          <Button type="submit" className="w-full" loading={busy}>
            Sign in
          </Button>
        </form>

        <div className="mt-8 flex justify-end">
          <ThemeToggle />
        </div>
      </div>
    </main>
  );
}
