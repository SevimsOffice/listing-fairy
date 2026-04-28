import { createMiddleware } from "@tanstack/react-start";
import { setResponseHeaders } from "@tanstack/react-start/server";

export const SECURITY_HEADERS: Record<string, string> = {
  "Content-Security-Policy":
    "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.supabase.co; connect-src 'self' ws: wss: https://api.anthropic.com https://openapi.etsy.com https://*.supabase.co; img-src 'self' data: blob: https:; style-src 'self' 'unsafe-inline'; font-src 'self' data:; worker-src 'self' blob:; base-uri 'self'; form-action 'self';",
  "X-Content-Type-Options": "nosniff",
  "X-XSS-Protection": "1; mode=block",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "geolocation=(), microphone=(), camera=()",
};

export const securityHeadersMiddleware = createMiddleware().server(
  async ({ next }) => {
    setResponseHeaders(SECURITY_HEADERS);
    return next();
  },
);
