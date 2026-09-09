import type { NextConfig } from "next";
const config: NextConfig = {
  distDir: process.env.NODE_ENV === "production" ? ".next" : ".next-dev",
  poweredByHeader: false,
};
export default config;
