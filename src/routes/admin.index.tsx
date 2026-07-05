import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Package, Boxes, ShoppingBag, Users, TrendingUp, TrendingDown,
  Clock, Truck, AlertTriangle, ArrowUpRight, DollarSign, Activity,
} from "lucide-react";
import { getAdminDashboardStats } from "@/lib/admin-mutations.functions";
import { formatBDT } from "@/lib/currency";

export const Route = createFileRoute("/admin/")({ component: AdminDashboard });

type Stats = Awaited<ReturnType<typeof getAdminDashboardStats>>;

function AdminDashboard() {
  const fetchStats = useServerFn(getAdminDashboardStats);
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "dashboard-stats"],
    queryFn: () => fetchStats(),
    refetchInterval: 60_000,
  });

  const revenueChange = data
    ? data.revenuePrev > 0
      ? ((data.revenue30 - data.revenuePrev) / data.revenuePrev) * 100
      : data.revenue30 > 0 ? 100 : 0
    : 0;

  return (
    <div className="max-w-[1400px] mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-muted-foreground">Overview</p>
          <h1 className="text-3xl font-serif font-semibold tracking-tight mt-1">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {new Date().toLocaleDateString("en-BD", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm"><Link to="/admin/orders">All orders</Link></Button>
          <Button asChild variant="luxe" size="sm"><Link to="/admin/products">Manage products</Link></Button>
        </div>
      </div>

      {/* Hero KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Revenue (30d)"
          value={isLoading ? "—" : formatBDT(data?.revenue30 ?? 0)}
          hint={
            data
              ? `${revenueChange >= 0 ? "+" : ""}${revenueChange.toFixed(1)}% vs prev 30d`
              : ""
          }
          trend={revenueChange >= 0 ? "up" : "down"}
          icon={<DollarSign className="w-4 h-4" />}
          featured
        />
        <KpiCard
          label="Orders (30d)"
          value={isLoading ? "—" : String(data?.orders30 ?? 0)}
          hint={`${data?.ordersToday ?? 0} today`}
          icon={<ShoppingBag className="w-4 h-4" />}
        />
        <KpiCard
          label="Pending fulfilment"
          value={isLoading ? "—" : String((data?.pendingOrders ?? 0) + (data?.processingOrders ?? 0))}
          hint={`${data?.pendingOrders ?? 0} pending · ${data?.processingOrders ?? 0} processing`}
          icon={<Clock className="w-4 h-4" />}
          tone="warn"
        />
        <KpiCard
          label="Customers"
          value={isLoading ? "—" : String(data?.customersCount ?? 0)}
          hint={`${data?.productsCount ?? 0} products · ${data?.combosCount ?? 0} combos`}
          icon={<Users className="w-4 h-4" />}
        />
      </div>

      {/* Chart + Status */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2 p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-semibold">Revenue · last 14 days</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Daily gross, excluding cancelled & returned</p>
            </div>
            <TrendingUp className="w-4 h-4 text-[color:var(--gold)]" />
          </div>
          <RevenueSparkline days={data?.days ?? []} />
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold">Order status · 30d</h2>
            <Activity className="w-4 h-4 text-muted-foreground" />
          </div>
          <div className="space-y-2.5">
            {(data?.statusBreakdown ?? []).map((s) => {
              const total = data?.orders30 || 1;
              const pct = (s.count / total) * 100;
              return (
                <div key={s.status}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-muted-foreground">{s.status}</span>
                    <span className="font-medium tabular-nums">{s.count}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className={`h-full rounded-full ${statusBarClass(s.status)}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      {/* Recent orders + low stock */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2 p-0 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b">
            <div>
              <h2 className="text-sm font-semibold">Recent orders</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Latest 8 across all statuses</p>
            </div>
            <Button asChild variant="ghost" size="sm" className="h-8 text-xs">
              <Link to="/admin/orders" className="flex items-center gap-1">
                View all <ArrowUpRight className="w-3 h-3" />
              </Link>
            </Button>
          </div>
          <div className="divide-y">
            {isLoading && <RowSkeleton count={5} />}
            {!isLoading && (data?.recentOrders ?? []).length === 0 && (
              <div className="px-5 py-10 text-center text-sm text-muted-foreground">No orders yet.</div>
            )}
            {(data?.recentOrders ?? []).map((o) => {
              const cust = (o.customer_json as { name?: string; phone?: string } | null) ?? {};
              return (
                <Link
                  key={o.id}
                  to="/admin/orders/$id"
                  params={{ id: o.id }}
                  className="flex items-center gap-4 px-5 py-3.5 hover:bg-muted/40 transition-colors"
                >
                  <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <ShoppingBag className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium truncate">{o.order_number}</span>
                      <StatusPill status={o.order_status} />
                    </div>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                      {cust.name || "Guest"} · {new Date(o.created_at).toLocaleDateString("en-BD", { day: "numeric", month: "short" })}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-semibold tabular-nums">{formatBDT(o.total)}</p>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground mt-0.5">{o.payment_status}</p>
                  </div>
                </Link>
              );
            })}
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-semibold">Low stock</h2>
              <p className="text-xs text-muted-foreground mt-0.5">≤ 5 units remaining</p>
            </div>
            <AlertTriangle className="w-4 h-4 text-amber-500" />
          </div>
          <div className="space-y-2">
            {isLoading && <RowSkeleton count={4} thin />}
            {!isLoading && (data?.lowStock ?? []).length === 0 && (
              <div className="py-8 text-center text-xs text-muted-foreground">
                All products well stocked.
              </div>
            )}
            {(data?.lowStock ?? []).map((p) => (
              <Link
                key={p.id}
                to="/admin/products"
                className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors"
              >
                <div className="w-10 h-10 rounded-md bg-muted overflow-hidden shrink-0">
                  {p.image_url && <img src={p.image_url} alt="" className="w-full h-full object-cover" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{p.name}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {p.stock_quantity} in stock
                  </p>
                </div>
                <Badge
                  variant="outline"
                  className={`text-[10px] ${p.stock_quantity === 0 ? "border-red-500/40 text-red-600" : "border-amber-500/40 text-amber-700"}`}
                >
                  {p.stock_quantity === 0 ? "Out" : "Low"}
                </Badge>
              </Link>
            ))}
          </div>
        </Card>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <QuickLink to="/admin/products" icon={<Package className="w-4 h-4" />} label="Products" />
        <QuickLink to="/admin/combos" icon={<Boxes className="w-4 h-4" />} label="Combos" />
        <QuickLink to="/admin/zones" icon={<Truck className="w-4 h-4" />} label="Delivery zones" />
        <QuickLink to="/admin/customers" icon={<Users className="w-4 h-4" />} label="Customers" />
      </div>
    </div>
  );
}

function KpiCard({
  label, value, hint, icon, trend, tone, featured,
}: {
  label: string;
  value: string;
  hint?: string;
  icon: React.ReactNode;
  trend?: "up" | "down";
  tone?: "warn";
  featured?: boolean;
}) {
  return (
    <Card
      className={`p-5 relative overflow-hidden ${
        featured
          ? "bg-gradient-luxe text-primary-foreground border-0 shadow-luxe"
          : "shadow-card"
      }`}
    >
      <div className="flex items-center justify-between">
        <span className={`text-[11px] font-medium uppercase tracking-[0.18em] ${featured ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
          {label}
        </span>
        <div
          className={`w-8 h-8 rounded-lg flex items-center justify-center ${
            featured
              ? "bg-white/15 text-[color:var(--gold)]"
              : tone === "warn"
                ? "bg-amber-500/10 text-amber-600"
                : "bg-primary/10 text-primary"
          }`}
        >
          {icon}
        </div>
      </div>
      <p className={`text-3xl font-serif font-semibold mt-3 tabular-nums ${featured ? "text-primary-foreground" : ""}`}>
        {value}
      </p>
      {hint && (
        <p className={`text-xs mt-1.5 flex items-center gap-1 ${featured ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
          {trend === "up" && <TrendingUp className="w-3 h-3" />}
          {trend === "down" && <TrendingDown className="w-3 h-3" />}
          {hint}
        </p>
      )}
      {featured && (
        <div className="absolute -right-8 -bottom-8 w-32 h-32 rounded-full bg-[color:var(--gold)]/10 blur-2xl pointer-events-none" />
      )}
    </Card>
  );
}

function RevenueSparkline({ days }: { days: Stats["days"] }) {
  const max = Math.max(1, ...days.map((d) => d.revenue));
  return (
    <div>
      <div className="flex items-end gap-1.5 h-32">
        {days.map((d) => {
          const h = (d.revenue / max) * 100;
          return (
            <div key={d.date} className="flex-1 flex flex-col items-center gap-1 group">
              <div className="w-full flex-1 flex items-end">
                <div
                  className="w-full rounded-t bg-gradient-to-t from-primary/60 to-[color:var(--gold)]/80 transition-all group-hover:opacity-80"
                  style={{ height: `${Math.max(h, 2)}%` }}
                  title={`${d.date}: ${formatBDT(d.revenue)} · ${d.orders} orders`}
                />
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex justify-between mt-2 text-[10px] text-muted-foreground">
        <span>{days[0]?.date.slice(5)}</span>
        <span>{days[Math.floor(days.length / 2)]?.date.slice(5)}</span>
        <span>{days[days.length - 1]?.date.slice(5)}</span>
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const cls =
    status === "Completed" ? "bg-emerald-500/10 text-emerald-700 border-emerald-500/20" :
    status === "Shipped" ? "bg-blue-500/10 text-blue-700 border-blue-500/20" :
    status === "Processing" ? "bg-indigo-500/10 text-indigo-700 border-indigo-500/20" :
    status === "Cancelled" || status === "Returned" ? "bg-red-500/10 text-red-700 border-red-500/20" :
    "bg-amber-500/10 text-amber-700 border-amber-500/20";
  return (
    <span className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded border ${cls}`}>
      {status}
    </span>
  );
}

function statusBarClass(status: string) {
  switch (status) {
    case "Completed": return "bg-emerald-500";
    case "Shipped": return "bg-blue-500";
    case "Processing": return "bg-indigo-500";
    case "Cancelled":
    case "Returned": return "bg-red-500";
    default: return "bg-amber-500";
  }
}

function QuickLink({ to, icon, label }: { to: string; icon: React.ReactNode; label: string }) {
  return (
    <Link
      to={to}
      className="group flex items-center gap-3 p-3 rounded-xl border bg-card hover:border-[color:var(--gold)]/50 hover:shadow-card transition-all"
    >
      <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center group-hover:bg-[color:var(--gold)]/15 group-hover:text-[color:var(--gold)] transition-colors">
        {icon}
      </div>
      <span className="text-sm font-medium">{label}</span>
      <ArrowUpRight className="w-3.5 h-3.5 ml-auto text-muted-foreground group-hover:text-foreground transition-colors" />
    </Link>
  );
}

function RowSkeleton({ count, thin }: { count: number; thin?: boolean }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className={`flex items-center gap-3 ${thin ? "p-2" : "px-5 py-3.5"}`}>
          <div className={`${thin ? "w-10 h-10" : "w-9 h-9"} rounded-lg bg-muted animate-pulse`} />
          <div className="flex-1 space-y-1.5">
            <div className="h-3 w-1/3 bg-muted rounded animate-pulse" />
            <div className="h-2 w-1/2 bg-muted rounded animate-pulse" />
          </div>
        </div>
      ))}
    </>
  );
}
