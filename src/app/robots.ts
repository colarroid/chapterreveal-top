import type { MetadataRoute } from "next";

// The admin site is private: no search engine should list any of it.
export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: "*", disallow: "/" } };
}
