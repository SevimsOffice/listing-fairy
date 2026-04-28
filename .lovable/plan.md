## Problem

The page is stuck on the loading spinner because the **Content-Security-Policy** header sent by `src/middleware/security-headers.ts` is blocking the scripts the app needs to boot.

Current CSP (relevant parts):
- `script-src 'self' https://cdn.supabase.co`
- `connect-src 'self' https://api.anthropic.com https://openapi.etsy.com https://*.supabase.co wss://*.supabase.co`

Why this breaks loading:
1. **Vite injects inline scripts and uses `eval` in dev** — `script-src 'self'` (no `'unsafe-inline'`, no `'unsafe-eval'`) blocks the dev client and the SSR hydration bootstrap. Result: HTML loads, but no JS runs → spinner forever.
2. **HMR websocket** uses `ws://` on the preview origin — not allowed by current `connect-src`.
3. **Lovable preview tooling** (component tagger, error overlay) injects scripts the CSP rejects.
4. The unrelated `tailwind.config.ts` esbuild warning in the dev log is harmless and not the cause.

## Fix

Update `src/middleware/security-headers.ts` so the CSP allows the app to actually run, while keeping the security improvements from the earlier OAuth/security work.

### Changes to CSP

- `script-src`: add `'unsafe-inline'` and `'unsafe-eval'` (required for Vite/React dev + SSR hydration in this stack), keep `'self'` and `https://cdn.supabase.co`.
- `connect-src`: add `ws:` and `wss:` (HMR + general websocket), keep existing API origins.
- `style-src`: keep `'self' 'unsafe-inline'` (already correct for Tailwind).
- `img-src`: keep `'self' data: https: blob:` (add `blob:` so uploaded image previews work).
- `font-src`: add `'self' data:`.
- `worker-src`: add `'self' blob:` (some libs spawn workers from blobs).
- Keep `base-uri 'self'`, `form-action 'self'`, `frame-ancestors` removed (already done so preview iframe works).

Other headers (`X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, `X-XSS-Protection`) stay as-is.

### File to edit

- `src/middleware/security-headers.ts` — replace the `Content-Security-Policy` value with the corrected directive list above.

No other files need changes. After the edit, the preview will load normally and HMR will reconnect.

## Technical notes

- `'unsafe-eval'` is needed because TanStack Start's dev SSR + Vite transform pipeline relies on dynamic evaluation. Removing it is only feasible in a fully built production deployment with hashed/nonce'd scripts, which is out of scope for this fix.
- If desired later, we can split CSP per environment (`import.meta.env.DEV`) to keep production strict while dev is permissive — happy to do that as a follow-up.