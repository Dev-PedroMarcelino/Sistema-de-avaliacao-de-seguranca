import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pacotes com WASM/binários que não devem passar pelo bundler do servidor.
  serverExternalPackages: ["@electric-sql/pglite", "@react-pdf/renderer", "exceljs", "postgres"],
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
      {
        // O fluxo do motorista e o painel nunca devem aparecer dentro de outro site.
        source: "/(i|painel|login)/:path*",
        headers: [{ key: "X-Frame-Options", value: "DENY" }],
      },
    ];
  },
};

export default nextConfig;
