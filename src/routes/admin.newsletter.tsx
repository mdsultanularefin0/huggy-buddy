import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { broadcastNewsletter, listSubscribers, removeSubscriber, listEmailLog } from "@/lib/email.functions";

export const Route = createFileRoute("/admin/newsletter")({
  head: () => ({ meta: [{ title: "Newsletter — Admin" }, { name: "robots", content: "noindex" }] }),
  component: AdminNewsletter,
});

function AdminNewsletter() {
  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-semibold">Newsletter</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage subscribers and broadcast emails via your SMTP setup.
        </p>
      </div>
      <Tabs defaultValue="broadcast" className="space-y-4">
        <TabsList>
          <TabsTrigger value="broadcast">Broadcast</TabsTrigger>
          <TabsTrigger value="subscribers">Subscribers</TabsTrigger>
          <TabsTrigger value="log">Email log</TabsTrigger>
        </TabsList>
        <TabsContent value="broadcast"><BroadcastCard /></TabsContent>
        <TabsContent value="subscribers"><SubscribersCard /></TabsContent>
        <TabsContent value="log"><LogCard /></TabsContent>
      </Tabs>
    </div>
  );
}

function BroadcastCard() {
  const send = useServerFn(broadcastNewsletter);
  const [subject, setSubject] = useState("");
  const [html, setHtml] = useState("");
  const m = useMutation({
    mutationFn: () => send({ data: { subject, html } }),
    onSuccess: (r) => {
      toast.success(`Sent ${r.sent}/${r.total} · ${r.failed} failed`);
      setSubject(""); setHtml("");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Send broadcast</CardTitle>
        <CardDescription>Sent to every active subscriber. HTML is allowed. An unsubscribe link is appended automatically.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <Label htmlFor="bc-subject">Subject</Label>
          <Input id="bc-subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="bc-html">HTML body</Label>
          <Textarea id="bc-html" value={html} onChange={(e) => setHtml(e.target.value)} rows={12}
            placeholder="<h2>New drop!</h2><p>Meet our latest scent…</p>" />
        </div>
        <Button onClick={() => m.mutate()} disabled={!subject || !html || m.isPending}>
          {m.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
          Send to all subscribers
        </Button>
      </CardContent>
    </Card>
  );
}

function SubscribersCard() {
  const qc = useQueryClient();
  const list = useServerFn(listSubscribers);
  const del = useServerFn(removeSubscriber);
  const { data, isLoading } = useQuery({ queryKey: ["subscribers"], queryFn: () => list() });
  const remove = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => { toast.success("Removed"); qc.invalidateQueries({ queryKey: ["subscribers"] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Subscribers</CardTitle>
        <CardDescription>{data?.length ?? 0} total</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : (
          <Table>
            <TableHeader><TableRow>
              <TableHead>Email</TableHead><TableHead>Name</TableHead><TableHead>Source</TableHead>
              <TableHead>Status</TableHead><TableHead>Subscribed</TableHead><TableHead></TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {data?.map((s) => (
                <TableRow key={s.id}>
                  <TableCell>{s.email}</TableCell>
                  <TableCell>{s.name ?? "—"}</TableCell>
                  <TableCell>{s.source}</TableCell>
                  <TableCell>
                    {s.is_active ? <Badge className="bg-green-600">Active</Badge> : <Badge variant="secondary">Unsubscribed</Badge>}
                  </TableCell>
                  <TableCell className="text-xs">{new Date(s.subscribed_at).toLocaleString()}</TableCell>
                  <TableCell>
                    <Button size="sm" variant="ghost" className="text-destructive"
                      onClick={() => { if (confirm(`Delete ${s.email}?`)) remove.mutate(s.id); }}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {!data?.length && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No subscribers yet.</TableCell></TableRow>}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

function LogCard() {
  const list = useServerFn(listEmailLog);
  const { data, isLoading } = useQuery({ queryKey: ["email-log"], queryFn: () => list() });
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Recent email activity</CardTitle>
        <CardDescription>Last 200 send attempts</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : (
          <Table>
            <TableHeader><TableRow>
              <TableHead>When</TableHead><TableHead>Kind</TableHead><TableHead>To</TableHead>
              <TableHead>Subject</TableHead><TableHead>Status</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {data?.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="text-xs">{new Date(r.created_at).toLocaleString()}</TableCell>
                  <TableCell>{r.kind}</TableCell>
                  <TableCell className="text-xs">{r.to_email}</TableCell>
                  <TableCell className="max-w-xs truncate">{r.subject}</TableCell>
                  <TableCell>
                    {r.status === "sent" ? <Badge className="bg-green-600">Sent</Badge>
                      : <Badge variant="destructive" title={r.error ?? ""}>Failed</Badge>}
                  </TableCell>
                </TableRow>
              ))}
              {!data?.length && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No email activity yet.</TableCell></TableRow>}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
