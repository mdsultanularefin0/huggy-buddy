import { createFileRoute, Outlet, useNavigate, Link, useRouterState, redirect } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { checkAdminAccess } from "@/lib/admin-access.functions";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-session";
import { brandingQueryOptions } from "@/lib/branding-query";
import {
  SidebarProvider, Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarTrigger,
  SidebarHeader, SidebarFooter,
} from "@/components/ui/sidebar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard, Package, Boxes, Truck, CreditCard, ShoppingBag,
  Users, Megaphone, Settings, LogOut, Palette, Droplet, ScrollText, Tags, Home, Loader2, FileText, Star, Images, Plug,
  ChevronDown, Store, Mail,
} from "lucide-react";

import { toast } from "sonner";

export const Route = createFileRoute("/admin")({
  ssr: false,
  head: () => ({ meta: [{ title: "Admin — Veloura Essence" }, { name: "robots", content: "noindex" }] }),
  beforeLoad: async ({ location }) => {
    // Server-side admin check — prevents the UI from flashing before non-admins are kicked out.
    try {
      const res = await checkAdminAccess();
      if (!res.isAdmin) {
        // Signed in but not an admin — send home.
        throw redirect({ to: "/" });
      }
      return { adminUserId: res.userId };
    } catch (err) {
      // requireSupabaseAuth throws a 401 Response when unauthenticated.
      const isUnauth =
        err instanceof Response
          ? err.status === 401
          : /unauthorized|no authorization/i.test(String((err as Error)?.message ?? ""));
      if (isUnauth) {
        throw redirect({ to: "/auth", search: { redirect: location.href } });
      }
      throw err;
    }
  },
  component: AdminLayout,
  pendingComponent: AdminLoading,
});

type NavItem = { to: string; label: string; icon: typeof LayoutDashboard; exact?: boolean };
type NavGroup = { label: string; items: NavItem[] };

const NAV_GROUPS: NavGroup[] = [
  {
    label: "Overview",
    items: [{ to: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true }],
  },
  {
    label: "Catalog",
    items: [
      { to: "/admin/products", label: "Products", icon: Package },
      { to: "/admin/categories", label: "Categories", icon: Tags },
      { to: "/admin/combos", label: "Combos", icon: Boxes },
      { to: "/admin/notes", label: "Scent Notes", icon: Droplet },
    ],
  },
  {
    label: "Sales",
    items: [
      { to: "/admin/orders", label: "Orders", icon: ShoppingBag },
      { to: "/admin/customers", label: "Customers", icon: Users },
      { to: "/admin/reviews", label: "Reviews", icon: Star },
      { to: "/admin/referrals", label: "Referrals", icon: Megaphone },
      { to: "/admin/coupons", label: "Coupons", icon: Tags },
      { to: "/admin/newsletter", label: "Newsletter", icon: Mail },
      { to: "/admin/inbox", label: "Support Inbox", icon: Mail },
    ],
  },
  {
    label: "Fulfilment",
    items: [
      { to: "/admin/zones", label: "Delivery Zones", icon: Truck },
      { to: "/admin/payments", label: "Payment Methods", icon: CreditCard },
    ],
  },
  {
    label: "Storefront",
    items: [
      { to: "/admin/homepage", label: "Homepage", icon: Home },
      { to: "/admin/pages", label: "Pages", icon: FileText },
      { to: "/admin/media", label: "Media Library", icon: Images },
      { to: "/admin/color-presets", label: "Color Presets", icon: Palette },
    ],
  },
  {
    label: "System",
    items: [
      { to: "/admin/integrations", label: "Integrations", icon: Plug },
      { to: "/admin/audit-logs", label: "Audit Logs", icon: ScrollText },
      { to: "/admin/settings", label: "Site Settings", icon: Settings },
    ],
  },
];

