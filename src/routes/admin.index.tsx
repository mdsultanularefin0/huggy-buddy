import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Card } from "@/components/ui/card";
import { Package, Boxes, ShoppingBag, CheckCircle2, Truck, CreditCard } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getAdminOrderCount } from "@/lib/admin-mutations.functions";

export const Route = createFileRoute("/admin/")({ component: AdminDashboard });

function useCount(table: "products" | "combos" | "delivery_zones" | "payment_methods") {
  return useQuery({
    queryKey: ["admin", "count", table],
    queryFn: async () => {
      const { count, error } = await supabase.from(table).select("*", { count: "exact", head: true });
      if (error) throw error;
      return count ?? 0;
    },
  });
}

function AdminDashboard() {
  const fetchOrderCount = useServerFn(getAdminOrderCount);
  const products = useCount("products");
  const combos = useCount("combos");
  const orders = useQuery({
    queryKey: ["admin", "count", "orders"],
    queryFn: () => fetchOrderCount(),
  });
  const zones = useCount("delivery_zones");
  const payments = useCount("payment_methods");

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground mt-1">Welcome to the Veloura Essence admin panel.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <StatCard icon={<Package className="w-5 h-5" />} label="Products" value={products.data} />
        <StatCard icon={<Boxes className="w-5 h-5" />} label="Combos" value={combos.data} />
        <StatCard icon={<ShoppingBag className="w-5 h-5" />} label="Orders" value={orders.data} />
        <StatCard icon={<Truck className="w-5 h-5" />} label="Zones" value={zones.data} />
        <StatCard icon={<CreditCard className="w-5 h-5" />} label="Payments" value={payments.data} />
      </div>

      <Card className="p-6 bg-gradient-luxe text-primary-foreground border-0 shadow-luxe">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center shrink-0">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Phase 2 complete</h2>
            <p className="text-sm opacity-90 mt-1 max-w-xl">
              Products, Delivery Zones, Payment Methods, and Site Settings are now editable from the admin panel.
              Next: Phase 3 — the dual combo engine (fixed bundles + build-your-own boxes).
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number | undefined }) {
  return (
    <Card className="p-5 shadow-card">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{label}</span>
        <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center">{icon}</div>
      </div>
      <p className="text-3xl font-semibold mt-3">{value ?? "—"}</p>
    </Card>
  );
}
