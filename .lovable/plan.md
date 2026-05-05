## Root cause

`src/lib/auth.tsx` defines `AuthProvider`, but it's never mounted anywhere in the tree. `src/routes/__root.tsx`'s `RootComponent` only renders `<Outlet />`. Every component that calls `useAuth()` therefore reads the **default context value** — `{ user: null, loading: true }` — which never changes. The spinner on `/` (and on `/_app`) waits on `loading` and stays forever.

This is why no amount of CSP tweaks, timeouts, or fallback UIs fixed it: the JS runs fine, the auth state just never gets initialized because the provider is missing.

## Fix

Edit `src/routes/__root.tsx`:
- Import `AuthProvider` from `@/lib/auth`.
- Wrap `<Outlet />` in `RootComponent` with `<AuthProvider>`.

That's the whole fix. The existing timeout/error UI on the setup page can stay as a safety net.

## Technical notes

- `AuthProvider` calls `supabase.auth.getSession()` and subscribes to `onAuthStateChange` in a `useEffect`, both of which only run on the client — safe to mount at the root for SSR.
- After this, `/` will redirect to `/auth` (signed out) or `/setup` (signed in), and `/_app` routes will stop hanging.
