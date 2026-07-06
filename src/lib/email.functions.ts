import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const PROVIDER = "smtp";

export type SmtpCreds = {
  host: string;
  port: number;
  secure: boolean;
  username: string;
  password: string;
  from_email: string;
  from_name: string;
  admin_email?: string;
};

async function assertAdmin(userId: string, supabase: unknown) {
  const { assertAdmin: check } = await import("@/lib/admin-guard.server");
  return check(userId, supabase);
}

async function loadSmtpCreds(): Promise<SmtpCreds> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("integration_credentials")
    .select("encrypted_data, iv, auth_tag")
    .eq("provider", PROVIDER).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("SMTP is not configured. Save credentials in Admin → Integrations.");
  const { decryptJson } = await import("@/lib/integration-crypto.server");
  return decryptJson<SmtpCreds>(data);
}

/** Server-only helper. Import from other server functions to send email. */
export async function sendMail(opts: {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  kind?: string;
}): Promise<{ ok: boolean; error?: string }> {
  const creds = await loadSmtpCreds();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const toStr = Array.isArray(opts.to) ? opts.to.join(", ") : opts.to;
  // Always route replies to the admin inbox (falls back to the from address).
  const replyTo = opts.replyTo ?? creds.admin_email ?? creds.from_email;
  try {
    const nodemailer = (await import("nodemailer")).default;
    const transporter = nodemailer.createTransport({
      host: creds.host,
      port: creds.port,
      secure: creds.secure,
      auth: { user: creds.username, pass: creds.password },
    });
    await transporter.sendMail({
      from: `"${creds.from_name}" <${creds.from_email}>`,
      to: opts.to,
      replyTo,
      subject: opts.subject,
      html: opts.html,
      text: opts.text ?? opts.html.replace(/<[^>]+>/g, ""),
    });
    await supabaseAdmin.from("email_log").insert({
      to_email: toStr, subject: opts.subject, kind: opts.kind ?? "custom", status: "sent",
    });
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await supabaseAdmin.from("email_log").insert({
      to_email: toStr, subject: opts.subject, kind: opts.kind ?? "custom", status: "failed", error: msg,
    });
    return { ok: false, error: msg };
  }
}


// ---------------- Admin: status / save / delete / test ----------------
export const getSmtpStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId, context.supabase);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("integration_credentials")
      .select("updated_at").eq("provider", PROVIDER).maybeSingle();
    if (error) throw new Error(error.message);
    let meta: { host?: string; from_email?: string; admin_email?: string } = {};
    if (data) {
      try {
        const c = await loadSmtpCreds();
        meta = { host: c.host, from_email: c.from_email, admin_email: c.admin_email };
      } catch { /* ignore */ }
    }
    return { configured: !!data, updated_at: data?.updated_at ?? null, ...meta };
  });

const saveSchema = z.object({
  host: z.string().min(1).max(200),
  port: z.number().int().min(1).max(65535),
  secure: z.boolean(),
  username: z.string().min(1).max(200),
  password: z.string().min(1).max(500),
  from_email: z.string().email().max(200),
  from_name: z.string().min(1).max(120),
  admin_email: z.string().email().max(200).optional().or(z.literal("")).transform((v) => v || undefined),
});

export const saveSmtpCredentials = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => saveSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId, context.supabase);
    const { encryptJson } = await import("@/lib/integration-crypto.server");
    const enc = encryptJson(data satisfies SmtpCreds);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("integration_credentials").upsert({
        provider: PROVIDER,
        encrypted_data: enc.encrypted_data, iv: enc.iv, auth_tag: enc.auth_tag,
        updated_by: context.userId, updated_at: new Date().toISOString(),
      });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteSmtpCredentials = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId, context.supabase);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("integration_credentials").delete().eq("provider", PROVIDER);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const testSchema = z.object({ to: z.string().email() });
export const testSmtpConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => testSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId, context.supabase);
    const r = await sendMail({
      to: data.to,
      subject: "SMTP test — Veloura Essence",
      html: `<p>This is a test email from your Veloura Essence admin panel.</p><p>If you can read this, your SMTP setup is working.</p>`,
      kind: "smtp_test",
    });
    if (!r.ok) throw new Error(r.error ?? "Failed to send");
    return { ok: true };
  });

// ---------------- Public: contact form ----------------
const contactSchema = z.object({
  name: z.string().trim().min(1).max(100),
  email: z.string().trim().email().max(200),
  phone: z.string().trim().max(30).optional().or(z.literal("")),
  subject: z.string().trim().min(1).max(150),
  message: z.string().trim().min(1).max(2000),
});

