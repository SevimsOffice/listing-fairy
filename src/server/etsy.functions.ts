import { createServerFn } from "@tanstack/react-start";
import { setCookie, getCookie, deleteCookie } from "@tanstack/react-start/server";
import { redirect } from "@tanstack/react-router";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import crypto from "crypto";

const ETSY_AUTH_URL = "https://www.etsy.com/oauth/connect";
const ETSY_TOKEN_URL = "https://api.etsy.com/v3/public/oauth/token";
const SCOPES = [
  "listings_r",
  "listings_w",
  "shops_r",
  "transactions_r",
].join(" ");

function base64url(buf: Buffer) {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function getRedirectUri(origin: string) {
  return `${origin}/api/etsy/callback`;
}

export const startEtsyOAuth = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { origin: string }) => input)
  .handler(async ({ data, context }) => {
    const keystring = process.env.ETSY_KEYSTRING;
    if (!keystring) {
      return { error: "Etsy API key not configured on server." };
    }

    const verifier = base64url(crypto.randomBytes(48));
    const challenge = base64url(
      crypto.createHash("sha256").update(verifier).digest(),
    );
    const state = base64url(crypto.randomBytes(24));

    const cookieOpts = {
      httpOnly: true,
      secure: true,
      sameSite: "lax" as const,
      path: "/",
      maxAge: 60 * 10, // 10 min
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

// Helpers used by the callback route
export async function exchangeEtsyCode(params: {
  code: string;
  verifier: string;
  redirectUri: string;
}) {
  const keystring = process.env.ETSY_KEYSTRING!;
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: keystring,
    redirect_uri: params.redirectUri,
    code: params.code,
    code_verifier: params.verifier,
  });
  const res = await fetch(ETSY_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token exchange failed: ${res.status} ${text}`);
  }
  return res.json() as Promise<{
    access_token: string;
    refresh_token: string;
    expires_in: number;
    token_type: string;
  }>;
}

export async function fetchEtsyUserAndShop(accessToken: string) {
  const keystring = process.env.ETSY_KEYSTRING!;
  // The access token format is "<user_id>.<token>"
  const etsyUserId = accessToken.split(".")[0];

  // Get shops for the user
  const shopRes = await fetch(
    `https://openapi.etsy.com/v3/application/users/${etsyUserId}/shops`,
    {
      headers: {
        "x-api-key": keystring,
        Authorization: `Bearer ${accessToken}`,
      },
    },
  );

  let shopId: string | null = null;
  let shopName: string | null = null;
  if (shopRes.ok) {
    const shop = await shopRes.json();
    shopId = shop?.shop_id ? String(shop.shop_id) : null;
    shopName = shop?.shop_name ?? null;
  }

  return { etsyUserId, shopId, shopName };
}

export { getCookie, deleteCookie };
