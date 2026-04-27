import crypto from "crypto";

export const ETSY_AUTH_URL = "https://www.etsy.com/oauth/connect";
export const ETSY_TOKEN_URL = "https://api.etsy.com/v3/public/oauth/token";
export const SCOPES = ["listings_r", "listings_w", "shops_r", "transactions_r"].join(" ");

export function base64url(buf: Buffer) {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function generatePkce() {
  const verifier = base64url(crypto.randomBytes(48));
  const challenge = base64url(crypto.createHash("sha256").update(verifier).digest());
  const state = base64url(crypto.randomBytes(24));
  return { verifier, challenge, state };
}

export function getRedirectUri(origin: string) {
  return `${origin}/api/etsy/callback`;
}

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
  const etsyUserId = accessToken.split(".")[0];

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
