import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Bell, ShoppingBag, Star, Mail } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

type Counts = { orders: number; reviews: number; contact: number };

async function fetchCounts(): Promise<Counts> {
  const [orders, reviews, contact] = await Promise.all([
    supabase.from("orders").select("*", { count: "exact", head: true }).eq("order_status", "Pending"),
    supabase.from("product_reviews").select("*", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("contact_messages").select("*", { count: "exact", head: true }).eq("status", "unread"),
  ]);
  return {
    orders: orders.count ?? 0,
    reviews: reviews.count ?? 0,
    contact: contact.count ?? 0,
  };
}

export function AdminNotifications() {
  const { data } = useQuery({
    queryKey: ["admin", "notifications"],
    queryFn: fetchCounts,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });

  const counts = data ?? { orders: 0, reviews: 0, contact: 0 };
  const total = counts.orders + counts.reviews + counts.contact;

  const items: { to: string; label: string; count: number; icon: typeof ShoppingBag }[] = [
    { to: "/admin/orders", label: "New orders", count: counts.orders, icon: ShoppingBag },
    { to: "/admin/reviews", label: "Pending reviews", count: counts.reviews, icon: Star },
    { to: "/admin/inbox", label: "Unread messages", count: counts.contact, icon: Mail },
  ];

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative h-9 w-9 text-muted-foreground hover:text-foreground"
          aria-label={`Notifications${total ? ` (${total} new)` : ""}`}
        >
          <Bell className="w-[18px] h-[18px]" />
          {total > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-white text-[10px] font-semibold flex items-center justify-center ring-2 ring-background">
              {total > 99 ? "99+" : total}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="px-4 py-3 border-b">
          <p className="text-sm font-semibold">Notifications</p>
          <p className="text-xs text-muted-foreground">
            {total > 0 ? `${total} item${total === 1 ? "" : "s"} need attention` : "You're all caught up"}
          </p>
        </div>
        <div className="py-1">
          {items.map((it) => (
            <Link
              key={it.to}
              to={it.to}
              className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/60 transition-colors"
            >
              <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                <it.icon className="w-4 h-4 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm">{it.label}</p>
              </div>
              <span
                className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                  it.count > 0 ? "bg-rose-100 text-rose-700" : "bg-muted text-muted-foreground"
                }`}
              >
                {it.count}
              </span>
            </Link>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
