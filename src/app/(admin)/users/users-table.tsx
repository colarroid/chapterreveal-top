"use client";

import { ShieldCheck, ShieldOff } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { confirmDialog } from "@/components/confirm";
import { useMemo, useState } from "react";
import { PageHead, SearchBox } from "@/components/page-head";
import { Button, Chip, Notice } from "@/components/ui";
import { supabaseBrowser } from "@/lib/supabase/client";

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  phone: string;
  joined: string;
  lastSignIn: string;
  confirmed: boolean;
  churchId: string | null;
  churchName: string;
  role: string;
  isAdmin: boolean;
}

type Filter = "all" | "admins" | "no-church" | "unconfirmed";
const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "admins", label: "Platform admins" },
  { id: "no-church", label: "No church" },
  { id: "unconfirmed", label: "Unconfirmed" },
];

export function UsersTable({ users, meId }: { users: AdminUser[]; meId: string }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return users.filter((u) => {
      if (filter === "admins" && !u.isAdmin) return false;
      if (filter === "no-church" && u.churchId) return false;
      if (filter === "unconfirmed" && u.confirmed) return false;
      return !q || [u.name, u.email, u.phone, u.churchName].some((f) => f.toLowerCase().includes(q));
    });
  }, [users, query, filter]);

  async function setAdmin(u: AdminUser, on: boolean) {
    const who = u.name || u.email;
    const ok = await confirmDialog(
      on
        ? {
            title: `Make ${who} a platform admin?`,
            body: "They'll be able to manage translations and the shared song library, and see every church and user.",
            confirmLabel: "Make admin",
          }
        : { title: `Remove ${who}'s admin access?`, body: "They lose access to the admin site straight away.", confirmLabel: "Remove admin", danger: true },
    );
    if (!ok) return;
    setBusy(u.id);
    setError("");
    const { error } = await supabaseBrowser().rpc("admin_set_platform_admin", { p_user: u.id, p_on: on });
    setBusy(null);
    if (error) setError(error.message);
    else router.refresh();
  }

  return (
    <div className="space-y-4">
      <PageHead
        title="Users"
        description={`${users.length.toLocaleString()} ${users.length === 1 ? "account" : "accounts"}`}
        right={<SearchBox value={query} onChange={setQuery} placeholder="Search name, email, phone, church" />}
      />

      <div className="flex flex-wrap gap-1.5">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            className={`h-8 rounded-full px-3.5 text-sm transition ${filter === f.id ? "bg-ink font-bold text-bg" : "bg-surface text-muted hover:text-ink"}`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {error && <Notice tone="error">{error}</Notice>}

      <div className="overflow-x-auto rounded-lg bg-surface">
        <table className="w-full min-w-[820px] text-left text-sm">
          <thead className="text-xs text-muted">
            <tr className="border-b border-line">
              <th className="px-4 py-3 font-bold">Person</th>
              <th className="px-4 py-3 font-bold">Church</th>
              <th className="px-4 py-3 font-bold">Joined</th>
              <th className="px-4 py-3 font-bold">Last sign-in</th>
              <th className="px-4 py-3 font-bold">
                <span className="sr-only">Platform admin</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {shown.map((u) => (
              <tr key={u.id} className="align-middle">
                <td className="px-4 py-3">
                  <span className="flex items-center gap-2">
                    <span className="font-semibold">{u.name || "No name"}</span>
                    {u.isAdmin && <Chip tone="ok">Admin</Chip>}
                    {!u.confirmed && <Chip tone="warn">Unconfirmed</Chip>}
                  </span>
                  <span className="block text-muted">{u.email}</span>
                  {u.phone && <span className="block text-xs text-faint">{u.phone}</span>}
                </td>
                <td className="px-4 py-3">
                  {u.churchId ? (
                    <>
                      <Link href={`/churches/${u.churchId}`} className="font-semibold hover:underline">
                        {u.churchName}
                      </Link>
                      <span className="block text-xs text-muted capitalize">{u.role}</span>
                    </>
                  ) : (
                    <span className="text-faint">No church yet</span>
                  )}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-muted">{u.joined}</td>
                <td className="px-4 py-3 whitespace-nowrap text-muted">{u.lastSignIn}</td>
                <td className="px-4 py-3 text-right">
                  {u.isAdmin ? (
                    u.id !== meId && (
                      <Button variant="outline" size="sm" loading={busy === u.id} disabled={busy !== null} onClick={() => void setAdmin(u, false)}>
                        <ShieldOff size={13} /> Remove admin
                      </Button>
                    )
                  ) : (
                    <Button variant="outline" size="sm" loading={busy === u.id} disabled={busy !== null} onClick={() => void setAdmin(u, true)}>
                      <ShieldCheck size={13} /> Make admin
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {shown.length === 0 && <p className="px-4 py-10 text-center text-sm text-muted">No users match.</p>}
      </div>
    </div>
  );
}
