import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { attachSupabaseAuth } from "@/integrations/supabase/auth-client-middleware";
import { generateEtsyListing } from "@/server/claude.server";

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
      // Log full details server-side for debugging
      console.error("Generate listing error:", {
        error: e instanceof Error ? e.stack : e,
        imageId: data.imageId,
        subject: data.subject?.substring(0, 30),
        timestamp: new Date().toISOString(),
      });
      return {
        success: false as const,
        error:
          "We couldn't generate your listing due to a technical issue. Please try again, or contact support if the problem persists.",
        imageId: data.imageId,
      };
    }
  });
