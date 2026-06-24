import { createStart } from "@tanstack/react-start";
import { securityHeadersMiddleware } from "./middleware/security-headers";
import { attachSupabaseAuth } from "@/integrations/supabase/auth-attacher";

export const startInstance = createStart(() => ({
  functionMiddleware: [attachSupabaseAuth],
  requestMiddleware: [securityHeadersMiddleware],
}));
