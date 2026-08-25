import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  // Production `next build` typechecks the app, not verify/test scripts.
  typescript: {
    tsconfigPath: "tsconfig.build.json",
  },
};

export default nextConfig;
