// Server-only IMAP sync worker. Imported by email.functions.ts and the
// /api/public/mail/sync route. Kept out of .functions.ts to avoid the
// tss-serverfn-split transformer stripping / dropping it.
import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { decryptJson } from "@/lib/integration-crypto.server";

export type ImapCreds = {
  host: string;
  port: number;
  secure: boolean;
  username: string;
  password: string;
  mailbox: string;
  mailboxes?: string[];
  mark_seen: boolean;
  import_all?: boolean;
};

function resolveMailboxes(c: ImapCreds): string[] {
  const list = (c.mailboxes && c.mailboxes.length ? c.mailboxes : [c.mailbox || "INBOX"])
    .map((m) => m.trim()).filter(Boolean);
  return list.length ? list : ["INBOX"];
}

const MAX_PER_RUN = 50;

const IMAP_PROVIDER = "imap";

export async function loadImapCreds(): Promise<ImapCreds> {
  const { data, error } = await supabaseAdmin
    .from("integration_credentials")
    .select("encrypted_data, iv, auth_tag")
    .eq("provider", IMAP_PROVIDER).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("IMAP is not configured.");
  return decryptJson<ImapCreds>(data);
}

export async function runImapSync(): Promise<{
  fetched: number; imported: number; skipped: number; errors: number;
}> {
  const creds = await loadImapCreds();
  const client = new ImapFlow({
    host: creds.host,
    port: creds.port,
    secure: creds.secure,
    auth: { user: creds.username, pass: creds.password },
    logger: false,
  });

  const stats = { fetched: 0, imported: 0, skipped: 0, errors: 0 };
  await client.connect();
  try {
    const lock = await client.getMailboxLock(creds.mailbox || "INBOX");
    try {
      const uids = (await client.search({ seen: false }, { uid: true })) || [];
      const slice = uids.slice(0, 50);
      for (const uid of slice) {
        stats.fetched++;
        try {
          const msg = await client.fetchOne(
            String(uid),
            { source: true, envelope: true },
            { uid: true },
          );
          if (!msg || !msg.source) { stats.errors++; continue; }
          const parsed = await simpleParser(msg.source as Buffer);
          const fromAddr = parsed.from?.value?.[0];
          const email = fromAddr?.address ?? "unknown@unknown";
          const name = fromAddr?.name || email.split("@")[0];
          const subject = parsed.subject || "(no subject)";
          const htmlBody = typeof parsed.html === "string" ? parsed.html : "";
          const body = parsed.text || htmlBody.replace(/<[^>]+>/g, " ") || "";
          const messageId = parsed.messageId || `${creds.host}:${uid}`;

          const { error: insertErr } = await supabaseAdmin
            .from("contact_messages").insert({
              name: name.slice(0, 100),
              email: email.slice(0, 200),
              phone: null,
              subject: subject.slice(0, 200),
              message: body.slice(0, 20000),
              status: "unread",
              source: "imap",
              message_id: messageId,
            });
          if (insertErr) {
            if (insertErr.code === "23505") stats.skipped++;
            else stats.errors++;
          } else {
            stats.imported++;
          }

          if (creds.mark_seen) {
            await client.messageFlagsAdd(
              String(uid), ["\\Seen"], { uid: true },
            );
          }
        } catch {
          stats.errors++;
        }
      }
    } finally {
      lock.release();
    }
  } finally {
    await client.logout().catch(() => { /* ignore */ });
  }
  return stats;
}

export async function testImapCreds() {
  const creds = await loadImapCreds();
  const client = new ImapFlow({
    host: creds.host, port: creds.port, secure: creds.secure,
    auth: { user: creds.username, pass: creds.password },
    logger: false,
  });
  await client.connect();
  const info = await client.mailboxOpen(creds.mailbox || "INBOX");
  const unseen = (info as unknown as { unseen?: number }).unseen ?? 0;
  await client.logout();
  return { ok: true, exists: info.exists, unseen };
}
