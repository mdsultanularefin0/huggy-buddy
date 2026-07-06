import { createFileRoute } from "@tanstack/react-router";

// Public endpoint for pg_cron / external schedulers to trigger IMAP sync.
// Guarded by the Supabase anon apikey header (see schedule-jobs guide).
// /api/public/* bypasses Lovable's published-site auth, so we verify here.
export const Route = createFileRoute("/api/public/mail/sync")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const expected = process.env.SUPABASE_PUBLISHABLE_KEY
          ?? process.env.SUPABASE_ANON_KEY;
        const provided = request.headers.get("apikey")
          ?? request.headers.get("x-api-key");
        if (!expected || !provided || provided !== expected) {
          return new Response("Unauthorized", { status: 401 });
        }
        try {
          const { runImapSync } = await import("@/lib/email-imap.server");
          const stats = await runImapSync();
          return Response.json({ ok: true, ...stats });
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          console.error("IMAP sync failed:", msg);
          return Response.json({ ok: false, error: msg }, { status: 500 });
        }
      },
    },
  },
});
