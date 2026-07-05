import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Returns whether the currently authenticated user has the admin role.
 * Throws (via requireSupabaseAuth) if the user is not signed in.
 * Used by the /admin route's beforeLoad guard to keep the UI from flashing
 * for non-admins.
 */
export const checkAdminAccess = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { isAdmin } = await import("@/lib/admin-guard.server");
    const ok = await isAdmin(context.userId, context.supabase);
    return { isAdmin: ok, userId: context.userId };
  });
