import { Link } from "@tanstack/react-router";
import { Sparkles, ShoppingBag, Menu, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useCart, cartCount } from "@/lib/cart-store";

export function SiteHeader() {
  const items = useCart((s) => s.items);
  const open = useCart((s) => s.open);
  const count = cartCount(items);
  const [mobileOpen, setMobileOpen] = useState(false);

  const links = [
    { to: "/", hash: "perfumes", label: "Shop" },
    { to: "/", hash: "combos", label: "Combos" },
    { to: "/", hash: "byob", label: "Build Your Box" },
  ];

  return (
    <header className="sticky top-0 z-40 backdrop-blur-xl bg-background/60 border-b border-border/60 supports-[backdrop-filter]:bg-background/40">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-gradient-luxe flex items-center justify-center shadow-soft">
            <Sparkles className="w-5 h-5 text-primary-foreground" />
          </div>
          <span className="text-lg font-semibold tracking-tight">Veloura Essence</span>
        </Link>
        <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-muted-foreground">
          <Link to="/" className="hover:text-foreground">Home</Link>
          {links.map((l) => (
            <Link key={l.label} to={l.to} hash={l.hash} className="hover:text-foreground">{l.label}</Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={open} className="relative" aria-label="Open cart">
            <ShoppingBag className="w-5 h-5" />
            {count > 0 && (
              <span className="absolute -top-1 -right-1 bg-accent text-accent-foreground text-[10px] min-w-[18px] h-[18px] rounded-full flex items-center justify-center px-1 font-semibold">
                {count}
              </span>
            )}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="md:hidden"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </Button>
          <Link to="/auth" className="hidden md:inline-flex">
            <Button variant="outline-luxe" size="sm">Admin</Button>
          </Link>
        </div>
      </div>
      {mobileOpen && (
        <div className="md:hidden border-t border-border/60 bg-background/90 backdrop-blur-xl px-6 py-4 flex flex-col gap-3 text-sm">
          <Link to="/" onClick={() => setMobileOpen(false)} className="py-1">Home</Link>
          {links.map((l) => (
            <Link key={l.label} to={l.to} hash={l.hash} onClick={() => setMobileOpen(false)} className="py-1">{l.label}</Link>
          ))}
          <Link to="/auth" onClick={() => setMobileOpen(false)} className="py-1 text-muted-foreground">Admin</Link>
        </div>
      )}
    </header>
  );
}
