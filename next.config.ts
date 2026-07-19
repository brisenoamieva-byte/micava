import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // Avoid picking up C:\Users\brise\package-lock.json as monorepo root
  turbopack: {
    root: path.resolve(__dirname),
  },
};

export default nextConfig;
