"use client";

import { ExternalLink, LoaderCircle, LogOut, SunMoon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ThemeToggle } from "@/components/theme";
import { Logo } from "@/components/ui";
import { supabaseBrowser } from "@/lib/supabase/client";

function AccountMenu({ email }: { email: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function signOut() {
    if (signingOut) return;
    setSigningOut(true);
    await supabaseBrowser().auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account"
        onClick={() => setOpen((o) => !o)}
        className={`grid h-9 w-9 place-items-center rounded-full bg-surface-3 text-[13px] font-bold transition hover:scale-105 active:scale-95 ${
          open ? "ring-2 ring-ink/70" : "ring-1 ring-line-strong"
        }`}
      >
        {(email[0] ?? "?").toUpperCase()}
      </button>
      {open && (
        <div role="menu" className="absolute top-[calc(100%+8px)] right-0 z-50 w-72 rounded-xl bg-menu p-1.5 shadow-pop ring-1 ring-line">
          <div className="px-3 pt-2.5 pb-3">
            <span className="block truncate font-semibold">{email}</span>
            <span className="block text-xs text-faint">Platform admin</span>
          </div>
          <div className="my-1 h-px bg-line" />
          <div className="flex h-10 items-center gap-3 rounded-lg px-3 text-[15px]">
            <SunMoon size={17} className="text-muted" />
            <span className="flex-1">Theme</span>
            <ThemeToggle />
          </div>
          <div className="my-1 h-px bg-line" />
          <button
            type="button"
            role="menuitem"
            onClick={signOut}
            className="flex h-10 w-full items-center gap-3 rounded-lg px-3 text-left text-[15px] hover:bg-ink/10"
          >
            {signingOut ? <LoaderCircle size={17} className="animate-spin text-muted" /> : <LogOut size={17} className="text-muted" />}
            {signingOut ? "Signing out…" : "Sign out"}
          </button>
        </div>
      )}
    </div>
  );
}

export function AdminHeader({ email }: { email: string }) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  return (
    <header className="flex h-16 shrink-0 items-center gap-4 border-b border-line bg-bg px-4">
      <span className="flex items-center gap-2.5">
        <span className="sm:hidden">
          <Logo href="/" variant="icon" className="h-9" />
        </span>
        <span className="hidden sm:inline-flex">
          <Logo href="/" variant="header" className="h-[31px]" />
        </span>
        {/* Unmistakably not the church console. */}
        <span className="rounded-full bg-ink px-2.5 py-1 text-[11px] font-bold tracking-wider text-bg uppercase">Admin</span>
      </span>


      <div className="ml-auto flex items-center gap-3">
        {appUrl && (
          <a href={appUrl} className="hidden items-center gap-1.5 text-sm text-muted transition hover:text-ink sm:inline-flex">
            Open app <ExternalLink size={14} />
          </a>
        )}
        <AccountMenu email={email} />
      </div>
    </header>
  );
}
