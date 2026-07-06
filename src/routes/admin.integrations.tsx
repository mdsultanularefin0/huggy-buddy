import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Truck, Loader2, CheckCircle2, Trash2, Film, Mail, Inbox, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import {
  getSteadfastStatus,
  saveSteadfastCredentials,
  deleteSteadfastCredentials,
  testSteadfastConnection,
  getMediaServerStatus,
  saveMediaServerCredentials,
  deleteMediaServerCredentials,
  testMediaServerConnection,
} from "@/lib/integrations.functions";
import {
  getSmtpStatus, saveSmtpCredentials, deleteSmtpCredentials, testSmtpConnection,
  getImapStatus, saveImapCredentials, deleteImapCredentials, testImapConnection, syncImapInbox,
} from "@/lib/email.functions";

export const Route = createFileRoute("/admin/integrations")({
  head: () => ({ meta: [{ title: "Integrations — Admin" }, { name: "robots", content: "noindex" }] }),
  component: AdminIntegrations,
});

function AdminIntegrations() {
  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-semibold">Integrations</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Connect third-party services. Credentials are encrypted before being stored.
        </p>
      </div>
      <Tabs defaultValue="smtp" className="space-y-4">
        <TabsList>
          <TabsTrigger value="smtp"><Mail className="w-4 h-4 mr-2" />SMTP (Outgoing)</TabsTrigger>
          <TabsTrigger value="imap"><Inbox className="w-4 h-4 mr-2" />IMAP (Incoming)</TabsTrigger>
          <TabsTrigger value="steadfast"><Truck className="w-4 h-4 mr-2" />Steadfast</TabsTrigger>
          <TabsTrigger value="media"><Film className="w-4 h-4 mr-2" />Media Server</TabsTrigger>
        </TabsList>
        <TabsContent value="smtp"><SmtpCard /></TabsContent>
        <TabsContent value="imap"><ImapCard /></TabsContent>
        <TabsContent value="steadfast"><SteadfastCard /></TabsContent>
        <TabsContent value="media"><MediaServerCard /></TabsContent>
      </Tabs>
    </div>
  );
}

