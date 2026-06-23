import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, RefreshCw } from "lucide-react";

export const Route = createFileRoute("/admin/audit-logs")({ component: AuditLogsPage });

type EntityFilter = "all" | "order" | "customer";
type StatusFilter = "all" | "ok" | "forbidden" | "error";

const STATUS_TONE: Record<string, string> = {
  ok: "bg-emerald-100 text-emerald-800",
  forbidden: "bg-amber-100 text-amber-800",
  error: "bg-rose-100 text-rose-800",
};

function AuditLogsPage() {
  const [entity, setEntity] = useState<EntityFilter>("all");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");

  const { data: rows = [], isLoading, refetch, isFetching } = useQuery({
    queryKey: ["admin", "audit-logs", entity, status],
    queryFn: async () => {
      let q = supabase
        .from("admin_audit_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);
      if (entity !== "all") q = q.eq("entity", entity);
      if (status !== "all") q = q.eq("status", status);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

  const filtered = rows.filter((r) => {
    if (!search.trim()) return true;
    const s = search.toLowerCase();
    return (
      (r.entity_id ?? "").toLowerCase().includes(s) ||
      (r.error ?? "").toLowerCase().includes(s) ||
      (r.actor_id ?? "").toLowerCase().includes(s) ||
      (r.fields ?? []).some((f) => f.toLowerCase().includes(s)) ||
      JSON.stringify(r.payload ?? {}).toLowerCase().includes(s)
    );
  });

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Admin Audit Logs</h1>
        <p className="text-muted-foreground mt-1">Every order and customer update made from the admin panel.</p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Input
          placeholder="Search entity id, field, error, payload…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
        <Select value={entity} onValueChange={(v) => setEntity(v as EntityFilter)}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All entities</SelectItem>
            <SelectItem value="order">Orders</SelectItem>
            <SelectItem value="customer">Customers</SelectItem>
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={(v) => setStatus(v as StatusFilter)}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="ok">OK</SelectItem>
            <SelectItem value="forbidden">Forbidden</SelectItem>
            <SelectItem value="error">Error</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={`w-4 h-4 mr-1 ${isFetching ? "animate-spin" : ""}`} /> Refresh
        </Button>
        <span className="text-sm text-muted-foreground ml-auto">{filtered.length} entries</span>
      </div>

      <Card className="shadow-card overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin inline mr-2" /> Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">No audit entries found.</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-44">When</TableHead>
                <TableHead>Entity</TableHead>
                <TableHead>Target ID</TableHead>
                <TableHead>Fields</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Detail</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                    {new Date(r.created_at).toLocaleString()}
                  </TableCell>
                  <TableCell className="text-sm capitalize">{r.entity} · {r.action}</TableCell>
                  <TableCell className="font-mono text-xs">{r.entity_id?.slice(0, 8) ?? "—"}</TableCell>
                  <TableCell className="text-xs">{(r.fields ?? []).join(", ") || "—"}</TableCell>
                  <TableCell>
                    <span className={`text-xs px-2 py-1 rounded-full ${STATUS_TONE[r.status] ?? "bg-muted"}`}>
                      {r.status}
                    </span>
                  </TableCell>
                  <TableCell className="text-xs max-w-md">
                    {r.error ? (
                      <span className="text-rose-700">{r.error}</span>
                    ) : (
                      <code className="text-muted-foreground break-all">{JSON.stringify(r.payload)}</code>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
