import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  // The live site's own *.vercel.app addresses send visitors to https://administrator.reedark.com.
  // Only production builds: preview builds stay reachable for testing.
  async redirects() {
    if (process.env.VERCEL_ENV !== "production") return [];
    return [
      {
        source: "/:path*",
        has: [{ type: "host", value: "(?<host>.+)\\.vercel\\.app" }],
        destination: "https://administrator.reedark.com/:path*",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
