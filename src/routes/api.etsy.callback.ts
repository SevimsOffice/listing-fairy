import { createFileRoute } from "@tanstack/react-router";
import { getCookie, deleteCookie } from "@tanstack/react-start/server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { exchangeEtsyCode, fetchEtsyUserAndShop } from "@/server/etsy.server";

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function html(message: string, ok: boolean) {
  const color = ok ? "#10b981" : "#ef4444";
  const title = ok ? "Etsy connected" : "Etsy connection failed";
  const safeMessage = escapeHtml(message);
  return `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title>
<style>
body{font-family:-apple-system,system-ui,sans-serif;background:#0b0b14;color:#fff;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;padding:24px}
.box{max-width:420px;text-align:center;background:rgba(255,255,255,0.04);padding:32px;border-radius:16px;border:1px solid rgba(255,255,255,0.08)}
h1{color:${color};margin:0 0 8px;font-size:20px}
p{color:#a1a1aa;margin:0 0 20px;font-size:14px}
a{color:#fff;background:${color};padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px}
</style></head><body>
<div class="box">
<h1>${title}</h1>
<p>${safeMessage}</p>
<a href="/setup">Back to Setup</a>
</div>
<script>setTimeout(()=>{window.location.href="/setup"},2500)</script>
</body></html>`;
}

export const Route = createFileRoute("/api/etsy/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state");
        const error = url.searchParams.get("error");
        const errorDesc = url.searchParams.get("error_description");

        const verifier = getCookie("etsy_pkce_verifier");
        const expectedState = getCookie("etsy_oauth_state");
        const userId = getCookie("etsy_user_id");

        // Always clear cookies after read
        deleteCookie("etsy_pkce_verifier", { path: "/" });
        deleteCookie("etsy_oauth_state", { path: "/" });
        deleteCookie("etsy_user_id", { path: "/" });

        const respond = (msg: string, ok: boolean, status = 200) =>
          new Response(html(msg, ok), {
            status,
            headers: { "Content-Type": "text/html; charset=utf-8" },
          });

        if (error) {
          return respond(errorDesc || error, false, 400);
        }
        if (!code || !state || !verifier || !expectedState || !userId) {
          return respond("Missing OAuth parameters or session expired.", false, 400);
        }
        if (state !== expectedState) {
          return respond("State mismatch. Please try again.", false, 400);
        }

        try {
          const redirectUri = `${url.origin}/api/etsy/callback`;
          const tokens = await exchangeEtsyCode({ code, verifier, redirectUri });
          const { etsyUserId, shopId, shopName } = await fetchEtsyUserAndShop(
            tokens.access_token,
          );
          const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

          const { error: dbErr } = await supabaseAdmin
            .from("etsy_connections")
            .upsert(
              {
                user_id: userId,
                access_token: tokens.access_token,
                refresh_token: tokens.refresh_token,
                expires_at: expiresAt,
                etsy_user_id: etsyUserId,
                shop_id: shopId,
                shop_name: shopName,
              },
              { onConflict: "user_id" },
            );
          if (dbErr) {
            return respond(`Failed to save connection: ${dbErr.message}`, false, 500);
          }

          return respond(
            shopName ? `Connected to ${shopName}.` : "Etsy account connected.",
            true,
          );
        } catch (e) {
          const msg = e instanceof Error ? e.message : "Unknown error";
          console.error("Etsy OAuth callback error:", msg);
          return respond(msg, false, 500);
        }
      },
    },
  },
});
