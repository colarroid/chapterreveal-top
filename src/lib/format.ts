// Dates and durations for the admin tables. Fixed locale and time zone so
// the server and the browser print the same thing (no hydration mismatch).

const dateFmt = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Africa/Lagos" });
const dateTimeFmt = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Africa/Lagos",
});

export const formatDate = (iso: string | null | undefined) => (iso ? dateFmt.format(new Date(iso)) : "—");
export const formatDateTime = (iso: string | null | undefined) => (iso ? dateTimeFmt.format(new Date(iso)) : "—");

/** "2 h 05 min", "45 min", "under a minute". */
export function formatSeconds(total: number): string {
  if (total < 60) return total > 0 ? "under a minute" : "0 min";
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  return h ? `${h} h ${String(m).padStart(2, "0")} min` : `${m} min`;
}

const regionNames = new Intl.DisplayNames(["en"], { type: "region" });

/** "Lagos, Nigeria" from a region and an ISO country code. */
export function formatPlace(region: string | null, country: string | null): string {
  let name = "";
  try {
    name = country ? (regionNames.of(country) ?? country) : "";
  } catch {
    name = country ?? "";
  }
  return [region, name].filter(Boolean).join(", ") || "—";
}
