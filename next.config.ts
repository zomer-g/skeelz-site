import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
  // Admin-only preview: nothing here may be indexed (robots.txt and the meta tag say the same).
  { key: "X-Robots-Tag", value: "noindex, nofollow" },
];

const isDev = process.env.NODE_ENV === "development";

// Everything the browser loads is same-origin: next/font self-hosts Rubik, the logos are in
// /public, and the job feed and the CRM are called only from the server. No GA, no GTM.
// Next's inline bootstrap scripts need 'unsafe-inline'; `next dev` also needs eval and its HMR websocket.
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  `connect-src 'self'${isDev ? " ws:" : ""}`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  experimental: {
    // The apply form carries a CV of up to 5 MB (checked again in the action). It is held in
    // memory only and forwarded to the CRM — see CLAUDE.md, "CV rule".
    serverActions: { bodySizeLimit: "6mb" },
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      { source: "/:path*", headers: [{ key: "Content-Security-Policy", value: contentSecurityPolicy }] },
    ];
  },
};

export default nextConfig;
