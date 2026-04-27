import { createMiddleware } from "@tanstack/react-start";
import { supabase } from "./client";

/**
 * Client middleware that attaches the current user's Supabase JWT as the
 * Authorization header so server functions guarded by `requireSupabaseAuth`
 * can authenticate the request.
 */
export const attachSupabaseAuth = createMiddleware({ type: "function" }).client(
  async ({ next }) => {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    return next({
      sendContext: {},
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
  },
);
