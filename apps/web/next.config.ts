import type { NextConfig } from "next";

/**
 * This branch ships one look of the leadership views (blend), so the addresses of the other looks lead to the same page
 * in this one. Keep the default in step with DEFAULT in src/lib/admin/looks.ts.
 */
const TABS = "pulse|pairings|overview|constellation|insights|trends|map|summary|privacy|reports";
const only = (process.env.NEXT_PUBLIC_LOOKS ?? "blend").trim();

const nextConfig: NextConfig = {
  async redirects() {
    if (only !== "blend") return [];
    return [
    { source: "/admin", destination: "/admin/blend/pulse", permanent: false },
    { source: `/admin/:tab(${TABS})`, destination: "/admin/blend/:tab", permanent: false },
    { source: "/admin/aurora/:path*", destination: "/admin/blend/:path*", permanent: false },
    ];
  },
};

export default nextConfig;