function SmtpCard() {
  const qc = useQueryClient();
  const getStatus = useServerFn(getSmtpStatus);
  const saveFn = useServerFn(saveSmtpCredentials);
  const deleteFn = useServerFn(deleteSmtpCredentials);
  const testFn = useServerFn(testSmtpConnection);

  const { data: status, isLoading } = useQuery({
    queryKey: ["integration-status", "smtp"],
    queryFn: () => getStatus(),
  });

  const [host, setHost] = useState("");
  const [port, setPort] = useState(465);
  const [secure, setSecure] = useState(true);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [fromEmail, setFromEmail] = useState("");
  const [fromName, setFromName] = useState("Veloura Essence");
  const [adminEmail, setAdminEmail] = useState("");
  const [testTo, setTestTo] = useState("");

  const save = useMutation({
    mutationFn: () => saveFn({ data: {
      host, port, secure, username, password,
      from_email: fromEmail, from_name: fromName,
      admin_email: adminEmail || undefined,
    } }),
    onSuccess: () => {
      toast.success("SMTP credentials saved");
      setPassword("");
      qc.invalidateQueries({ queryKey: ["integration-status", "smtp"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: () => deleteFn(),
    onSuccess: () => {
      toast.success("SMTP credentials removed");
      qc.invalidateQueries({ queryKey: ["integration-status", "smtp"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const test = useMutation({
    mutationFn: () => testFn({ data: { to: testTo } }),
    onSuccess: () => toast.success(`Test email sent to ${testTo}`),
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <Mail className="w-5 h-5 text-primary" />
          </div>
          <div>
            <CardTitle className="text-lg">SMTP (cPanel Email)</CardTitle>
            <CardDescription className="mt-1">
              Send order confirmations, admin alerts, contact-form replies and newsletter broadcasts using your cPanel mail account.
            </CardDescription>
          </div>
        </div>
        {isLoading ? (
          <Badge variant="secondary"><Loader2 className="w-3 h-3 mr-1 animate-spin" /> Checking</Badge>
        ) : status?.configured ? (
          <Badge className="bg-green-600 hover:bg-green-600"><CheckCircle2 className="w-3 h-3 mr-1" /> Connected</Badge>
        ) : (
          <Badge variant="secondary">Not configured</Badge>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {status?.configured && (
          <div className="text-xs text-muted-foreground">
            Host: <code>{status.host}</code> · From: <code>{status.from_email}</code>
            {status.admin_email ? <> · Admin: <code>{status.admin_email}</code></> : null}
          </div>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label htmlFor="smtp-host">SMTP host</Label>
            <Input id="smtp-host" value={host} onChange={(e) => setHost(e.target.value)}
              placeholder="mail.yourdomain.com" />
          </div>
          <div>
            <Label htmlFor="smtp-port">Port</Label>
            <Input id="smtp-port" type="number" value={port}
              onChange={(e) => setPort(Number(e.target.value) || 0)} />
          </div>
          <div className="flex items-end gap-2">
            <div className="flex items-center gap-2">
              <Switch id="smtp-secure" checked={secure} onCheckedChange={setSecure} />
              <Label htmlFor="smtp-secure" className="text-sm">TLS/SSL (secure)</Label>
            </div>
            <p className="text-xs text-muted-foreground ml-auto">Use 465+on or 587+off</p>
          </div>
          <div>
            <Label htmlFor="smtp-user">Username</Label>
            <Input id="smtp-user" value={username} onChange={(e) => setUsername(e.target.value)}
              placeholder="you@yourdomain.com" autoComplete="off" />
          </div>
          <div>
            <Label htmlFor="smtp-pass">Password</Label>
            <Input id="smtp-pass" type="password" value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={status?.configured ? "•••••••• (enter to replace)" : "Mailbox password"}
              autoComplete="off" />
          </div>
          <div>
            <Label htmlFor="smtp-from-email">From email</Label>
            <Input id="smtp-from-email" type="email" value={fromEmail}
              onChange={(e) => setFromEmail(e.target.value)}
              placeholder="no-reply@yourdomain.com" />
          </div>
          <div>
            <Label htmlFor="smtp-from-name">From name</Label>
            <Input id="smtp-from-name" value={fromName} onChange={(e) => setFromName(e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="smtp-admin">Admin notification email (optional)</Label>
            <Input id="smtp-admin" type="email" value={adminEmail}
              onChange={(e) => setAdminEmail(e.target.value)}
              placeholder="admin@yourdomain.com — receives new-order + contact form emails" />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 pt-2">
          <Button onClick={() => save.mutate()}
            disabled={!host || !port || !username || (!password && !status?.configured) || !fromEmail || !fromName || save.isPending}>
            {save.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Save credentials
          </Button>
          {status?.configured && (
            <Button variant="ghost" className="text-destructive hover:text-destructive"
              onClick={() => { if (confirm("Remove SMTP credentials?")) remove.mutate(); }}
              disabled={remove.isPending}>
              <Trash2 className="w-4 h-4 mr-2" /> Remove
            </Button>
          )}
        </div>
        <div className="border-t pt-4">
          <Label htmlFor="smtp-test-to">Send a test email to</Label>
          <div className="flex gap-2 mt-2">
            <Input id="smtp-test-to" type="email" value={testTo}
              onChange={(e) => setTestTo(e.target.value)} placeholder="you@example.com" />
            <Button variant="outline" onClick={() => test.mutate()}
              disabled={!status?.configured || !testTo || test.isPending}>
              {test.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Send test
            </Button>
          </div>
        </div>
        <p className="text-xs text-muted-foreground pt-2">
          Credentials are encrypted with AES-256-GCM before being written to the database.
        </p>
      </CardContent>
    </Card>
  );
}

function MediaServerCard() {
  const qc = useQueryClient();
  const getStatus = useServerFn(getMediaServerStatus);
  const saveFn = useServerFn(saveMediaServerCredentials);
  const deleteFn = useServerFn(deleteMediaServerCredentials);
  const testFn = useServerFn(testMediaServerConnection);

  const { data: status, isLoading } = useQuery({
    queryKey: ["integration-status", "media_server"],
    queryFn: () => getStatus(),
  });

  const [baseUrl, setBaseUrl] = useState("");
  const [apiKey, setApiKey] = useState("");

  const save = useMutation({
    mutationFn: () => saveFn({ data: { base_url: baseUrl, api_key: apiKey } }),
    onSuccess: () => {
      toast.success("Media Server credentials saved");
      setApiKey("");
      qc.invalidateQueries({ queryKey: ["integration-status", "media_server"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: () => deleteFn(),
    onSuccess: () => {
      toast.success("Credentials removed");
      qc.invalidateQueries({ queryKey: ["integration-status", "media_server"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const test = useMutation({
    mutationFn: () => testFn(),
    onSuccess: () => toast.success("Media server is reachable"),
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <Film className="w-5 h-5 text-primary" />
          </div>
          <div>
            <CardTitle className="text-lg">Media Server</CardTitle>
            <CardDescription className="mt-1">
              Standalone upload server for images and videos with auto-transcoding. See <code>media-server/README.md</code>.
            </CardDescription>
          </div>
        </div>
        {isLoading ? (
          <Badge variant="secondary"><Loader2 className="w-3 h-3 mr-1 animate-spin" /> Checking</Badge>
        ) : status?.configured ? (
          <Badge className="bg-green-600 hover:bg-green-600"><CheckCircle2 className="w-3 h-3 mr-1" /> Connected</Badge>
        ) : (
          <Badge variant="secondary">Not configured</Badge>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {status?.configured && (
          <div className="text-xs text-muted-foreground">
            Last updated: {status.updated_at ? new Date(status.updated_at).toLocaleString() : "—"}
          </div>
        )}
        <div className="grid gap-3">
          <div>
            <Label htmlFor="ms-url">Base URL</Label>
            <Input
              id="ms-url"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="https://media.yourdomain.com"
            />
          </div>
          <div>
            <Label htmlFor="ms-key">API Key</Label>
            <Input
              id="ms-key"
              type="password"
              autoComplete="off"
              placeholder={status?.configured ? "•••••••• (enter to replace)" : "The API_KEY from your media server .env"}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
            />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 pt-2">
          <Button
            onClick={() => save.mutate()}
            disabled={!baseUrl || !apiKey || save.isPending}
          >
            {save.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Save credentials
          </Button>
          <Button
            variant="outline"
            onClick={() => test.mutate()}
            disabled={!status?.configured || test.isPending}
          >
            {test.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Test connection
          </Button>
          {status?.configured && (
            <Button
              variant="ghost"
              className="text-destructive hover:text-destructive"
              onClick={() => {
                if (confirm("Remove Media Server credentials?")) remove.mutate();
              }}
              disabled={remove.isPending}
            >
              <Trash2 className="w-4 h-4 mr-2" /> Remove
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground pt-2">
          Credentials are encrypted with AES-256-GCM before being written to the database.
        </p>
      </CardContent>
    </Card>
  );
}

function SteadfastCard() {
  const qc = useQueryClient();
  const getStatus = useServerFn(getSteadfastStatus);
  const saveFn = useServerFn(saveSteadfastCredentials);
  const deleteFn = useServerFn(deleteSteadfastCredentials);
  const testFn = useServerFn(testSteadfastConnection);

  const { data: status, isLoading } = useQuery({
    queryKey: ["integration-status", "steadfast"],
    queryFn: () => getStatus(),
  });

  const [apiKey, setApiKey] = useState("");
  const [secretKey, setSecretKey] = useState("");
  const [baseUrl, setBaseUrl] = useState("https://portal.packzy.com/api/v1");

  const save = useMutation({
    mutationFn: () => saveFn({ data: { api_key: apiKey, secret_key: secretKey, base_url: baseUrl } }),
    onSuccess: () => {
      toast.success("Steadfast credentials saved");
      setApiKey(""); setSecretKey("");
      qc.invalidateQueries({ queryKey: ["integration-status", "steadfast"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: () => deleteFn(),
    onSuccess: () => {
      toast.success("Credentials removed");
      qc.invalidateQueries({ queryKey: ["integration-status", "steadfast"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const test = useMutation({
    mutationFn: () => testFn(),
    onSuccess: (r) => toast.success(
      r.balance !== null ? `Connected — balance: ৳ ${r.balance}` : r.message
    ),
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <Truck className="w-5 h-5 text-primary" />
          </div>
          <div>
            <CardTitle className="text-lg">Steadfast Courier</CardTitle>
            <CardDescription className="mt-1">
              Automate order fulfillment and delivery tracking via Steadfast Courier API.
            </CardDescription>
          </div>
        </div>
        {isLoading ? (
          <Badge variant="secondary"><Loader2 className="w-3 h-3 mr-1 animate-spin" /> Checking</Badge>
        ) : status?.configured ? (
          <Badge className="bg-green-600 hover:bg-green-600"><CheckCircle2 className="w-3 h-3 mr-1" /> Connected</Badge>
        ) : (
          <Badge variant="secondary">Not configured</Badge>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {status?.configured && (
          <div className="text-xs text-muted-foreground">
            Last updated: {status.updated_at ? new Date(status.updated_at).toLocaleString() : "—"}
          </div>
        )}

        <div className="grid gap-3">
          <div>
            <Label htmlFor="sf-api-key">API Key</Label>
            <Input
              id="sf-api-key"
              type="password"
              autoComplete="off"
              placeholder={status?.configured ? "•••••••• (enter to replace)" : "Your Steadfast API key"}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="sf-secret-key">Secret Key</Label>
            <Input
              id="sf-secret-key"
              type="password"
              autoComplete="off"
              placeholder={status?.configured ? "•••••••• (enter to replace)" : "Your Steadfast secret key"}
              value={secretKey}
              onChange={(e) => setSecretKey(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="sf-base-url">Base URL</Label>
            <Input
              id="sf-base-url"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="https://portal.packzy.com/api/v1"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-2">
          <Button
            onClick={() => save.mutate()}
            disabled={!apiKey || !secretKey || !baseUrl || save.isPending}
          >
            {save.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Save credentials
          </Button>
          <Button
            variant="outline"
            onClick={() => test.mutate()}
            disabled={!status?.configured || test.isPending}
          >
            {test.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Test connection
          </Button>
          {status?.configured && (
            <Button
              variant="ghost"
              className="text-destructive hover:text-destructive"
              onClick={() => {
                if (confirm("Remove Steadfast credentials?")) remove.mutate();
              }}
              disabled={remove.isPending}
            >
              <Trash2 className="w-4 h-4 mr-2" /> Remove
            </Button>
          )}
        </div>

        <p className="text-xs text-muted-foreground pt-2">
          Credentials are encrypted with AES-256-GCM before being written to the database and are only decrypted server-side when calling the Steadfast API.
        </p>
      </CardContent>
    </Card>
  );
}

function ImapCard() {
  const qc = useQueryClient();
  const getStatus = useServerFn(getImapStatus);
  const saveFn = useServerFn(saveImapCredentials);
  const deleteFn = useServerFn(deleteImapCredentials);
  const testFn = useServerFn(testImapConnection);
  const syncFn = useServerFn(syncImapInbox);

  const { data: status, isLoading } = useQuery({
    queryKey: ["integration-status", "imap"],
    queryFn: () => getStatus(),
  });

  const [host, setHost] = useState("");
  const [port, setPort] = useState(993);
  const [secure, setSecure] = useState(true);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [mailboxes, setMailboxes] = useState("INBOX");
  const [markSeen, setMarkSeen] = useState(true);
  const [importAll, setImportAll] = useState(false);

  const save = useMutation({
    mutationFn: () => {
      const list = mailboxes.split(",").map((s) => s.trim()).filter(Boolean);
      return saveFn({ data: {
        host, port, secure, username, password,
        mailbox: list[0] || "INBOX",
        mailboxes: list,
        mark_seen: markSeen,
        import_all: importAll,
      } });
    },
    onSuccess: () => {
      toast.success("IMAP credentials saved");
      setPassword("");
      qc.invalidateQueries({ queryKey: ["integration-status", "imap"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: () => deleteFn(),
    onSuccess: () => {
      toast.success("IMAP credentials removed");
      qc.invalidateQueries({ queryKey: ["integration-status", "imap"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const test = useMutation({
    mutationFn: () => testFn(),
    onSuccess: (r: { unseen: number; exists: number }) =>
      toast.success(`Connected. ${r.unseen} unread of ${r.exists} in mailbox.`),
    onError: (e: Error) => toast.error(e.message),
  });

  const sync = useMutation({
    mutationFn: () => syncFn(),
    onSuccess: (r: { fetched: number; imported: number; skipped: number; errors: number }) => {
      toast.success(`Synced: ${r.imported} imported, ${r.skipped} skipped, ${r.errors} errors (of ${r.fetched}).`);
      qc.invalidateQueries({ queryKey: ["contact-messages"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <Inbox className="w-5 h-5 text-primary" />
          </div>
          <div>
            <CardTitle className="text-lg">IMAP (Incoming Mail)</CardTitle>
            <CardDescription className="mt-1">
              Pull customer replies from your cPanel mailbox into the Support Inbox. Unread messages are imported, deduped by Message-ID, and (optionally) marked as read on the server.
            </CardDescription>
          </div>
        </div>
        {isLoading ? (
          <Badge variant="secondary"><Loader2 className="w-3 h-3 mr-1 animate-spin" /> Checking</Badge>
        ) : status?.configured ? (
          <Badge className="bg-green-600 hover:bg-green-600"><CheckCircle2 className="w-3 h-3 mr-1" /> Connected</Badge>
        ) : (
          <Badge variant="secondary">Not configured</Badge>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {status?.configured && (
          <div className="text-xs text-muted-foreground">
            Host: <code>{status.host}</code> · User: <code>{status.username}</code> · Mailbox: <code>{status.mailbox}</code>
          </div>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label htmlFor="imap-host">IMAP host</Label>
            <Input id="imap-host" value={host} onChange={(e) => setHost(e.target.value)}
              placeholder="mail.yourdomain.com" />
          </div>
          <div>
            <Label htmlFor="imap-port">Port</Label>
            <Input id="imap-port" type="number" value={port}
              onChange={(e) => setPort(Number(e.target.value) || 0)} />
          </div>
          <div className="flex items-end gap-2">
            <div className="flex items-center gap-2">
              <Switch id="imap-secure" checked={secure} onCheckedChange={setSecure} />
              <Label htmlFor="imap-secure" className="text-sm">TLS/SSL (secure)</Label>
            </div>
            <p className="text-xs text-muted-foreground ml-auto">993 + on (typical)</p>
          </div>
          <div>
            <Label htmlFor="imap-user">Username</Label>
            <Input id="imap-user" value={username} onChange={(e) => setUsername(e.target.value)}
              placeholder="support@yourdomain.com" autoComplete="off" />
          </div>
          <div>
            <Label htmlFor="imap-pass">Password</Label>
            <Input id="imap-pass" type="password" value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={status?.configured ? "•••••••• (enter to replace)" : "Mailbox password"}
              autoComplete="off" />
          </div>
          <div>
            <Label htmlFor="imap-mailbox">Mailbox / folder</Label>
            <Input id="imap-mailbox" value={mailbox} onChange={(e) => setMailbox(e.target.value)}
              placeholder="INBOX" />
          </div>
          <div className="flex items-center gap-2 sm:col-span-2">
            <Switch id="imap-mark" checked={markSeen} onCheckedChange={setMarkSeen} />
            <Label htmlFor="imap-mark" className="text-sm">Mark messages as read on the server after import</Label>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 pt-2">
          <Button onClick={() => save.mutate()}
            disabled={!host || !port || !username || (!password && !status?.configured) || !mailbox || save.isPending}>
            {save.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Save credentials
          </Button>
          {status?.configured && (
            <>
              <Button variant="outline" onClick={() => test.mutate()} disabled={test.isPending}>
                {test.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Test connection
              </Button>
              <Button variant="outline" onClick={() => sync.mutate()} disabled={sync.isPending}>
                {sync.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                Sync now
              </Button>
              <Button variant="ghost" className="text-destructive hover:text-destructive"
                onClick={() => { if (confirm("Remove IMAP credentials?")) remove.mutate(); }}
                disabled={remove.isPending}>
                <Trash2 className="w-4 h-4 mr-2" /> Remove
              </Button>
            </>
          )}
        </div>
        <p className="text-xs text-muted-foreground pt-2">
          Sync fetches up to 50 unread messages per run. Wire a cron (every 5 min) to <code>POST /api/public/mail/sync</code> with your project's <code>apikey</code> header for hands-off polling.
        </p>
      </CardContent>
    </Card>
  );
}
