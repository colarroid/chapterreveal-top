import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import Link from "next/link";
import { PageHead } from "@/components/page-head";
import { Notice } from "@/components/ui";
import { formatDate, formatPlace, formatSeconds } from "@/lib/format";
import { supabaseServer } from "@/lib/supabase/server";

export const metadata = { title: "Overview" };
export const dynamic = "force-dynamic";

// The whole platform at a glance, from admin_overview() (migration 0026):
// totals, the last 30 days against the 30 before, twelve weeks of sign-ups
// and use, the busiest churches and the newest accounts.

interface Pair {
  now: number;
  before: number;
}

interface Week {
  week: string;
  users: number;
  churches: number;
  services: number;
  audio_seconds: number;
  active_churches: number;
}

interface Overview {
  totals: {
    users: number;
    users_confirmed: number;
    churches: number;
    paid_churches: number;
    services: number;
    audio_seconds: number;
    verses_shown: number;
    songs_shown: number;
    church_songs: number;
    shared_songs: number;
    slides: number;
  };
  period: {
    new_users: Pair;
    new_churches: Pair;
    active_churches: Pair;
    services: Pair;
    audio_seconds: Pair;
    verses_shown: Pair;
    active_users_7d: number;
  };
  weeks: Week[];
  top_churches: {
    id: string;
    name: string;
    country_code: string | null;
    services: number;
    audio_seconds: number;
    verses_shown: number;
    last_service_at: string | null;
  }[];
  recent_users: { email: string; created_at: string; last_sign_in_at: string | null; confirmed: boolean; church: string | null }[];
}

const num = new Intl.NumberFormat("en-GB");
const hours = (seconds: number) => Math.round(seconds / 360) / 10;
const weekLabel = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
const shortWeek = (iso: string) => weekLabel.format(new Date(`${iso}T00:00:00Z`));

