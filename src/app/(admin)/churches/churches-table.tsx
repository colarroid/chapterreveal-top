"use client";

import { ChevronRight, LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { PageHead, SearchBox } from "@/components/page-head";

export interface AdminChurch {
  id: string;
  name: string;
  place: string;
  createdBy: string;
  joined: string;
  members: number;
  services: number;
  lastService: string;
  listened: string;
}

export function ChurchesTable({ churches }: { churches: AdminChurch[] }) {
  const router = useRouter();
  // The row clicked, until its page opens: a click should never look ignored.
  const [opening, setOpening] = useState<string | null>(null);
  const open = (id: string) => {
    setOpening(id);
    router.push(`/churches/${id}`);
  };
  const [query, setQuery] = useState("");

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? churches.filter((c) => [c.name, c.place, c.createdBy].some((f) => f.toLowerCase().includes(q))) : churches;
  }, [churches, query]);

  return (
    <div className="space-y-4">
      <PageHead
        title="Churches"
        description={`${churches.length.toLocaleString()} ${churches.length === 1 ? "church" : "churches"}`}
        right={<SearchBox value={query} onChange={setQuery} placeholder="Search name, place, owner" />}
      />

      <div className="overflow-x-auto rounded-lg bg-surface">
        <table className="w-full min-w-[820px] text-left text-sm">
          <thead className="text-xs text-muted">
            <tr className="border-b border-line">
              <th className="px-4 py-3 font-bold">Church</th>
              <th className="px-4 py-3 text-right font-bold">Members</th>
              <th className="px-4 py-3 text-right font-bold">Services</th>
              <th className="px-4 py-3 font-bold">Last service</th>
              <th className="px-4 py-3 font-bold">Listened</th>
              <th className="px-4 py-3 font-bold">Joined</th>
              <th className="w-8" />
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {shown.map((c) => (
              // The whole row opens the church; the link inside keeps it
              // reachable by keyboard and middle-click.
              <tr key={c.id} onClick={() => open(c.id)} className={`cursor-pointer transition hover:bg-surface-2 ${opening === c.id ? "bg-surface-2" : ""}`}>
                <td className="px-4 py-3">
                  <a
                    href={`/churches/${c.id}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      // A plain click opens in place with the spinner; Ctrl/middle-click still opens a tab.
                      if (e.button === 0 && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
                        e.preventDefault();
                        open(c.id);
                      }
                    }}
                    className="font-semibold hover:underline"
                  >
                    {c.name}
                  </a>
                  <span className="block text-muted">{c.place}</span>
                  {c.createdBy && <span className="block text-xs text-faint">{c.createdBy}</span>}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">{c.members}</td>
                <td className="px-4 py-3 text-right tabular-nums">{c.services}</td>
                <td className="px-4 py-3 whitespace-nowrap text-muted">{c.lastService}</td>
                <td className="px-4 py-3 whitespace-nowrap text-muted">{c.listened}</td>
                <td className="px-4 py-3 whitespace-nowrap text-muted">{c.joined}</td>
                <td className="pr-3 text-faint">
                  {opening === c.id ? <LoaderCircle size={16} className="animate-spin text-ink" /> : <ChevronRight size={16} />}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {shown.length === 0 && <p className="px-4 py-10 text-center text-sm text-muted">No churches match.</p>}
      </div>
    </div>
  );
}
