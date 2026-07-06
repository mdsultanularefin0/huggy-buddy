// Server-only IMAP sync. Cloudflare Workers can't run raw TCP/TLS sockets,
// so imapflow lives in the Node media-server. This module proxies to it.
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

function mediaServerConfig() {
  const url = process.env.MEDIA_SERVER_URL;
  const key = process.env.MEDIA_SERVER_KEY;
  if (!url || !key) {
    throw new Error(
      "IMAP proxy is not configured. Set MEDIA_SERVER_URL and MEDIA_SERVER_KEY.",
    );
  }
  return { url: url.replace(/\/$/, ""), key };
}

async function callMediaServer<T>(path: string, body: unknown): Promise<T> {
  const { url, key } = mediaServerConfig();
  const res = await fetch(`${url}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": key },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json: unknown;
  try { json = JSON.parse(text); } catch { json = { error: text }; }
  if (!res.ok) {
    const msg = (json as { error?: string })?.error || `Media server error ${res.status}`;
    throw new Error(msg);
  }
  return json as T;
}

type SyncResponse = {
  ok: boolean;
  fetched: number;
  messages: Array<{
    mailbox: string;
    uid: string;
    name: string;
    email: string;
    subject: string;
    body: string;
    messageId: string;
  }>;
};

export async function runImapSync(): Promise<{
  fetched: number; imported: number; skipped: number; errors: number;
}> {
  const creds = await loadImapCreds();
  const stats = { fetched: 0, imported: 0, skipped: 0, errors: 0 };

  const result = await callMediaServer<SyncResponse>("/imap/sync", creds);
  stats.fetched = result.fetched;

  for (const m of result.messages) {
    const { error: insertErr } = await supabaseAdmin
      .from("contact_messages").insert({
        name: (m.name || "").slice(0, 100),
        email: (m.email || "").slice(0, 200),
        phone: null,
        subject: (m.subject || "").slice(0, 200),
        message: (m.body || "").slice(0, 20000),
        status: "unread",
        source: "imap",
        message_id: m.messageId,
      });
    if (insertErr) {
      if (insertErr.code === "23505") stats.skipped++;
      else stats.errors++;
    } else {
      stats.imported++;
    }
  }
  return stats;
}

type TestResponse = { ok: true; exists: number; unseen: number; mailboxes: string[] };

export async function testImapCreds() {
  const creds = await loadImapCreds();
  return callMediaServer<TestResponse>("/imap/test", creds);
}
