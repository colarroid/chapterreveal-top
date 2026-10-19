"use client";

import { Analytics as VercelAnalytics } from "@vercel/analytics/next";

/** Vercel Web Analytics: page views, no cookies. Query strings are dropped. */
export function Analytics() {
  return (
    <VercelAnalytics
      beforeSend={(event) => {
        const url = new URL(event.url);
        return { ...event, url: url.origin + url.pathname };
      }}
    />
  );
}
