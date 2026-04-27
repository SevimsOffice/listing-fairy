import { createServerFn } from "@tanstack/react-start";
import { fileTypeFromBuffer } from "file-type";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { attachSupabaseAuth } from "@/integrations/supabase/auth-client-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const ALLOWED_TYPES = new Set(["image/png", "image/jpeg"]);
const MAX_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_EXTENSIONS = /\.(jpg|jpeg|png)$/i;
const BUCKET = "listing-images";

const inputSchema = z.object({
  file: z.string().min(1).max(20 * 1024 * 1024), // base64 string upper bound
  filename: z.string().min(1).max(255),
  subject: z.string().trim().min(1).max(200),
  gradeLevel: z.string().trim().min(1).max(100),
  prompt: z.string().trim().max(2000).optional(),
  price: z.number().min(0.2).max(50000).optional(),
});

function decodeBase64(input: string): Uint8Array {
  // Strip optional data URL prefix
  const commaIdx = input.indexOf(",");
  const b64 = commaIdx >= 0 && input.startsWith("data:") ? input.slice(commaIdx + 1) : input;
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export const uploadListingImage = createServerFn({ method: "POST" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .inputValidator((input: unknown) => inputSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;

    try {
      // 1. Extension check
      if (!ALLOWED_EXTENSIONS.test(data.filename)) {
        return { success: false as const, error: "Only PNG and JPG images are allowed" };
      }

      // 2. Decode base64
      let bytes: Uint8Array;
      try {
        bytes = decodeBase64(data.file);
      } catch {
        return { success: false as const, error: "Invalid image file. Please try a different image" };
      }

      // 3. Size check
      if (bytes.byteLength > MAX_SIZE) {
        return { success: false as const, error: "File is too large. Maximum size is 10MB" };
      }
      if (bytes.byteLength < 64) {
        return { success: false as const, error: "Invalid image file. Please try a different image" };
      }

      // 4. Magic-byte MIME detection
      const detected = await fileTypeFromBuffer(bytes);
      if (!detected || !ALLOWED_TYPES.has(detected.mime)) {
        return { success: false as const, error: "Only PNG and JPG images are allowed" };
      }

      // 5. Upload to storage
      const ext = detected.mime === "image/png" ? "png" : "jpg";
      const id = crypto.randomUUID();
      const objectPath = `${userId}/${id}.${ext}`;

      const { error: uploadErr } = await supabaseAdmin.storage
        .from(BUCKET)
        .upload(objectPath, bytes, {
          contentType: detected.mime,
          upsert: false,
        });

      if (uploadErr) {
        console.error("Storage upload error:", uploadErr);
        return { success: false as const, error: "Upload failed. Please try again" };
      }

      // 6. Insert draft listing
      const { data: row, error: insertErr } = await supabaseAdmin
        .from("draft_listings")
        .insert({
          user_id: userId,
          subject: data.subject,
          grade_level: data.gradeLevel,
          prompt: data.prompt ?? null,
          price: data.price ?? null,
          image_data: objectPath,
          status: "pending_generation",
        })
        .select("id")
        .single();

      if (insertErr || !row) {
        console.error("Insert draft_listing error:", insertErr);
        // Best-effort cleanup
        await supabaseAdmin.storage.from(BUCKET).remove([objectPath]).catch(() => {});
        return { success: false as const, error: "Upload failed. Please try again" };
      }

      // 7. Signed URL for preview (1 hour)
      const { data: signed } = await supabaseAdmin.storage
        .from(BUCKET)
        .createSignedUrl(objectPath, 60 * 60);

      return {
        success: true as const,
        listingId: row.id,
        path: objectPath,
        url: signed?.signedUrl ?? null,
      };
    } catch (err) {
      console.error("uploadListingImage error:", err);
      return { success: false as const, error: "Upload failed. Please try again" };
    }
  });
