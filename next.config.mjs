// Content-Security-Policy: restringe origens de script à própria app + Supabase.
// 'unsafe-inline'/'unsafe-eval' em script-src são exigidos pelo runtime do Next.js
// (hydration inline + dev). Migração para nonce por requisição é o próximo passo.
// Em dev o Supabase roda em http/ws no localhost; em produção só os domínios .supabase.co.
const isDev = process.env.NODE_ENV === "development";
const localSupabase = isDev ? " http://127.0.0.1:55421 ws://127.0.0.1:55421" : "";

const cspDirectives = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: https://*.supabase.co${isDev ? " http://127.0.0.1:55421" : ""}`,
  "font-src 'self' data:",
  `connect-src 'self' https://*.supabase.co wss://*.supabase.co${localSupabase}`,
  // Pré-visualização de PDF gerado no cliente (certificado, histórico) roda num
  // iframe com blob URL. Sem esta diretiva o `default-src 'self'` bloqueia o
  // frame e o preview aparece em branco. Só blob da própria origem — nada de
  // enquadrar site externo. `frame-ancestors 'none'` abaixo continua impedindo
  // que a aplicação seja enquadrada por terceiros.
  "frame-src 'self' blob:",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: cspDirectives },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: { ignoreDuringBuilds: true },
  images: {
    remotePatterns: [
      { protocol: "http",  hostname: "127.0.0.1", port: "55421", pathname: "/storage/v1/object/public/**" },
      { protocol: "https", hostname: "*.supabase.co", pathname: "/storage/v1/object/public/**" },
      { protocol: "https", hostname: "*.supabase.co", pathname: "/storage/v1/object/sign/**" },
    ],
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
