import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Mail, CheckCircle2, Inbox as InboxIcon, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { listContactMessages, updateContactStatus, syncImapInbox, deleteContactMessage } from "@/lib/email.functions";

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

  return (
    <div className="space-y-5 max-w-6xl">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold">Support Inbox</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Contact form submissions and IMAP replies. {unreadCount > 0 && <span className="text-foreground font-medium">{unreadCount} unread</span>}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => syncMut.mutate()} disabled={syncMut.isPending}>
          {syncMut.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
          Sync IMAP
        </Button>
      </div>

      <Card className="grid grid-cols-1 md:grid-cols-[320px_1fr] overflow-hidden h-[calc(100vh-220px)] min-h-[500px]">
        {/* Left pane — list */}
        <div className="border-r border-border/60 flex flex-col min-h-0">
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
                          <span className={`text-sm truncate ${m.status === "unread" ? "font-semibold" : "font-medium"}`}>
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
        <div className="flex flex-col min-h-0">
          {!selected ? (
            <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
              Select a message to view details.
            </div>
          ) : (
            <>
              <div className="px-6 py-4 border-b border-border/60 flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-semibold truncate">{selected.subject}</h2>
                    <StatusBadge status={selected.status} />
                  </div>
                  <div className="text-sm text-muted-foreground mt-1">
                    <span className="font-medium text-foreground">{selected.name}</span> &lt;
                    <a href={`mailto:${selected.email}`} className="underline">{selected.email}</a>&gt;
                    {selected.phone && <> · {selected.phone}</>}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {new Date(selected.created_at).toLocaleString()}
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setStatus(selected.status === "read" ? "unread" : "read")}
                    disabled={mut.isPending}
                  >
                    <Mail className="w-4 h-4 mr-1.5" />
                    Mark {selected.status === "read" ? "unread" : "read"}
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => setStatus(selected.status === "resolved" ? "read" : "resolved")}
                    disabled={mut.isPending}
                  >
                    <CheckCircle2 className="w-4 h-4 mr-1.5" />
                    {selected.status === "resolved" ? "Reopen" : "Resolve"}
                  </Button>
                </div>
              </div>
              <ScrollArea className="flex-1">
                <div className="p-6">
                  <p className="whitespace-pre-wrap text-sm leading-relaxed">{selected.message}</p>
                  <div className="mt-6">
                    <Button asChild variant="outline" size="sm">
                      <a href={`mailto:${selected.email}?subject=Re: ${encodeURIComponent(selected.subject)}`}>
                        Reply via email
                      </a>
                    </Button>
                  </div>
                </div>
              </ScrollArea>
            </>
          )}
        </div>
      </Card>
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
