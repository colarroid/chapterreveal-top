import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";

// Same Supabase project as the main app. Every write is also guarded in the
// database (is_platform_admin() in the RLS policies), so these checks are
// for a clear page, not the only line of defence.

export const supabaseServer = cache(async () => {
  const store = await cookies();
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          list.forEach(({ name, value, options }) => store.set(name, value, options));
        } catch {
          // Read-only in Server Components; the middleware refreshes instead.
        }
      },
    },
  });
});

export interface Admin {
  id: string;
  email: string;
}

/** The signed-in platform admin, or null (not signed in, or not an admin). */
export const getAdmin = cache(async (): Promise<Admin | null> => {
  const supabase = await supabaseServer();
  const { data } = await supabase.auth.getClaims();
  const id = data?.claims?.sub;
  if (!id) return null;
  const { data: row } = await supabase.from("platform_admins").select("user_id").eq("user_id", id).maybeSingle();
  return row ? { id, email: (data.claims.email as string | undefined) ?? "" } : null;
});

/** Sends anyone who isn't a platform admin to the sign-in page. */
export async function requireAdmin(): Promise<Admin> {
  const admin = await getAdmin();
  if (!admin) redirect("/login");
  return admin;
}
