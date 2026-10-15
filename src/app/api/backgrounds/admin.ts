import { NextResponse } from "next/server";
import { getAdmin, type Admin } from "@/lib/supabase/server";

/** The signed-in platform admin, or a JSON error response to send back. */
export async function platformAdmin(): Promise<Admin | NextResponse> {
  const admin = await getAdmin();
  return admin ?? NextResponse.json({ error: "Only platform admins can change shared backgrounds" }, { status: 403 });
}
