import { createFileRoute, Outlet, useNavigate, Link, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSession, useIsAdmin } from "@/hooks/use-session";
import {
  SidebarProvider, Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarTrigger,
  SidebarHeader, SidebarFooter,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard, Package, Boxes, Truck, CreditCard, ShoppingBag,
  Users, Megaphone, Settings, LogOut, Sparkles, ScrollText,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Admin — Veloura Essence" }, { name: "robots", content: "noindex" }] }),
  component: AdminLayout,
});

const NAV: { to: string; label: string; icon: typeof LayoutDashboard; exact?: boolean }[] = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  
  { to: "/admin/products", label: "Products", icon: Package },
  { to: "/admin/combos", label: "Combos", icon: Boxes },
  { to: "/admin/zones", label: "Delivery Zones", icon: Truck },
  { to: "/admin/payments", label: "Payment Methods", icon: CreditCard },
  { to: "/admin/orders", label: "Orders", icon: ShoppingBag },
  { to: "/admin/customers", label: "Customers", icon: Users },
  { to: "/admin/referrals", label: "Referrals", icon: Megaphone },
  { to: "/admin/audit-logs", label: "Audit Logs", icon: ScrollText },
  { to: "/admin/settings", label: "Site Settings", icon: Settings },
];

function AdminLayout() {
  const navigate = useNavigate();
  const { user, loading } = useSession();
  const isAdmin = useIsAdmin(user?.id);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth", search: { redirect: "/admin" } });
  }, [loading, user, navigate]);

  if (loading || (user && isAdmin === null)) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground text-sm">
        Loading admin panel…
      </div>
    );
  }
  if (!user) return null;
  if (isAdmin === false) return <NotAnAdmin email={user.email ?? ""} />;

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-muted/30">
        <AdminSidebar email={user.email ?? ""} />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 border-b bg-background/80 backdrop-blur flex items-center px-4 gap-3 sticky top-0 z-30">
            <SidebarTrigger />
            <span className="text-sm font-medium text-muted-foreground">Veloura Essence Admin</span>
          </header>
          <main className="flex-1 p-6 lg:p-8">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

function AdminSidebar({ email }: { email: string }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();

  const isActive = (to: string, exact?: boolean) =>
    exact ? pathname === to : pathname === to || pathname.startsWith(to + "/");

  async function signOut() {
    await supabase.auth.signOut();
    toast.success("Signed out");
    navigate({ to: "/auth" });
  }

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <Link to="/admin" className="flex items-center gap-2 px-2 py-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-luxe flex items-center justify-center shadow-soft shrink-0">
            <Sparkles className="w-4 h-4 text-primary-foreground" />
          </div>
          <span className="font-semibold text-sidebar-foreground truncate">Veloura</span>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Manage</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV.map((item) => (
                <SidebarMenuItem key={item.to}>
                  <SidebarMenuButton asChild isActive={isActive(item.to, item.exact)}>
                    <Link to={item.to} className="flex items-center gap-2">
                      <item.icon className="w-4 h-4" />
                      <span>{item.label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <div className="p-2 text-xs text-sidebar-foreground/70 truncate">{email}</div>
        <Button variant="ghost" size="sm" onClick={signOut} className="w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent">
          <LogOut className="w-4 h-4 mr-2" /> Sign out
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}

function NotAnAdmin({ email }: { email: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-soft">
      <div className="max-w-md text-center bg-card p-8 rounded-2xl shadow-luxe border">
        <h1 className="text-xl font-semibold">Admin access required</h1>
        <p className="text-sm text-muted-foreground mt-2">
          You're signed in as <span className="font-medium text-foreground">{email}</span>, but this account doesn't have admin access.
        </p>
        <p className="text-xs text-muted-foreground mt-4">
          To grant admin: run this SQL once in the Cloud SQL editor, replacing the email.
        </p>
        <pre className="text-xs bg-muted p-3 rounded-lg mt-2 text-left overflow-x-auto">
{`INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin' FROM auth.users
WHERE email = '${email}'
ON CONFLICT DO NOTHING;`}
        </pre>
        <div className="mt-6 flex gap-2 justify-center">
          <Button variant="outline" asChild><Link to="/">Back to store</Link></Button>
          <Button variant="luxe" onClick={async () => { await supabase.auth.signOut(); window.location.href = "/auth"; }}>
            Sign out
          </Button>
        </div>
      </div>
    </div>
  );
}
