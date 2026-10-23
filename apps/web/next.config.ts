import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The standalone teacher-dashboard artifact lives in public/mentortrdash.
  async rewrites() {
    return [{ source: "/mentortrdash", destination: "/mentortrdash/index.html" }];
  },
};

export default nextConfig;
