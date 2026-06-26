import { Link } from "@tanstack/react-router";
import { Sparkles, ShoppingCart, Menu, X, Search, User } from "lucide-react";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { useCart, cartCount } from "@/lib/cart-store";
import { supabase } from "@/integrations/supabase/client";

export function SiteHeader({ position = "sticky", logoUrl, logoSize }: { position?: "sticky" | "static" | "floating"; logoUrl?: string | null; logoSize?: number | null } = {}) {
  const items = useCart((s) => s.items);
  const open = useCart((s) => s.open);
  const count = cartCount(items);
  const [mobileOpen, setMobileOpen] = useState(false);

  const { data: branding } = useQuery({
    queryKey: ["storefront", "branding"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("site_settings")
        .select("site_logo_url, site_icon_url, header_logo_size")
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    staleTime: 60_000,
  });

  const effectiveLogo = logoUrl ?? branding?.site_logo_url ?? null;
  const effectiveLogoSize = logoSize ?? branding?.header_logo_size ?? 36;
  const iconUrl = branding?.site_icon_url ?? null;

  useEffect(() => {
    if (typeof document === "undefined" || !iconUrl) return;
    const selectors = ['link[rel="icon"]', 'link[rel="shortcut icon"]', 'link[rel="apple-touch-icon"]'];
    selectors.forEach((sel) => document.head.querySelectorAll(sel).forEach((el) => el.remove()));
    const link = document.createElement("link");
    link.rel = "icon";
    link.href = iconUrl;
    document.head.appendChild(link);
    const apple = document.createElement("link");
    apple.rel = "apple-touch-icon";
    apple.href = iconUrl;
    document.head.appendChild(apple);
  }, [iconUrl]);

  const links = [
    { to: "/" as const, label: "Home" },
    { to: "/" as const, hash: "female", label: "Female Fragrance" },
    { to: "/" as const, hash: "male", label: "Male Fragrance" },
    { to: "/" as const, hash: "combos", label: "Combo Pack" },
    { to: "/" as const, hash: "byob", label: "Custom Combo" },
  ];

  const positionClass =
    position === "floating"
      ? "absolute inset-x-0 top-0 z-40 bg-primary/80 backdrop-blur-md text-primary-foreground border-b border-white/10"
      : position === "static"
      ? "relative z-40 bg-primary text-primary-foreground border-b border-white/10"
      : "sticky top-0 z-40 bg-primary text-primary-foreground border-b border-white/10";

  return (
    <header className={positionClass}>
      <div className="w-full px-6 lg:px-10 h-16 flex items-center justify-between gap-6">
        {/* LEFT — logo */}
        <Link to="/" className="flex items-center gap-2 shrink-0" aria-label="Home">
          {effectiveLogo ? (
            <img
              src={effectiveLogo}
              alt="Site logo"
              style={{ height: effectiveLogoSize }}
              className="w-auto object-contain"
            />
          ) : null}
        </Link>



        {/* CENTER — nav */}
        <nav className="hidden lg:flex items-center gap-8 text-sm font-medium text-primary-foreground/90 mx-auto">
          {links.map((l) => (
            <Link
              key={l.label}
              to={l.to}
              hash={l.hash}
              className="hover:text-white transition-colors whitespace-nowrap"
            >
              {l.label}
            </Link>
          ))}
        </nav>

        {/* RIGHT — search, profile, cart */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            aria-label="Search"
            className="w-10 h-10 rounded-full hover:bg-white/10 text-primary-foreground flex items-center justify-center transition-colors"
          >
            <Search className="w-5 h-5" />
          </button>
          <Link
            to="/auth"
            aria-label="Profile"
            className="w-10 h-10 rounded-full hover:bg-white/10 text-primary-foreground flex items-center justify-center transition-colors"
          >
            <User className="w-5 h-5" />
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
        <div className="lg:hidden border-t border-white/10 bg-primary px-6 py-4 flex flex-col gap-3 text-sm">
          {links.map((l) => (
            <Link key={l.label} to={l.to} hash={l.hash} onClick={() => setMobileOpen(false)} className="py-1">
              {l.label}
            </Link>
          ))}
        </div>
      )}
    </header>
  );
}
