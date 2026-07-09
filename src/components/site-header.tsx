import { Link, useNavigate } from "@tanstack/react-router";
import { ShoppingCart, Menu, X, User, Search, LogOut, UserCircle } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { useCart, cartCount } from "@/lib/cart-store";
import { brandingQueryOptions } from "@/lib/branding-query";
import { supabase } from "@/integrations/supabase/client";
import { SearchInline } from "@/components/search-inline";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function SiteHeader({ position = "sticky", logoUrl, logoSize }: { position?: "sticky" | "static" | "floating"; logoUrl?: string | null; logoSize?: number | null } = {}) {
  const items = useCart((s) => s.items);
  const open = useCart((s) => s.open);
  const count = cartCount(items);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const searchTriggerRef = useRef<HTMLButtonElement>(null);
  const searchOverlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!searchOpen) return;
    const onDown = (e: MouseEvent | TouchEvent) => {
      const t = e.target as Node;
      if (searchOverlayRef.current?.contains(t)) return;
      if (searchTriggerRef.current?.contains(t)) return;
      setSearchOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSearchOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [searchOpen]);

  const [signedIn, setSignedIn] = useState(false);
  const navigate = useNavigate();
  const qc = useQueryClient();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSignedIn(!!data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSignedIn(!!s));
    return () => sub.subscription.unsubscribe();
  }, []);

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    setMobileOpen(false);
    navigate({ to: "/auth", replace: true });
  }

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
    <>
    <header className={positionClass}>
      <div className="w-full px-6 lg:px-10 h-16 flex items-center justify-between gap-6">
        {/* LEFT — logo */}
        <Link to="/" className="flex items-center gap-2 shrink-0" aria-label="Home">
          {effectiveLogo ? (
            <img
              src={effectiveLogo}
              alt="Veloura Essence luxury fragrance logo"
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
            ref={searchTriggerRef}
            type="button"
            onClick={() => setSearchOpen((v) => !v)}
            aria-label="Search"
            aria-expanded={searchOpen}
            className="w-10 h-10 rounded-full hover:bg-white/10 text-primary-foreground flex items-center justify-center transition-colors"
          >
            <Search className="w-5 h-5" />
          </button>



          {signedIn ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label="My account"
                  className="hidden lg:flex w-10 h-10 rounded-full hover:bg-white/10 text-primary-foreground items-center justify-center transition-colors"
                >
                  <User className="w-5 h-5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuItem onClick={() => navigate({ to: "/account" })}>
                  <UserCircle className="w-4 h-4 mr-2" /> Profile
                </DropdownMenuItem>
                <DropdownMenuItem onClick={signOut} className="text-destructive focus:text-destructive">
                  <LogOut className="w-4 h-4 mr-2" /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Link
              to="/auth"
              aria-label="Sign in"
              className="hidden lg:flex w-10 h-10 rounded-full hover:bg-white/10 text-primary-foreground items-center justify-center transition-colors"
            >
              <User className="w-5 h-5" />
            </Link>
          )}
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

      {searchOpen && (
        <div className="absolute left-0 right-0 top-full z-50 border-t border-white/10 bg-primary px-4 sm:px-6 py-3 shadow-luxe">
          <div className="max-w-2xl mx-auto">
            <SearchInline
              autoFocus
              onClose={() => setSearchOpen(false)}
              className="w-full"
            />
          </div>
        </div>
      )}


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
          {signedIn && (
            <button
              type="button"
              onClick={signOut}
              className="py-1 flex items-center gap-2 text-left text-red-200 hover:text-white"
            >
              <LogOut className="w-4 h-4" /> Sign out
            </button>
          )}
        </div>
      )}
    </header>
    </>
  );
}

