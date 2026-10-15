import { BibleReader, type ReaderTranslation } from "@/components/bible-reader";
import { BUILT_IN_TRANSLATIONS, inAdminOrder, type AdminTranslation, type OrderRow } from "@/lib/scripture/translations";
import { supabaseServer } from "@/lib/supabase/server";
import { Translations, type ListItem } from "./translations";

export const metadata = { title: "Translations" };

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "";
const storageUrl = (id: string, version: number) => `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/bibles/${id}/v${version}.json`;

export default async function TranslationsPage() {
  // The layout has already checked this is a platform admin.
  const supabase = await supabaseServer();
  const [{ data }, { data: orderRows, error: orderError }] = await Promise.all([
    supabase.from("translations").select("id, short, name, language, copyright, version, verse_count, published, updated_at").order("short"),
    supabase.from("translation_order").select("translation_id, position, hidden"),
  ]);
  const added = (data ?? []) as AdminTranslation[];

  // One list, built-in and added, in the order churches see it. Hidden means
  // `hidden` for built-in ones and not published for added ones.
  const items: ListItem[] = inAdminOrder(
    [
      ...BUILT_IN_TRANSLATIONS.map((t) => ({ id: t.id, short: t.short, name: t.name, added: null })),
      ...added.map((t) => ({ id: t.id, short: t.short, name: t.name, added: t })),
    ],
    (orderRows ?? []) as OrderRow[],
  ).map(({ order, ...t }) => ({ ...t, hidden: t.added ? !t.added.published : !!order?.hidden }));

  // Built-in text is served by the main app; uploads by Supabase Storage.
  const reader: ReaderTranslation[] = [
    ...BUILT_IN_TRANSLATIONS.map((t) => ({ ...t, url: `${APP_URL}/bibles/${t.id}.json` })),
    ...added.map((t) => ({ id: t.id, short: t.short, name: t.name, url: storageUrl(t.id, t.version), hidden: !t.published })),
  ];

  return (
    <div className="grid gap-4 px-4 py-8 sm:px-8 lg:grid-cols-[minmax(0,1fr)_minmax(320px,400px)] lg:items-start">
      <Translations items={items} orderReady={!orderError} />
      <BibleReader translations={reader} />
    </div>
  );
}
