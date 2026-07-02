import { Link } from "@tanstack/react-router";
import { ShoppingCart, Menu, X, Search, User } from "lucide-react";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { useCart, cartCount } from "@/lib/cart-store";
import { brandingQueryOptions } from "@/lib/branding-query";
import { supabase } from "@/integrations/supabase/client";
import { SearchDialog } from "@/components/search-dialog";

export function SiteHeader({ position = "sticky", logoUrl, logoSize }: { position?: "sticky" | "static" | "floating"; logoUrl?: string | null; logoSize?: number | null } = {}) {
  const items = useCart((s) => s.items);
  const open = useCart((s) => s.open);
  const count = cartCount(items);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSignedIn(!!data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSignedIn(!!s));
    return () => sub.subscription.unsubscribe();
  }, []);

  const { data: branding, isLoading: brandingLoading } = useQuery(brandingQueryOptions);

  const effectiveLogo = logoUrl ?? branding?.site_logo_url ?? null;
  const effectiveLogoSize = logoSize ?? branding?.header_logo_size ?? 36;
  const iconUrl = branding?.site_icon_url ?? null;
  const showLogoSkeleton = brandingLoading && !effectiveLogo;

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
    { to: "/" as const, label: "Home", params: undefined },
    { to: "/products" as const, label: "All Fragrances", params: undefined },
    { to: "/category/$slug" as const, params: { slug: "female-fragrance" }, label: "Female Fragrance" },
    { to: "/category/$slug" as const, params: { slug: "male-fragrance" }, label: "Male Fragrance" },
    { to: "/category/$slug" as const, params: { slug: "combo-packs" }, label: "Combo Pack" },
    { to: "/category/$slug" as const, params: { slug: "custom-combo" }, label: "Custom Combo" },
    
  ];

  const positionClass =
    position === "floating"
      ? "absolute inset-x-0 top-0 z-40 bg-primary/80 backdrop-blur-md text-primary-foreground border-b border-white/10"
      : position === "static"
      ? "relative z-40 bg-primary text-primary-foreground border-b border-white/10"
      : "sticky top-0 z-40 bg-primary text-primary-foreground border-b border-white/10";

  return (
  return (
    <>
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
              fetchPriority="high"
              loading="eager"
              decoding="async"
            />
          ) : showLogoSkeleton ? (
            <div
              aria-hidden="true"
              style={{ height: effectiveLogoSize, width: effectiveLogoSize * 3 }}
              className="rounded-md bg-white/10 animate-pulse"
            />
          ) : (
            <span className="font-bold text-lg sm:text-xl tracking-wide text-primary-foreground">
              {branding?.shop_name ?? "Veloura Essence"}
            </span>
          )}
        </Link>



        {/* CENTER — nav */}
        <nav className="hidden lg:flex items-center gap-8 text-sm font-medium text-primary-foreground/90 mx-auto">
          {links.map((l) => (
            <Link
              key={l.label}
              to={l.to}
              params={l.params as never}
              className="hover:text-white transition-colors whitespace-nowrap"
            >
              {l.label}
            </Link>
          ))}
        </nav>

        {/* RIGHT — search, profile, cart */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            aria-label="Search"
            className="w-10 h-10 rounded-full hover:bg-white/10 text-primary-foreground flex items-center justify-center transition-colors"
          >
            <Search className="w-5 h-5" />
          </button>
          <Link
            to={signedIn ? "/account" : "/auth"}
            aria-label={signedIn ? "My account" : "Sign in"}
            className="hidden lg:flex w-10 h-10 rounded-full hover:bg-white/10 text-primary-foreground items-center justify-center transition-colors"
          >
            <User className="w-5 h-5" />
          </Link>
          <button
            onClick={open}
            aria-label="Open cart"
            className="relative w-10 h-10 rounded-full hover:bg-white/10 text-primary-foreground flex items-center justify-center transition-colors"
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
            <Link key={l.label} to={l.to} params={l.params as never} onClick={() => setMobileOpen(false)} className="py-1">
              {l.label}
            </Link>
          ))}
          <Link
            to={signedIn ? "/account" : "/auth"}
            onClick={() => setMobileOpen(false)}
            className="py-1 flex items-center gap-2 border-t border-white/10 pt-3 mt-1"
          >
            <User className="w-4 h-4" /> {signedIn ? "My account" : "Sign in"}
          </Link>
        </div>
      )}
    </header>
  );
}
