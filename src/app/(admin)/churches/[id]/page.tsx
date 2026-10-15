import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Stat } from "@/components/page-head";
import { Chip, Notice } from "@/components/ui";
import { formatDate, formatDateTime, formatPlace, formatSeconds } from "@/lib/format";
import { supabaseServer } from "@/lib/supabase/server";
import { PlanSwitch } from "./plan-switch";

interface Detail {
  church: {
    id: string;
    name: string;
    country_code: string | null;
    region: string | null;
    street_address: string | null;
    created_at: string;
    created_by_email: string | null;
    settings: { translation?: string; silence_end_minutes?: number };
  };
  members: {
    user_id: string;
    email: string;
    first_name: string;
    last_name: string;
    phone: string | null;
    role: string;
    joined_at: string;
    last_sign_in_at: string | null;
  }[];
  services: {
    id: string;
    started_at: string;
    ended_at: string | null;
    end_reason: string | null;
    audio_seconds: number;
    verses: number;
  }[];
  totals: { services: number; audio_seconds: number; verses: number };
}

const END_REASON: Record<string, string> = { operator: "Ended by operator", silence: "Ended after silence", abandoned: "Tab closed" };

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await supabaseServer();
  const { data } = await supabase.rpc("admin_church", { p_id: id });
  return { title: (data as Detail | null)?.church.name ?? "Church" };
}

export default async function ChurchPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const supabase = await supabaseServer();
  // Close services left open by a crash first, so "Live now" means live.
  await supabase.rpc("close_stale_services", { p_church: id });
  const [{ data, error }, { data: plan }] = await Promise.all([
    supabase.rpc("admin_church", { p_id: id }),
    supabase.rpc("church_plan", { p_church: id }),
  ]);
  if (error) {
    return (
      <main className="w-full max-w-5xl px-4 py-8 sm:px-8">
        <Notice tone="error">Could not load this church: {error.message}</Notice>
      </main>
    );
  }
  const d = data as Detail | null;
  if (!d) notFound();
  const { church, members, services, totals } = d;

  return (
    <main className="w-full max-w-5xl space-y-6 px-4 py-8 sm:px-8">
      <div>
        <Link href="/churches" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
          <ArrowLeft size={15} /> Churches
        </Link>
        <h1 className="mt-2 text-2xl font-bold">{church.name}</h1>
        <p className="mt-1 text-sm text-muted">
          {[church.street_address, formatPlace(church.region, church.country_code)].filter(Boolean).join(", ")}
        </p>
        <p className="mt-0.5 text-xs text-faint">
          Joined {formatDate(church.created_at)}
          {church.created_by_email && ` by ${church.created_by_email}`} · Default translation {(church.settings.translation ?? "kjv").toUpperCase()}
        </p>
      </div>

      <PlanSwitch churchId={church.id} churchName={church.name} plan={plan === "paid" ? "paid" : "free"} />

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="Members" value={members.length} />
        <Stat label="Services" value={totals.services} />
        <Stat label="Verses shown" value={Number(totals.verses).toLocaleString()} />
        <Stat label="Listened" value={formatSeconds(Number(totals.audio_seconds))} />
      </div>

      <section className="rounded-lg bg-surface">
        <h2 className="px-5 pt-5 pb-2 font-bold">Media team</h2>
        <ul className="divide-y divide-line">
          {members.map((m) => (
            <li key={m.user_id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3 text-sm">
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">{[m.first_name, m.last_name].filter(Boolean).join(" ") || "No name"}</span>
                <span className="block text-muted">
                  {m.email}
                  {m.phone && ` · ${m.phone}`}
                </span>
              </span>
              <Chip tone={m.role === "admin" ? "ok" : "neutral"}>{m.role === "admin" ? "Church admin" : "Operator"}</Chip>
              <span className="w-full text-xs text-faint sm:w-48 sm:text-right">Last sign-in {formatDateTime(m.last_sign_in_at)}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-lg bg-surface">
        <h2 className="px-5 pt-5 pb-2 font-bold">Recent services</h2>
        {services.length === 0 ? (
          <p className="px-5 pb-5 text-sm text-muted">No services yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead className="text-xs text-muted">
                <tr className="border-b border-line">
                  <th className="px-5 py-2.5 font-bold">Started</th>
                  <th className="px-5 py-2.5 font-bold">Length</th>
                  <th className="px-5 py-2.5 text-right font-bold">Verses</th>
                  <th className="px-5 py-2.5 font-bold">Ended</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {services.map((s) => {
                  const secs = s.ended_at ? Math.round((Date.parse(s.ended_at) - Date.parse(s.started_at)) / 1000) : null;
                  return (
                    <tr key={s.id}>
                      <td className="px-5 py-2.5 whitespace-nowrap">{formatDateTime(s.started_at)}</td>
                      <td className="px-5 py-2.5 whitespace-nowrap text-muted">{secs === null ? "—" : formatSeconds(secs)}</td>
                      <td className="px-5 py-2.5 text-right tabular-nums">{s.verses}</td>
                      <td className="px-5 py-2.5 text-muted">
                        {s.ended_at ? (END_REASON[s.end_reason ?? ""] ?? "Ended") : <Chip tone="live">Live now</Chip>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
