import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Phone recipe photos are often several MB; default Server Action limit is 1mb
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
};

export default nextConfig;
