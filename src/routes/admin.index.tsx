import { createFileRoute } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { Package, Boxes, ShoppingBag, Sparkles } from "lucide-react";

export const Route = createFileRoute("/admin/")({
  component: AdminDashboard,
});

function AdminDashboard() {
  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground mt-1">Welcome to the Veloura Essence admin panel.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard icon={<Package className="w-5 h-5" />} label="Products" value="—" hint="Manage in Products" />
        <StatCard icon={<Boxes className="w-5 h-5" />} label="Combos" value="—" hint="Manage in Combos" />
        <StatCard icon={<ShoppingBag className="w-5 h-5" />} label="Orders" value="—" hint="Manage in Orders" />
      </div>

      <Card className="p-6 bg-gradient-luxe text-primary-foreground border-0 shadow-luxe">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center shrink-0">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Phase 1 complete</h2>
            <p className="text-sm opacity-90 mt-1 max-w-xl">
              The database, design system, and admin shell are ready. Next: Phase 2 — product management,
              site settings CMS, and the dual combo engine. Use the sidebar to navigate the (still empty) sections.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}

function StatCard({ icon, label, value, hint }: { icon: React.ReactNode; label: string; value: string; hint: string }) {
  return (
    <Card className="p-5 shadow-card">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{label}</span>
        <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center">{icon}</div>
      </div>
      <p className="text-3xl font-semibold mt-3">{value}</p>
      <p className="text-xs text-muted-foreground mt-1">{hint}</p>
    </Card>
  );
}
