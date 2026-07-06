import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Mail, CheckCircle2, Inbox as InboxIcon, RefreshCw, Trash2, ArrowLeft, Reply, Send, PenSquare, History } from "lucide-react";
import { toast } from "sonner";
import { listContactMessages, updateContactStatus, syncImapInbox, deleteContactMessage, replyToContactMessage, sendAdminEmail, listSentEmails } from "@/lib/email.functions";


export const Route = createFileRoute("/admin/inbox")({
  head: () => ({ meta: [{ title: "Support Inbox — Admin" }, { name: "robots", content: "noindex" }] }),
  component: AdminInbox,
});

type Msg = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  subject: string;
  message: string;
  status: "unread" | "read" | "resolved";
  created_at: string;
};

function AdminInbox() {
  const list = useServerFn(listContactMessages);
  const update = useServerFn(updateContactStatus);
  const sync = useServerFn(syncImapInbox);
  const del = useServerFn(deleteContactMessage);
  const qc = useQueryClient();

  const syncMut = useMutation({
    mutationFn: () => sync(),
    onSuccess: (r: { fetched: number; imported: number; skipped: number; errors: number }) => {
      toast.success(`Synced: ${r.imported} new, ${r.skipped} dup, ${r.errors} err`);
      qc.invalidateQueries({ queryKey: ["contact-messages"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Sync failed"),
  });

  const { data, isLoading } = useQuery({
    queryKey: ["contact-messages"],
    queryFn: () => list() as Promise<Msg[]>,
  });

  const messages = useMemo(() => {
    const rank = { unread: 0, read: 1, resolved: 2 } as const;
    return [...(data ?? [])].sort((a, b) => {
      const r = rank[a.status] - rank[b.status];
      if (r !== 0) return r;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [data]);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = messages.find((m) => m.id === selectedId) ?? messages[0] ?? null;

  const mut = useMutation({
    mutationFn: (input: { id: string; status: Msg["status"] }) => update({ data: input }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["contact-messages"] });
      toast.success("Status updated");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Update failed"),
  });

  const delMut = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: (_r, id) => {
      qc.invalidateQueries({ queryKey: ["contact-messages"] });
      if (selectedId === id) setSelectedId(null);
      toast.success("Message deleted");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Delete failed"),
  });

  const reply = useServerFn(replyToContactMessage);
  const [replyOpen, setReplyOpen] = useState(false);
  const [replySubject, setReplySubject] = useState("");
  const [replyBody, setReplyBody] = useState("");
  const replyMut = useMutation({
    mutationFn: (input: { id: string; to: string; subject: string; message: string }) => reply({ data: input }),
    onSuccess: () => {
      toast.success("Reply sent");
      setReplyOpen(false);
      qc.invalidateQueries({ queryKey: ["contact-messages"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Send failed"),
  });

  const openReply = () => {
    if (!selected) return;
    setReplySubject(selected.subject.startsWith("Re:") ? selected.subject : `Re: ${selected.subject}`);
    setReplyBody(`\n\n---\nOn ${new Date(selected.created_at).toLocaleString()}, ${selected.name} wrote:\n> ${selected.message.replace(/\n/g, "\n> ")}`);
    setReplyOpen(true);
  };

  const setStatus = (status: Msg["status"]) => {
    if (!selected) return;
    mut.mutate({ id: selected.id, status });
  };

  // Auto-mark unread → read on open.
  const openMsg = (m: Msg) => {
    setSelectedId(m.id);
    if (m.status === "unread") mut.mutate({ id: m.id, status: "read" });
  };

  const unreadCount = messages.filter((m) => m.status === "unread").length;

  const compose = useServerFn(sendAdminEmail);
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeTo, setComposeTo] = useState("");
  const [composeSubject, setComposeSubject] = useState("");
  const [composeBody, setComposeBody] = useState("");
  const composeMut = useMutation({
    mutationFn: (input: { to: string; subject: string; message: string }) => compose({ data: input }),
    onSuccess: () => {
      toast.success("Email sent");
      setComposeOpen(false);
      setComposeTo(""); setComposeSubject(""); setComposeBody("");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Send failed"),
  });

  const listSent = useServerFn(listSentEmails);
  const [auditOpen, setAuditOpen] = useState(false);
  const { data: sentRows, isLoading: sentLoading, refetch: refetchSent, isFetching: sentFetching } = useQuery({
    queryKey: ["email-audit-log"],
    queryFn: () => listSent() as Promise<Array<{
      id: string; to_email: string; subject: string; kind: string; status: string;
      error: string | null; sent_by_email: string | null; created_at: string;
    }>>,
    enabled: auditOpen,
  });

  return (
    <div className="space-y-5 max-w-6xl">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 sm:flex sm:flex-wrap sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-semibold">Support Inbox</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Contact form submissions and IMAP replies. {unreadCount > 0 && <span className="text-foreground font-medium">{unreadCount} unread</span>}
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button size="sm" onClick={() => setComposeOpen(true)}>
            <PenSquare className="w-4 h-4 sm:mr-2" />
            <span className="hidden sm:inline">Compose</span>
          </Button>
          <Button variant="outline" size="sm" onClick={() => setAuditOpen(true)}>
            <History className="w-4 h-4 sm:mr-2" />
            <span className="hidden sm:inline">Sent log</span>
          </Button>
          <Button variant="outline" size="sm" onClick={() => syncMut.mutate()} disabled={syncMut.isPending}>
            {syncMut.isPending ? <Loader2 className="w-4 h-4 sm:mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 sm:mr-2" />}
            <span className="hidden sm:inline">Sync IMAP</span>
          </Button>
        </div>
      </div>


      <Card className="grid grid-cols-1 md:grid-cols-[300px_1fr] lg:grid-cols-[340px_1fr] overflow-hidden h-[calc(100vh-200px)] min-h-[500px]">
        {/* Left pane — list */}
        <div className={`border-b md:border-b-0 md:border-r border-border/60 flex-col min-h-0 ${selected ? "hidden md:flex" : "flex"}`}>
          <div className="px-4 py-3 border-b border-border/60 flex items-center gap-2 text-sm font-medium">
            <InboxIcon className="w-4 h-4" /> Messages
          </div>
          <ScrollArea className="flex-1">
            {isLoading ? (
              <div className="p-6 flex items-center justify-center text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
              </div>
            ) : messages.length === 0 ? (
              <div className="p-6 text-sm text-muted-foreground text-center">No messages yet.</div>
            ) : (
              <ul className="divide-y divide-border/60">
                {messages.map((m) => {
                  const active = selected?.id === m.id;
                  return (
                    <li key={m.id}>
                      <button
                        onClick={() => openMsg(m)}
                        className={`w-full text-left px-4 py-3 hover:bg-muted/50 transition ${active ? "bg-muted/60" : ""}`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className={`text-sm truncate min-w-0 ${m.status === "unread" ? "font-semibold" : "font-medium"}`}>
                            {m.name}
                          </span>
                          <StatusBadge status={m.status} />
                        </div>
                        <div className="text-xs text-muted-foreground truncate mt-0.5">{m.subject}</div>
                        <div className="text-[11px] text-muted-foreground mt-1">
                          {new Date(m.created_at).toLocaleString()}
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </ScrollArea>
        </div>

        {/* Right pane — detail */}
        <div className={`flex-col min-h-0 ${selected ? "flex" : "hidden md:flex"}`}>
          {!selected ? (
            <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
              Select a message to view details.
            </div>
          ) : (
            <>
              <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-border/60 flex flex-col gap-3">
                <div className="flex items-start gap-2 min-w-0">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="md:hidden shrink-0 -ml-2 h-8 w-8 p-0"
                    onClick={() => setSelectedId(null)}
                    aria-label="Back to list"
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </Button>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-base sm:text-lg font-semibold truncate min-w-0">{selected.subject}</h2>
                      <StatusBadge status={selected.status} />
                    </div>
                    <div className="text-sm text-muted-foreground mt-1 break-words">
                      <span className="font-medium text-foreground">{selected.name}</span>{" "}
                      &lt;<a href={`mailto:${selected.email}`} className="underline break-all">{selected.email}</a>&gt;
                      {selected.phone && <> · {selected.phone}</>}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {new Date(selected.created_at).toLocaleString()}
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setStatus(selected.status === "read" ? "unread" : "read")}
                    disabled={mut.isPending}
                  >
                    <Mail className="w-4 h-4 sm:mr-1.5" />
                    <span className="hidden sm:inline">Mark {selected.status === "read" ? "unread" : "read"}</span>
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => setStatus(selected.status === "resolved" ? "read" : "resolved")}
                    disabled={mut.isPending}
                  >
                    <CheckCircle2 className="w-4 h-4 sm:mr-1.5" />
                    <span className="hidden sm:inline">{selected.status === "resolved" ? "Reopen" : "Resolve"}</span>
                    <span className="sm:hidden">{selected.status === "resolved" ? "Reopen" : "Done"}</span>
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => {
                      if (confirm("Delete this message permanently?")) delMut.mutate(selected.id);
                    }}
                    disabled={delMut.isPending}
                  >
                    <Trash2 className="w-4 h-4 sm:mr-1.5" />
                    <span className="hidden sm:inline">Delete</span>
                  </Button>
                </div>
              </div>
              <ScrollArea className="flex-1">
                <div className="p-4 sm:p-6">
                  <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{selected.message}</p>
                  <div className="mt-6">
                    <Button variant="outline" size="sm" onClick={openReply}>
                      <Reply className="w-4 h-4 mr-1.5" /> Reply
                    </Button>
                  </div>
                </div>
              </ScrollArea>
            </>
          )}
        </div>
      </Card>

      <Dialog open={replyOpen} onOpenChange={setReplyOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Reply to {selected?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>To</Label>
              <Input value={selected?.email ?? ""} disabled />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="reply-subject">Subject</Label>
              <Input id="reply-subject" value={replySubject} onChange={(e) => setReplySubject(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="reply-body">Message</Label>
              <Textarea id="reply-body" rows={12} value={replyBody} onChange={(e) => setReplyBody(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReplyOpen(false)} disabled={replyMut.isPending}>Cancel</Button>
            <Button
              onClick={() => {
                if (!selected) return;
                replyMut.mutate({ id: selected.id, to: selected.email, subject: replySubject.trim(), message: replyBody.trim() });
              }}
              disabled={replyMut.isPending || !replySubject.trim() || !replyBody.trim()}
            >
              {replyMut.isPending ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Send className="w-4 h-4 mr-1.5" />}
              Send
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={composeOpen} onOpenChange={setComposeOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>New email</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="compose-to">To</Label>
              <Input id="compose-to" type="email" placeholder="recipient@example.com" value={composeTo} onChange={(e) => setComposeTo(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="compose-subject">Subject</Label>
              <Input id="compose-subject" value={composeSubject} onChange={(e) => setComposeSubject(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="compose-body">Message</Label>
              <Textarea id="compose-body" rows={12} value={composeBody} onChange={(e) => setComposeBody(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setComposeOpen(false)} disabled={composeMut.isPending}>Cancel</Button>
            <Button
              onClick={() => composeMut.mutate({ to: composeTo.trim(), subject: composeSubject.trim(), message: composeBody.trim() })}
              disabled={composeMut.isPending || !composeTo.trim() || !composeSubject.trim() || !composeBody.trim()}
            >
              {composeMut.isPending ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Send className="w-4 h-4 mr-1.5" />}
              Send
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={auditOpen} onOpenChange={setAuditOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              Sent email log
              <Button variant="ghost" size="sm" onClick={() => refetchSent()} disabled={sentFetching} className="ml-auto">
                {sentFetching ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              </Button>
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[65vh]">
            {sentLoading ? (
              <div className="p-8 flex justify-center"><Loader2 className="w-4 h-4 animate-spin" /></div>
            ) : !sentRows || sentRows.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">No emails sent yet.</div>
            ) : (
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-background border-b border-border/60">
                  <tr className="text-left text-xs text-muted-foreground">
                    <th className="py-2 pr-3 font-medium">When</th>
                    <th className="py-2 pr-3 font-medium">Sent by</th>
                    <th className="py-2 pr-3 font-medium">To</th>
                    <th className="py-2 pr-3 font-medium">Subject</th>
                    <th className="py-2 pr-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {sentRows.map((r) => (
                    <tr key={r.id} className="border-b border-border/40 align-top">
                      <td className="py-2 pr-3 whitespace-nowrap text-muted-foreground">{new Date(r.created_at).toLocaleString()}</td>
                      <td className="py-2 pr-3 break-all">{r.sent_by_email ?? <span className="text-muted-foreground">—</span>}</td>
                      <td className="py-2 pr-3 break-all">{r.to_email}</td>
                      <td className="py-2 pr-3 break-words">{r.subject}</td>
                      <td className="py-2 pr-3">
                        <Badge variant="outline" className={`text-[10px] uppercase ${r.status === "sent" ? "bg-emerald-500/15 text-emerald-600 border-emerald-500/30" : "bg-rose-500/15 text-rose-600 border-rose-500/30"}`}>
                          {r.status}
                        </Badge>
                        {r.error && <div className="text-[11px] text-rose-600 mt-1 break-words">{r.error}</div>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>

  );
}

function StatusBadge({ status }: { status: Msg["status"] }) {
  const map = {
    unread: { label: "Unread", cls: "bg-primary/15 text-primary border-primary/30" },
    read: { label: "Read", cls: "bg-muted text-muted-foreground border-border" },
    resolved: { label: "Resolved", cls: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30" },
  } as const;
  const s = map[status];
  return <Badge variant="outline" className={`text-[10px] uppercase tracking-wide ${s.cls}`}>{s.label}</Badge>;
}
