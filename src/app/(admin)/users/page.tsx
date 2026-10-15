import { Notice } from "@/components/ui";
import { formatDate, formatDateTime } from "@/lib/format";
import { requireAdmin, supabaseServer } from "@/lib/supabase/server";
import { UsersTable, type AdminUser } from "./users-table";

export const metadata = { title: "Users" };

interface Row {
  user_id: string;
  email: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  email_confirmed: boolean;
  church_id: string | null;
  church_name: string | null;
  role: string | null;
  is_platform_admin: boolean;
}

export default async function UsersPage() {
  const [me, supabase] = await Promise.all([requireAdmin(), supabaseServer()]);
  const { data, error } = await supabase.rpc("admin_users");

  // Dates are formatted here so the table doesn't need the formatter in the browser.
  const users: AdminUser[] = ((data ?? []) as Row[]).map((r) => ({
    id: r.user_id,
    email: r.email,
    name: [r.first_name, r.last_name].filter(Boolean).join(" "),
    phone: r.phone ?? "",
    joined: formatDate(r.created_at),
    lastSignIn: formatDateTime(r.last_sign_in_at),
    confirmed: r.email_confirmed,
    churchId: r.church_id,
    churchName: r.church_name ?? "",
    role: r.role ?? "",
    isAdmin: r.is_platform_admin,
  }));

  return (
    <main className="w-full max-w-6xl px-4 py-8 sm:px-8">
      {error ? (
        <Notice tone="error">Could not load users: {error.message}. Has migration 0006 been run?</Notice>
      ) : (
        <UsersTable users={users} meId={me.id} />
      )}
    </main>
  );
}