export default async function OverviewPage() {
  const supabase = await supabaseServer();
  const { data, error } = await supabase.rpc("admin_overview");

  if (error || !data) {
    return (
      <main className="w-full max-w-6xl px-4 py-8 sm:px-8">
        <Notice tone="error">Could not load the overview: {error?.message ?? "no data"}. Has migration 0026 been run?</Notice>
      </main>
    );
  }

  const o = data as Overview;
  const { totals: t, period: p } = o;

  return (
    <main className="flex w-full max-w-6xl flex-col gap-8 px-4 py-8 sm:px-8">
      <PageHead title="Overview" description="The whole platform. Changes compare the last 30 days with the 30 days before." />

      <section aria-label="Last 30 days" className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Tile label="New users" value={num.format(p.new_users.now)} pair={p.new_users} />
        <Tile label="New churches" value={num.format(p.new_churches.now)} pair={p.new_churches} />
        <Tile label="Churches holding services" value={num.format(p.active_churches.now)} pair={p.active_churches} />
        <Tile label="Services" value={num.format(p.services.now)} pair={p.services} />
        <Tile label="Hours listened" value={num.format(hours(p.audio_seconds.now))} pair={p.audio_seconds} />
        <Tile label="Verses shown" value={num.format(p.verses_shown.now)} pair={p.verses_shown} />
      </section>

      <section aria-label="Weekly" className="grid gap-3 lg:grid-cols-3">
        <WeeklyBars title="New users per week" weeks={o.weeks} value={(w) => w.users} format={(v) => num.format(v)} />
        <WeeklyBars title="Services per week" weeks={o.weeks} value={(w) => w.services} format={(v) => num.format(v)} />
        <WeeklyBars title="Hours listened per week" weeks={o.weeks} value={(w) => hours(w.audio_seconds)} format={(v) => `${num.format(v)} h`} />
      </section>

      <section aria-labelledby="totals" className="flex flex-col gap-3">
        <h2 id="totals" className="text-lg font-bold">
          All time
        </h2>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-4 rounded-xl bg-surface p-5 sm:grid-cols-3 lg:grid-cols-5">
          <Total label="Users" value={num.format(t.users)} note={`${num.format(t.users_confirmed)} confirmed, ${num.format(p.active_users_7d)} signed in this week`} />
          <Total label="Churches" value={num.format(t.churches)} note={`${num.format(t.paid_churches)} on the paid plan`} />
          <Total label="Services" value={num.format(t.services)} note={`${formatSeconds(Number(t.audio_seconds))} listened`} />
          <Total label="Shown on screen" value={num.format(Number(t.verses_shown) + Number(t.songs_shown))} note={`${num.format(t.verses_shown)} verses, ${num.format(t.songs_shown)} songs`} />
          <Total label="Library" value={num.format(Number(t.church_songs) + Number(t.shared_songs))} note={`${num.format(t.shared_songs)} shared songs, ${num.format(t.slides)} slides`} />
        </dl>
      </section>

      <div className="grid gap-8 lg:grid-cols-2">
        <section aria-labelledby="top" className="flex min-w-0 flex-col gap-3">
          <h2 id="top" className="text-lg font-bold">
            Busiest churches, last 30 days
          </h2>
          {o.top_churches.length === 0 ? (
            <p className="text-sm text-muted">No services in the last 30 days.</p>
          ) : (
            <div className="overflow-x-auto rounded-xl bg-surface">
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-muted">
                  <tr>
                    <th className="px-4 py-3 font-bold">Church</th>
                    <th className="px-4 py-3 text-right font-bold">Services</th>
                    <th className="px-4 py-3 text-right font-bold">Listened</th>
                    <th className="px-4 py-3 text-right font-bold">Verses</th>
                  </tr>
                </thead>
                <tbody>
                  {o.top_churches.map((c) => (
                    <tr key={c.id} className="border-t border-line">
                      <td className="px-4 py-3">
                        <Link href={`/churches/${c.id}`} className="font-bold hover:underline">
                          {c.name}
                        </Link>
                        <p className="text-xs text-muted">
                          {formatPlace(null, c.country_code)} · last {formatDate(c.last_service_at)}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">{num.format(c.services)}</td>
                      <td className="px-4 py-3 text-right whitespace-nowrap tabular-nums">{formatSeconds(Number(c.audio_seconds))}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{num.format(c.verses_shown)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section aria-labelledby="recent" className="flex min-w-0 flex-col gap-3">
          <h2 id="recent" className="text-lg font-bold">
            Newest users
          </h2>
          <div className="overflow-x-auto rounded-xl bg-surface">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted">
                <tr>
                  <th className="px-4 py-3 font-bold">User</th>
                  <th className="px-4 py-3 font-bold">Joined</th>
                  <th className="px-4 py-3 font-bold">Last sign-in</th>
                </tr>
              </thead>
              <tbody>
                {o.recent_users.map((u) => (
                  <tr key={u.email + u.created_at} className="border-t border-line">
                    <td className="max-w-0 px-4 py-3">
                      <p className="truncate font-bold">{u.email}</p>
                      <p className="truncate text-xs text-muted">
                        {u.church ?? "No church yet"}
                        {!u.confirmed && " · email not confirmed"}
                      </p>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">{formatDate(u.created_at)}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{u.last_sign_in_at ? formatDate(u.last_sign_in_at) : "Never"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Link href="/users" className="text-sm font-bold text-muted hover:text-ink">
            All users →
          </Link>
        </section>
      </div>
    </main>
  );
}

/** A 30-day number with its change from the 30 days before. */
function Tile({ label, value, pair }: { label: string; value: string; pair: Pair }) {
  const now = Number(pair.now);
  const before = Number(pair.before);
  const diff = now - before;
  const Icon = diff > 0 ? ArrowUpRight : diff < 0 ? ArrowDownRight : Minus;
  const change =
    diff === 0 ? "No change" : before === 0 ? "New this period" : `${diff > 0 ? "+" : ""}${Math.round((diff / before) * 100)}%`;
  return (
    <div className="rounded-xl bg-surface p-4 sm:p-5">
      <p className="text-xs font-bold text-muted">{label}</p>
      <p className="mt-1 text-3xl font-bold tabular-nums">{value}</p>
      <p className="mt-2 flex items-center gap-1 text-xs text-muted">
        <Icon size={14} className={diff > 0 ? "text-accent" : diff < 0 ? "text-negative" : "text-faint"} aria-hidden />
        <span className="font-bold text-ink">{change}</span>
        <span>vs previous 30 days</span>
      </p>
    </div>
  );
}

function Total({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-bold text-muted">{label}</dt>
      <dd className="mt-0.5 text-xl font-bold tabular-nums">{value}</dd>
      <dd className="mt-0.5 text-xs text-muted">{note}</dd>
    </div>
  );
}

/**
 * Twelve weeks as thin bars, one series in the brand green. Each bar shows
 * its week and value on hover or focus; the screen-reader table holds the
 * same numbers.
 */
function WeeklyBars({ title, weeks, value, format }: { title: string; weeks: Week[]; value: (w: Week) => number; format: (v: number) => string }) {
  const values = weeks.map((w) => Number(value(w)));
  const max = Math.max(...values, 0);
  const total = values.reduce((a, b) => a + b, 0);
  const thisWeek = values.at(-1) ?? 0;

  return (
    <figure className="flex min-w-0 flex-col gap-3 rounded-xl bg-surface p-4 sm:p-5">
      <figcaption className="flex items-baseline justify-between gap-3">
        <span className="text-sm font-bold">{title}</span>
        <span className="text-xs text-muted">
          This week <span className="font-bold text-ink tabular-nums">{format(thisWeek)}</span>
        </span>
      </figcaption>

      <div className="relative h-32 border-b border-line-strong" aria-hidden>
        {max > 0 && (
          <span className="absolute top-0 left-0 -translate-y-1/2 bg-surface pr-1 text-[10px] text-faint tabular-nums">{format(max)}</span>
        )}
        <div className="absolute inset-x-0 top-0 border-t border-dashed border-line" />
        <div className="absolute inset-0 flex items-end gap-[2px] pl-0">
          {weeks.map((w, i) => {
            const v = values[i];
            const pct = max > 0 ? (v / max) * 100 : 0;
            return (
              <div key={w.week} tabIndex={0} className="group relative flex h-full flex-1 items-end justify-center outline-none">
                <div
                  className="w-full max-w-5 rounded-t-[4px] bg-accent-fill transition-opacity group-hover:opacity-80 group-focus-visible:opacity-80"
                  style={{ height: v > 0 ? `max(${pct}%, 2px)` : 0 }}
                />
                <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 rounded-md bg-menu px-2 py-1 text-xs whitespace-nowrap shadow-pop group-hover:block group-focus-visible:block">
                  <span className="text-muted">Week of {shortWeek(w.week)}</span> <span className="font-bold tabular-nums">{format(v)}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex justify-between text-[10px] text-faint" aria-hidden>
        <span>{weeks[0] && shortWeek(weeks[0].week)}</span>
        <span>12 weeks · {format(total)} in all</span>
        <span>This week</span>
      </div>

      <table className="sr-only">
        <caption>{title}</caption>
        <thead>
          <tr>
            <th>Week of</th>
            <th>Value</th>
          </tr>
        </thead>
        <tbody>
          {weeks.map((w, i) => (
            <tr key={w.week}>
              <td>{shortWeek(w.week)}</td>
              <td>{format(values[i])}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
