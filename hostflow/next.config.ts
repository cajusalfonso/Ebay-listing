import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // HostFlow ist eine eigenständige App im Unterordner `hostflow/`. Das Repo-
  // Root enthält ein zweites Projekt (+ Lockfile); ohne festen Tracing-Root
  // würde Next.js fälschlich das Repo-Root als Workspace-Root wählen.
  outputFileTracingRoot: path.join(import.meta.dirname),
  // Supabase Storage liefert Bilder von der Projekt-Domain aus.
  // Konkrete Hostnamen werden über NEXT_PUBLIC_SUPABASE_URL aufgelöst.
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
      },
    ],
  },
};

export default nextConfig;
