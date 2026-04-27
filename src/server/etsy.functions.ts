import { createServerFn } from "@tanstack/react-start";
import { setCookie } from "@tanstack/react-start/server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  ETSY_AUTH_URL,
  SCOPES,
  generatePkce,
  getRedirectUri,
} from "./etsy.server";

export const startEtsyOAuth = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { origin: string }) => input)
  .handler(async ({ data, context }) => {
    const keystring = process.env.ETSY_KEYSTRING;
    if (!keystring) {
      return { error: "Etsy API key not configured on server." };
    }

    const { verifier, challenge, state } = generatePkce();

    const cookieOpts = {
      httpOnly: true,
      secure: true,
      sameSite: "lax" as const,
      path: "/",
      maxAge: 60 * 10,
    };
    setCookie("etsy_pkce_verifier", verifier, cookieOpts);
    setCookie("etsy_oauth_state", state, cookieOpts);
    setCookie("etsy_user_id", context.userId, cookieOpts);

    const url = new URL(ETSY_AUTH_URL);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("client_id", keystring);
    url.searchParams.set("redirect_uri", getRedirectUri(data.origin));
    url.searchParams.set("scope", SCOPES);
    url.searchParams.set("state", state);
    url.searchParams.set("code_challenge", challenge);
    url.searchParams.set("code_challenge_method", "S256");

    return { url: url.toString() };
  });

export const disconnectEtsy = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("etsy_connections")
      .delete()
      .eq("user_id", userId);
    if (error) return { error: error.message };
    return { success: true };
  });