export const sendContactMessage = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => contactSchema.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // 1) Persist first so no inquiry is ever lost, even if SMTP fails.
    const { error: insertErr } = await supabaseAdmin.from("contact_messages").insert({
      name: data.name,
      email: data.email,
      phone: data.phone || null,
      subject: data.subject,
      message: data.message,
      status: "unread",
    });
    if (insertErr) throw new Error("Could not save your message. Please try again.");

    // 2) Fire-and-forget webhook for external automations (Zapier/Make/etc.).
    const webhookUrl = process.env.ADMIN_WEBHOOK_URL;
    if (webhookUrl) {
      try {
        await fetch(webhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: "contact_message", ...data, received_at: new Date().toISOString() }),
        });
      } catch {
        // Non-fatal: the message is already stored in the DB.
      }
    }

    // 3) Notify the admin over SMTP.
    const creds = await loadSmtpCreds();
    const to = creds.admin_email || creds.from_email;
    const safe = (s: string) =>
      s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
    const html = `
      <h2>New contact message</h2>
      <p><strong>From:</strong> ${safe(data.name)} &lt;${safe(data.email)}&gt;</p>
      ${data.phone ? `<p><strong>Phone:</strong> ${safe(data.phone)}</p>` : ""}
      <p><strong>Subject:</strong> ${safe(data.subject)}</p>
      <hr />
      <p style="white-space:pre-wrap">${safe(data.message)}</p>
    `;
    const r = await sendMail({
      to, replyTo: data.email,
      subject: `[Contact] ${data.subject}`,
      html, kind: "contact",
    });
    // Even if SMTP fails, the row is saved — surface a soft warning but don't hard-fail.
    return { ok: true, emailed: r.ok };
  });


// ---------------- Public: newsletter subscribe ----------------
const subscribeSchema = z.object({
  email: z.string().trim().email().max(200),
  name: z.string().trim().max(100).optional().or(z.literal("")),
  source: z.string().max(50).optional(),
});

export const subscribeNewsletter = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => subscribeSchema.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const email = data.email.toLowerCase();
    const { data: existing } = await supabaseAdmin
      .from("newsletter_subscribers").select("id, is_active")
      .eq("email", email).maybeSingle();
    if (existing) {
      if (!existing.is_active) {
        await supabaseAdmin.from("newsletter_subscribers")
          .update({ is_active: true, unsubscribed_at: null, name: data.name || null })
          .eq("id", existing.id);
      }
      return { ok: true, already: true };
    }
    const { error } = await supabaseAdmin.from("newsletter_subscribers").insert({
      email, name: data.name || null, source: data.source ?? "footer",
    });
    if (error) throw new Error(error.message);
    return { ok: true, already: false };
  });

const unsubSchema = z.object({ token: z.string().uuid() });
export const unsubscribeNewsletter = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => unsubSchema.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("newsletter_subscribers").select("id, email")
      .eq("unsubscribe_token", data.token).maybeSingle();
    if (!row) throw new Error("Invalid unsubscribe link");
    await supabaseAdmin.from("newsletter_subscribers")
      .update({ is_active: false, unsubscribed_at: new Date().toISOString() })
      .eq("id", row.id);
    return { ok: true, email: row.email };
  });

// ---------------- Admin: subscribers + broadcast ----------------
export const listSubscribers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId, context.supabase);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("newsletter_subscribers")
      .select("id, email, name, source, is_active, subscribed_at")
      .order("subscribed_at", { ascending: false }).limit(1000);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

const removeSubSchema = z.object({ id: z.string().uuid() });
export const removeSubscriber = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => removeSubSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId, context.supabase);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("newsletter_subscribers").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const broadcastSchema = z.object({
  subject: z.string().trim().min(1).max(200),
  html: z.string().trim().min(1).max(100000),
});

export const broadcastNewsletter = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => broadcastSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId, context.supabase);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: subs, error } = await supabaseAdmin
      .from("newsletter_subscribers")
      .select("email, unsubscribe_token")
      .eq("is_active", true);
    if (error) throw new Error(error.message);
    if (!subs?.length) throw new Error("No active subscribers");

    // Batch to avoid timeouts + overwhelming SMTP. Each chunk sends in parallel
    // via Promise.allSettled so one failure doesn't crash the whole broadcast.
    const CHUNK_SIZE = 50;
    const DELAY_MS = 1000;
    let sent = 0, failed = 0;

    for (let i = 0; i < subs.length; i += CHUNK_SIZE) {
      const chunk = subs.slice(i, i + CHUNK_SIZE);
      const results = await Promise.allSettled(
        chunk.map((s) => {
          const unsubUrl = `${process.env.SITE_URL ?? ""}/unsubscribe?token=${s.unsubscribe_token}`;
          const footer = `<hr /><p style="font-size:12px;color:#888">
            You received this because you subscribed at Veloura Essence.
            <a href="${unsubUrl}">Unsubscribe</a></p>`;
          return sendMail({
            to: s.email,
            subject: data.subject,
            html: data.html + footer,
            kind: "newsletter",
          });
        }),
      );
      for (const r of results) {
        if (r.status === "fulfilled" && r.value.ok) sent++;
        else failed++;
      }
      if (i + CHUNK_SIZE < subs.length) {
        await new Promise((resolve) => setTimeout(resolve, DELAY_MS));
      }
    }
    return { ok: true, sent, failed, total: subs.length };
  });