function AdminLayout() {
  const { user, loading } = useSession();

  // The route's beforeLoad has already verified admin access before this
  // component renders — no client-side role check needed.
  if (loading) return <AdminLoading />;
  if (!user) return null;



  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-muted/30">
        <AdminSidebar email={user.email ?? ""} />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 border-b border-border/60 bg-background/70 backdrop-blur-xl flex items-center px-4 gap-3 sticky top-0 z-30">
            <SidebarTrigger className="text-muted-foreground hover:text-foreground" />
            <div className="h-5 w-px bg-border/70" />
            <span className="text-[11px] font-medium uppercase tracking-[0.22em] text-muted-foreground">Veloura Essence · Admin</span>
          </header>
          <main className="flex-1 p-3 sm:p-6 lg:p-8">
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
  const { data: branding } = useQuery(brandingQueryOptions);
  const logoUrl = branding?.site_logo_url ?? null;

  const isActive = (to: string, exact?: boolean) =>
    exact ? pathname === to : pathname === to || pathname.startsWith(to + "/");

  async function signOut() {
    await supabase.auth.signOut();
    toast.success("Signed out");
    navigate({ to: "/auth" });
  }

  const initial = (email?.[0] ?? "V").toUpperCase();

  return (
    <Sidebar
      collapsible="icon"
      className="border-r border-sidebar-border/60 [&_[data-sidebar=sidebar]]:bg-[linear-gradient(180deg,oklch(0.24_0.08_305)_0%,oklch(0.18_0.06_305)_100%)]"
    >
      <SidebarHeader className="border-b border-sidebar-border/40 px-3 py-4">
        <Link to="/" className="flex items-center gap-2.5 group">
          {logoUrl ? (
            <img src={logoUrl} alt="Site logo" className="h-9 w-auto object-contain shrink-0 transition-transform group-hover:scale-[1.03]" />
          ) : (
            <div className="w-9 h-9 rounded-xl bg-gradient-luxe flex items-center justify-center shadow-luxe shrink-0 ring-1 ring-[color:var(--gold)]/30 transition-transform group-hover:scale-[1.03]">
              <Store className="w-4 h-4 text-primary-foreground" />
            </div>
          )}
        </Link>
      </SidebarHeader>
      <SidebarContent className="px-1.5 py-3 gap-1">
        {NAV_GROUPS.map((group, idx) => {
          const hasActive = group.items.some((i) => isActive(i.to, i.exact));
          return (
            <Collapsible key={group.label} defaultOpen={hasActive} className="group/collapsible">
              <SidebarGroup className="py-1">
                <SidebarGroupLabel asChild>
                  <CollapsibleTrigger
                    className={`flex w-full items-center justify-between px-2 py-1.5 text-[10px] font-medium uppercase tracking-[0.2em] text-sidebar-foreground/45 hover:text-[color:var(--gold)]/90 transition-colors ${idx > 0 ? "mt-1" : ""}`}
                  >
                    <span className="flex items-center gap-2">
                      <span className="h-px w-3 bg-sidebar-foreground/20 group-data-[collapsible=icon]:hidden" />
                      {group.label}
                    </span>
                    <ChevronDown className="w-3 h-3 opacity-60 transition-transform group-data-[state=closed]/collapsible:-rotate-90 group-data-[collapsible=icon]:hidden" />
                  </CollapsibleTrigger>
                </SidebarGroupLabel>
                <CollapsibleContent>
                  <SidebarGroupContent>
                    <SidebarMenu className="gap-0.5">
                      {group.items.map((item) => {
                        const active = isActive(item.to, item.exact);
                        return (
                          <SidebarMenuItem key={item.to}>
                            <SidebarMenuButton
                              asChild
                              isActive={active}
                              className={`relative h-9 rounded-lg transition-all duration-200 text-sidebar-foreground/75 hover:text-sidebar-foreground hover:bg-white/[0.04] data-[active=true]:bg-white/[0.06] data-[active=true]:text-sidebar-foreground data-[active=true]:font-medium data-[active=true]:shadow-[inset_2px_0_0_0_var(--gold)]`}
                            >
                              <Link to={item.to} className="flex items-center gap-2.5">
                                <item.icon className={`w-4 h-4 shrink-0 transition-colors ${active ? "text-[color:var(--gold)]" : "text-sidebar-foreground/55 group-hover:text-sidebar-foreground"}`} />
                                <span className="text-[13px] tracking-wide">{item.label}</span>
                              </Link>
                            </SidebarMenuButton>
                          </SidebarMenuItem>
                        );
                      })}
                    </SidebarMenu>
                  </SidebarGroupContent>
                </CollapsibleContent>
              </SidebarGroup>
            </Collapsible>
          );
        })}
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border/40 p-3 gap-2">
        <div className="flex items-center gap-2.5 group-data-[collapsible=icon]:justify-center">
          <div className="w-8 h-8 rounded-full bg-gradient-luxe flex items-center justify-center text-primary-foreground text-xs font-semibold ring-1 ring-[color:var(--gold)]/30 shrink-0">
            {initial}
          </div>
          <div className="flex flex-col min-w-0 group-data-[collapsible=icon]:hidden">
            <span className="text-[10px] uppercase tracking-[0.18em] text-sidebar-foreground/45">Signed in</span>
            <span className="text-xs text-sidebar-foreground/90 truncate">{email}</span>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={signOut}
          className="w-full justify-start h-8 text-[12px] text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-white/[0.05] group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0"
        >
          <LogOut className="w-3.5 h-3.5 mr-2 group-data-[collapsible=icon]:mr-0" />
          <span className="group-data-[collapsible=icon]:hidden">Sign out</span>
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}


function AdminLoading() {
  const { data: branding } = useQuery(brandingQueryOptions);
  const logoUrl = branding?.site_logo_url ?? branding?.site_icon_url ?? null;
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4">
        <div className="relative w-20 h-20">
          <span className="absolute inset-0 rounded-full border-2 border-[color:var(--gold)]/20" />
          <span className="absolute inset-0 rounded-full border-2 border-transparent border-t-[color:var(--gold)] animate-spin" />
          <div className="absolute inset-2 rounded-full bg-background flex items-center justify-center overflow-hidden">
            {logoUrl ? (
              <img src={logoUrl} alt="" className="w-10 h-10 object-contain" />
            ) : (
              <Loader2 className="w-6 h-6 text-[color:var(--gold)] animate-spin" />
            )}
          </div>
        </div>
        <p className="text-xs uppercase tracking-[0.28em] text-muted-foreground">Verifying admin access</p>
      </div>
    </div>
  );
}
