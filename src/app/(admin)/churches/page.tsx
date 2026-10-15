import { Notice } from "@/components/ui";
import { formatDate, formatPlace, formatSeconds } from "@/lib/format";
import { supabaseServer } from "@/lib/supabase/server";
import { ChurchesTable, type AdminChurch } from "./churches-table";

export const metadata = { title: "Churches" };

interface Row {
  id: string;
  name: string;
  country_code: string | null;
  region: string | null;
  street_address: string | null;
  created_at: string;
  created_by_email: string | null;
  member_count: number;
  service_count: number;
  last_service_at: string | null;
  audio_seconds: number;
}

export default async function ChurchesPage() {
  const supabase = await supabaseServer();
  const { data, error } = await supabase.rpc("admin_churches");

  const churches: AdminChurch[] = ((data ?? []) as Row[]).map((r) => ({
    id: r.id,
    name: r.name,
    place: formatPlace(r.region, r.country_code),
    createdBy: r.created_by_email ?? "",
    joined: formatDate(r.created_at),
    members: Number(r.member_count),
    services: Number(r.service_count),
    lastService: r.last_service_at ? formatDate(r.last_service_at) : "Never",
    listened: formatSeconds(Number(r.audio_seconds)),
  }));

  return (
    <main className="w-full max-w-6xl px-4 py-8 sm:px-8">
      {error ? <Notice tone="error">Could not load churches: {error.message}. Has migration 0006 been run?</Notice> : <ChurchesTable churches={churches} />}
    </main>
  );
}
