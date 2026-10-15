// The translations built into the main app (public/bibles there). Listed
// here so the dashboard shows the full picture and new IDs don't clash with
// them. Keep in step with the main app's src/lib/scripture/translations.ts.
export const BUILT_IN_TRANSLATIONS = [
  { id: "kjv", short: "KJV", name: "King James Version" },
  { id: "bsb", short: "BSB", name: "Berean Standard Bible" },
  { id: "nheb", short: "NHEB", name: "New Heart English Bible" },
  { id: "asv", short: "ASV", name: "American Standard Version" },
  { id: "bbe", short: "BBE", name: "Bible in Basic English" },
  { id: "akjv", short: "AKJV", name: "American King James Version" },
  { id: "ukjv", short: "UKJV", name: "Updated King James Version" },
  { id: "dby", short: "DBY", name: "Darby Translation" },
  { id: "ylt", short: "YLT", name: "Young's Literal Translation" },
  { id: "wbt", short: "WBT", name: "Webster's Bible" },
  { id: "acv", short: "ACV", name: "A Conservative Version" },
];

export interface AdminTranslation {
  id: string;
  short: string;
  name: string;
  language: string;
  copyright: string;
  version: number;
  verse_count: number;
  published: boolean;
  updated_at: string;
}

/** A row of translation_order: where a translation sits in churches' lists, and whether it's hidden. */
export interface OrderRow {
  translation_id: string;
  position: number;
  hidden: boolean;
}

/**
 * The list in the saved order. Ones not placed yet (a new upload) go at the
 * end in their usual order. Same as inAdminOrder in the main app; keep them
 * in step.
 */
export function inAdminOrder<T extends { id: string }>(list: T[], order: OrderRow[]): (T & { order?: OrderRow })[] {
  const byId = new Map(order.map((o) => [o.translation_id, o]));
  return list
    .map((t, i) => ({ t, i, o: byId.get(t.id) }))
    .sort((a, b) => (a.o?.position ?? Infinity) - (b.o?.position ?? Infinity) || a.i - b.i)
    .map(({ t, o }) => ({ ...t, order: o }));
}
