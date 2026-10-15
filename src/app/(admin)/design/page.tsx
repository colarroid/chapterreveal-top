import { Notice } from "@/components/ui";
import type { SharedBackground } from "@/lib/backgrounds";
import { supabaseServer } from "@/lib/supabase/server";
import { Design, type SharedGradient } from "./design";

export const metadata = { title: "Design" };

// What every church can pick in Design: videos, pictures and gradients.
export default async function DesignPage() {
  const supabase = await supabaseServer();
  const [backgrounds, gradients] = await Promise.all([
    supabase.from("backgrounds").select("id, kind, url, name, bytes, created_at").is("church_id", null).order("created_at", { ascending: false }),
    supabase.from("gradients").select("id, name, from_color, to_color, angle").is("church_id", null).order("created_at"),
  ]);
  const error = backgrounds.error ?? gradients.error;

  return (
    <main className="w-full px-4 py-8 sm:px-8">
      {error ? (
        <Notice tone="error">Could not load designs: {error.message}. Have migrations 0014, 0015 and 0016 been run?</Notice>
      ) : (
        <Design initialBackgrounds={(backgrounds.data ?? []) as SharedBackground[]} initialGradients={(gradients.data ?? []) as SharedGradient[]} />
      )}
    </main>
  );
}
