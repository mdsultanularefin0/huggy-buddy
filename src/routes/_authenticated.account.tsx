import { createFileRoute, Link, Outlet, useNavigate } from "@tanstack/react-router";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { User, Package, MapPin, Heart, LogOut } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";


export const Route = createFileRoute("/_authenticated/account")({
  head: () => ({ meta: [{ title: "My Account — Veloura Essence" }] }),
  component: AccountLayout,
});

const nav = [
  { to: "/account" as const, label: "Profile", icon: User, exact: true },
  { to: "/account/orders" as const, label: "Orders", icon: Package },
  { to: "/account/addresses" as const, label: "Addresses", icon: MapPin },
  { to: "/account/wishlist" as const, label: "Wishlist", icon: Heart },
];

function AccountLayout() {
  const navigate = useNavigate();
  const qc = useQueryClient();

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <main className="flex-1 bg-gradient-soft py-8">
        <div className="container max-w-6xl px-4 grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
          <aside className="rounded-2xl bg-card border p-2 h-fit min-w-0">
            <nav className="flex lg:flex-col gap-1 overflow-x-auto lg:overflow-visible [-webkit-overflow-scrolling:touch] [scrollbar-width:thin] snap-x snap-mandatory lg:snap-none">

              {nav.map(({ to, label, icon: Icon, exact }) => (
                <Link
                  key={to}
                  to={to}
                  activeOptions={{ exact: !!exact }}
                  activeProps={{ className: "bg-primary/10 text-primary font-medium" }}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm whitespace-nowrap shrink-0 snap-start hover:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                >
                  <Icon className="w-4 h-4" /> {label}
                </Link>
              ))}
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="justify-start gap-2 mt-1 text-muted-foreground hover:text-destructive"
                  >
                    <LogOut className="w-4 h-4" /> Sign out
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Sign out?</AlertDialogTitle>
                    <AlertDialogDescription>
                      You'll need to sign in again to access your account.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={signOut}>Sign out</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>

            </nav>
          </aside>
          <section className="rounded-2xl bg-card border p-4 sm:p-6 min-h-[400px] min-w-0">
            <Outlet />
          </section>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
