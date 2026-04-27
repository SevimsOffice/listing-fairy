import { createServerFn } from "@tanstack/react-start";
import PQueue from "p-queue";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { attachSupabaseAuth } from "@/integrations/supabase/auth-client-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const ETSY_API = "https://openapi.etsy.com/v3/application";
const STORAGE_BUCKET = "listing-images";

type PublishResult = {
  listingId: string;
  success: boolean;
  etsyUrl?: string;
  error?: string;
};

class EtsyAuthError extends Error {
  constructor(message = "Etsy authentication expired") {
    super(message);
    this.name = "EtsyAuthError";
  }
}

async function etsyFetch(
  url: string,
  init: RequestInit,
  accessToken: string,
): Promise<Response> {
  const keystring = process.env.ETSY_KEYSTRING!;
  const headers = new Headers(init.headers);
  headers.set("x-api-key", keystring);
  headers.set("Authorization", `Bearer ${accessToken}`);

  let res = await fetch(url, { ...init, headers });

  // Retry once on 429
  if (res.status === 429) {
    await new Promise((r) => setTimeout(r, 60_000));
    res = await fetch(url, { ...init, headers });
  }

  if (res.status === 401 || res.status === 403) {
    throw new EtsyAuthError();
  }
  return res;
}

async function publishSingleListing(
  listingId: string,
  userId: string,
  conn: { access_token: string; shop_id: string },
): Promise<PublishResult> {
  // 1. Fetch draft
  const { data: draft, error } = await supabaseAdmin
    .from("draft_listings")
    .select(
      "id, user_id, generated_title, generated_description, generated_tags, price, image_url, status",
    )
    .eq("id", listingId)
    .eq("user_id", userId)
    .single();

  if (error || !draft) {
    return { listingId, success: false, error: "Listing not found" };
  }
  if (
    !draft.generated_title ||
    !draft.generated_description ||
    !draft.image_url ||
    draft.price == null
  ) {
    return {
      listingId,
      success: false,
      error: "Listing is missing required fields",
    };
  }

  try {
    // 2. Create draft listing on Etsy
    const createBody = new URLSearchParams({
      quantity: "999",
      title: draft.generated_title.slice(0, 140),
      description: draft.generated_description,
      price: String(draft.price),
      who_made: "i_did",
      when_made: "made_to_order",
      taxonomy_id: "1027", // Digital prints; user can adjust later
      type: "download",
      state: "draft",
    });
    for (const tag of (draft.generated_tags ?? []).slice(0, 13)) {
      createBody.append("tags", tag);
    }

    const createRes = await etsyFetch(
      `${ETSY_API}/shops/${conn.shop_id}/listings`,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: createBody,
      },
      conn.access_token,
    );

    if (!createRes.ok) {
      const text = await createRes.text();
      console.error("Etsy create listing failed:", createRes.status, text);
      throw new Error(`Etsy create failed (${createRes.status})`);
    }
    const created = (await createRes.json()) as {
      listing_id: number;
      url?: string;
    };
    const etsyListingId = created.listing_id;
    const etsyUrl =
      created.url ?? `https://www.etsy.com/listing/${etsyListingId}`;

    // 3. Download image from storage and upload to Etsy
    const { data: imgBlob, error: dlErr } = await supabaseAdmin.storage
      .from(STORAGE_BUCKET)
      .download(draft.image_url);

    if (dlErr || !imgBlob) {
      throw new Error("Could not load image for upload");
    }

    const form = new FormData();
    form.append(
      "image",
      new File([imgBlob], "image.jpg", { type: "image/jpeg" }),
    );
    form.append("rank", "1");

    const imgRes = await etsyFetch(
      `${ETSY_API}/shops/${conn.shop_id}/listings/${etsyListingId}/images`,
      { method: "POST", body: form },
      conn.access_token,
    );

    if (!imgRes.ok) {
      const text = await imgRes.text();
      console.error("Etsy image upload failed:", imgRes.status, text);
      // Listing was created but image failed — still mark published, surface warning
    }

    // 4. Update draft
    await supabaseAdmin
      .from("draft_listings")
      .update({
        etsy_listing_id: String(etsyListingId),
        etsy_listing_url: etsyUrl,
        status: "published",
        error_message: null,
      })
      .eq("id", listingId);

    return { listingId, success: true, etsyUrl };
  } catch (e) {
    if (e instanceof EtsyAuthError) {
      await supabaseAdmin
        .from("draft_listings")
        .update({
          status: "publish_failed",
          error_message: "Please reconnect Etsy",
        })
        .eq("id", listingId);
      return {
        listingId,
        success: false,
        error: "Please reconnect Etsy",
      };
    }
    const msg =
      e instanceof TypeError
        ? "Connection failed, please try again"
        : e instanceof Error
          ? e.message
          : "Publish failed";

    await supabaseAdmin
      .from("draft_listings")
      .update({ status: "publish_failed", error_message: msg })
      .eq("id", listingId);
    return { listingId, success: false, error: msg };
  }
}

export const publishListings = createServerFn({ method: "POST" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        listingIds: z.array(z.string().uuid()).min(1).max(100),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;

    // Load Etsy connection (admin client — table SELECT is restricted)
    const { data: conn, error: connErr } = await supabaseAdmin
      .from("etsy_connections")
      .select("access_token, shop_id")
      .eq("user_id", userId)
      .maybeSingle();

    if (connErr || !conn?.access_token || !conn.shop_id) {
      return {
        success: false as const,
        error: "Etsy is not connected. Please connect Etsy in Setup.",
        results: [] as PublishResult[],
      };
    }

    const queue = new PQueue({
      concurrency: 2,
      interval: 1000,
      intervalCap: 4,
      timeout: 30_000,
    });

    const results = (await Promise.all(
      data.listingIds.map((id) =>
        queue.add(
          () =>
            publishSingleListing(id, userId, {
              access_token: conn.access_token!,
              shop_id: conn.shop_id!,
            }),
          { priority: 0 },
        ),
      ),
    )) as PublishResult[];

    return { success: true as const, results };
  });
