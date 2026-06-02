import path from "node:path";
import { fileURLToPath } from "node:url";
import withSerwistInit from "@serwist/next";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      "@": path.resolve(__dirname, "src"),
    };
    return config;
  },
};

const withSerwist = withSerwistInit({
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
  // The service worker only makes sense for the deployed app; skipping it in
  // dev keeps HMR fast and avoids stale-cache surprises while iterating.
  disable: process.env.NODE_ENV === "development",
});

export default withSerwist(nextConfig);
