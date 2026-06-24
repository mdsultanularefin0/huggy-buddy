import { Link } from "@tanstack/react-router";
import { Sparkles, ShoppingCart, Menu, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useCart, cartCount } from "@/lib/cart-store";

export function SiteHeader({ position = "sticky", logoUrl }: { position?: "sticky" | "static" | "floating"; logoUrl?: string | null } = {}) {
  const items = useCart((s) => s.items);
  const open = useCart((s) => s.open);
  const count = cartCount(items);
  const [mobileOpen, setMobileOpen] = useState(false);

  const links = [
    { to: "/" as const, hash: "perfumes", label: "Female Scent" },
    { to: "/" as const, hash: "perfumes", label: "Male Scent" },
    { to: "/" as const, hash: "combos", label: "Combo Pack" },
    { to: "/" as const, hash: "byob", label: "Customize Combo" },
    { to: "/" as const, hash: "footer", label: "Support" },
  ];

  const positionClass =
    position === "floating"
      ? "absolute inset-x-0 top-0 z-40 bg-primary/80 backdrop-blur-md text-primary-foreground border-b border-white/10"
      : position === "static"
      ? "relative z-40 bg-primary text-primary-foreground border-b border-white/10"
      : "sticky top-0 z-40 bg-primary text-primary-foreground border-b border-white/10";

  return (
    <header className={positionClass}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4 sm:gap-6">
        <Link to="/" className="flex items-center gap-2 shrink-0">
          {logoUrl ? (
            <img src={logoUrl} alt="Site logo" className="h-9 w-auto object-contain" />
          ) : (
            <>
              <div className="w-9 h-9 rounded-xl bg-white/15 backdrop-blur flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-accent" />
              </div>
              <div className="leading-none">
                <div className="font-display text-base font-bold tracking-wide text-accent">VELOURA</div>
                <div className="text-[9px] tracking-[0.3em] text-primary-foreground/80">ESSENCE</div>
              </div>
            </>
          )}
        </Link>
        <nav className="hidden lg:flex items-center gap-7 text-sm font-medium text-primary-foreground/90">
          <Link to="/" className="hover:text-white transition-colors">Home</Link>
          {links.map((l) => (
            <Link key={l.label} to={l.to} hash={l.hash} className="hover:text-white transition-colors whitespace-nowrap">
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <Link to="/auth" className="hidden md:inline-flex">
            <Button variant="ghost" size="sm" className="text-primary-foreground hover:bg-white/10 hover:text-white">
              Log in
            </Button>
          </Link>
          <button
            onClick={open}
            aria-label="Open cart"
            className="relative w-10 h-10 rounded-full bg-white text-primary flex items-center justify-center hover:bg-white/90 transition-colors"
          >
            <ShoppingCart className="w-5 h-5" />
            {count > 0 && (
              <span className="absolute -top-1 -right-1 bg-accent text-accent-foreground text-[10px] min-w-[18px] h-[18px] rounded-full flex items-center justify-center px-1 font-semibold">
                {count}
              </span>
            )}
          </button>
          <Button
            variant="ghost"
            size="sm"
            className="lg:hidden text-primary-foreground hover:bg-white/10 hover:text-white"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </Button>
        </div>
      </div>
      {mobileOpen && (
        <div className="lg:hidden border-t border-white/10 bg-primary px-4 sm:px-6 py-4 flex flex-col gap-3 text-sm">
          <Link to="/" onClick={() => setMobileOpen(false)} className="py-1">Home</Link>
          {links.map((l) => (
            <Link key={l.label} to={l.to} hash={l.hash} onClick={() => setMobileOpen(false)} className="py-1">{l.label}</Link>
          ))}
          <Link to="/auth" onClick={() => setMobileOpen(false)} className="py-1 text-primary-foreground/80">Log in</Link>
        </div>
      )}
    </header>
  );
}