// ---------------- Email log ----------------
export const listEmailLog = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId, context.supabase);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("email_log")
      .select("id, to_email, subject, kind, status, error, created_at")
      .order("created_at", { ascending: false }).limit(200);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

// ---------------- Admin: Contact inbox ----------------
export const listContactMessages = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId, context.supabase);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("contact_messages")
      .select("id, name, email, phone, subject, message, status, created_at")
      // Unread first, then newest first.
      .order("status", { ascending: true })
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

const updateContactSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["unread", "read", "resolved"]),
});
export const updateContactStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => updateContactSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId, context.supabase);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("contact_messages")
      .update({ status: data.status })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ==================== IMAP (incoming mail) ====================
const IMAP_PROVIDER = "imap";

export type ImapCreds = {
  host: string;
  port: number;
  secure: boolean;
  username: string;
  password: string;
  mailbox: string; // e.g. "INBOX"
  mark_seen: boolean;
};

async function loadImapCreds(): Promise<ImapCreds> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("integration_credentials")
    .select("encrypted_data, iv, auth_tag")
    .eq("provider", IMAP_PROVIDER).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("IMAP is not configured. Save credentials in Admin → Integrations.");
  const { decryptJson } = await import("@/lib/integration-crypto.server");
  return decryptJson<ImapCreds>(data);
}

export const getImapStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId, context.supabase);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("integration_credentials")
      .select("updated_at").eq("provider", IMAP_PROVIDER).maybeSingle();
    if (error) throw new Error(error.message);
    let meta: { host?: string; username?: string; mailbox?: string } = {};
    if (data) {
      try {
        const c = await loadImapCreds();
        meta = { host: c.host, username: c.username, mailbox: c.mailbox };
      } catch { /* ignore */ }
    }
    return { configured: !!data, updated_at: data?.updated_at ?? null, ...meta };
  });

const saveImapSchema = z.object({
  host: z.string().min(1).max(200),
  port: z.number().int().min(1).max(65535),
  secure: z.boolean(),
  username: z.string().min(1).max(200),
  password: z.string().min(1).max(500),
  mailbox: z.string().min(1).max(100).default("INBOX"),
  mark_seen: z.boolean().default(true),
});

export const saveImapCredentials = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => saveImapSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId, context.supabase);
    const { encryptJson } = await import("@/lib/integration-crypto.server");
    const enc = encryptJson(data satisfies ImapCreds);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("integration_credentials").upsert({
        provider: IMAP_PROVIDER,
        encrypted_data: enc.encrypted_data, iv: enc.iv, auth_tag: enc.auth_tag,
        updated_by: context.userId, updated_at: new Date().toISOString(),
      });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteImapCredentials = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId, context.supabase);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("integration_credentials").delete().eq("provider", IMAP_PROVIDER);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Server-only worker: open IMAP, parse unseen, insert into contact_messages. */
async function runImapSync(): Promise<{ fetched: number; imported: number; skipped: number; errors: number }> {
  const creds = await loadImapCreds();
  const { ImapFlow } = await import("imapflow");
  const { simpleParser } = await import("mailparser");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

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
      // Fetch UNSEEN, cap to 50 per run.
      const uids = await client.search({ seen: false }, { uid: true }) || [];
      const slice = uids.slice(0, 50);
      for (const uid of slice) {
        stats.fetched++;
        try {
          const msg = await client.fetchOne(String(uid), { source: true, envelope: true }, { uid: true });
          if (!msg?.source) { stats.errors++; continue; }
          const parsed = await simpleParser(msg.source as Buffer);
          const fromAddr = parsed.from?.value?.[0];
          const email = fromAddr?.address ?? "unknown@unknown";
          const name = fromAddr?.name || email.split("@")[0];
          const subject = parsed.subject || "(no subject)";
          const body = parsed.text || parsed.html?.replace(/<[^>]+>/g, " ") || "";
          const messageId = parsed.messageId || `${creds.host}:${uid}`;

          const { error: insertErr } = await supabaseAdmin.from("contact_messages").insert({
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
            // Unique violation on message_id → already imported.
            if (insertErr.code === "23505") stats.skipped++;
            else stats.errors++;
          } else {
            stats.imported++;
          }

          if (creds.mark_seen) {
            await client.messageFlagsAdd(String(uid), ["\\Seen"], { uid: true });
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

export const testImapConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId, context.supabase);
    const creds = await loadImapCreds();
    const { ImapFlow } = await import("imapflow");
    const client = new ImapFlow({
      host: creds.host, port: creds.port, secure: creds.secure,
      auth: { user: creds.username, pass: creds.password },
      logger: false,
    });
    try {
      await client.connect();
      const info = await client.mailboxOpen(creds.mailbox || "INBOX");
      await client.logout();
      return { ok: true, exists: info.exists, unseen: info.unseen ?? 0 };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      throw new Error(`IMAP connection failed: ${msg}`);
    }
  });

export const syncImapInbox = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId, context.supabase);
    return await runImapSync();
  });

// Exposed for the /api/public/mail/sync cron route.
export { runImapSync as __runImapSync };
