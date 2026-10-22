"use client";

import { Building2, LayoutDashboard, LibraryBig, LoaderCircle, Music, Palette, Users, type LucideIcon } from "lucide-react";
import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";

const SECTIONS: { href: string; label: string; icon: LucideIcon; soon?: boolean }[] = [
  { href: "/overview", label: "Overview", icon: LayoutDashboard },
  { href: "/", label: "Translations", icon: LibraryBig },
  { href: "/lyrics", label: "Lyrics", icon: Music },
  { href: "/design", label: "Design", icon: Palette },
  { href: "/churches", label: "Churches", icon: Building2 },
  { href: "/users", label: "Users", icon: Users },
];

// Spinner from the click until the page is ready, so a click never looks ignored.
function NavIcon({ icon: Icon }: { icon: LucideIcon }) {
  const { pending } = useLinkStatus();
  return pending ? <LoaderCircle size={17} className="animate-spin" /> : <Icon size={17} />;
}

// A column on the left on desktop; a scrolling row of tabs on phones.
export function AdminSidebar() {
  const path = usePathname();
  return (
    <nav aria-label="Admin sections" className="shrink-0 border-line md:w-56 md:overflow-y-auto md:border-r">
      <ul className="flex gap-1 overflow-x-auto px-3 py-2 md:flex-col md:overflow-visible md:py-4">
        {SECTIONS.map(({ href, label, icon, soon }) => {
          const active = href === "/" ? path === "/" : path.startsWith(href);
          return (
            <li key={href} className="shrink-0">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex h-10 items-center gap-3 rounded-lg px-3 text-[15px] transition ${
                  active ? "bg-surface-2 font-bold text-ink" : "text-muted hover:bg-surface-2 hover:text-ink"
                }`}
              >
                <NavIcon icon={icon} />
                <span className="flex-1 whitespace-nowrap">{label}</span>
                {soon && <span className="hidden text-[10px] font-bold tracking-wider text-faint uppercase md:inline">Soon</span>}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
