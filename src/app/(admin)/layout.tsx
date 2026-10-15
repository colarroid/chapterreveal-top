import { AdminHeader } from "@/components/admin-header";
import { AdminSidebar } from "@/components/admin-sidebar";
import { requireAdmin } from "@/lib/supabase/server";

// Every admin page: the header across the top, sections on the left. Both
// stay put; only the page itself scrolls.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();
  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <AdminHeader email={admin.email} />
      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        <AdminSidebar />
        <div className="min-h-0 min-w-0 flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}
