import type { NextConfig } from "next";

/**
 * This branch ships one look of the leadership views (nick), so the addresses of the other looks lead to the same page
 * in this one. Keep the default in step with DEFAULT in src/lib/admin/looks.ts.
 */
const only = (process.env.NEXT_PUBLIC_LOOKS ?? "nick").trim();

const nextConfig: NextConfig = {
  async redirects() {
    if (only !== "nick") return [];
    return [
    { source: "/admin/aurora/:path*", destination: "/admin/:path*", permanent: false },
    { source: "/admin/blend/:path*", destination: "/admin/:path*", permanent: false },
    ];
  },
};

export default nextConfig;
