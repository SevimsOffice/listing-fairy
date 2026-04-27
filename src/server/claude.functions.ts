import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { attachSupabaseAuth } from "@/integrations/supabase/auth-client-middleware";
import { generateEtsyListing } from "./claude.server";

export const generateListing = createServerFn({ method: "POST" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .inputValidator(
    (input: {
      subject: string;
      gradeLevel: string;
      originalPrompt?: string;
      defaultTags: string;
      imageId: string;
    }) => input,
  )
  .handler(async ({ data }) => {
    try {
      const result = await generateEtsyListing({
        subject: data.subject,
        gradeLevel: data.gradeLevel,
        originalPrompt: data.originalPrompt,
        defaultTags: data.defaultTags,
      });

      return {
        success: true as const,
        imageId: data.imageId,
        ...result,
      };
    } catch (e) {
      console.error("Generate listing error:", e);
      return {
        success: false as const,
        error: e instanceof Error ? e.message : "Failed to generate listing",
        imageId: data.imageId,
      };
    }
  });
