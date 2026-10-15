import { LoaderCircle } from "lucide-react";

// Shown the instant a church is clicked, while its page loads.
export default function Loading() {
  return (
    <main className="w-full max-w-5xl space-y-6 px-4 py-8 sm:px-8">
      <div className="space-y-2">
        <div className="h-4 w-24 animate-pulse rounded bg-surface-2" />
        <div className="h-8 w-72 animate-pulse rounded bg-surface-2" />
        <div className="h-4 w-56 animate-pulse rounded bg-surface-2" />
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-[68px] animate-pulse rounded-lg bg-surface" />
        ))}
      </div>
      <div className="grid h-64 place-items-center rounded-lg bg-surface">
        <LoaderCircle size={22} className="animate-spin text-faint" />
      </div>
    </main>
  );
}
