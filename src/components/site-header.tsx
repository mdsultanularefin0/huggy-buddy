import { Link } from "@tanstack/react-router";
import { Sparkles, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCart, cartCount } from "@/lib/cart-store";

export function SiteHeader() {
  const items = useCart((s) => s.items);
  const open = useCart((s) => s.open);
  const count = cartCount(items);
  return (
    <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-lg border-b">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-gradient-luxe flex items-center justify-center shadow-soft">
            <Sparkles className="w-5 h-5 text-primary-foreground" />
          </div>
          <span className="text-lg font-semibold tracking-tight">Veloura Essence</span>
        </Link>
        <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-muted-foreground">
          <Link to="/" hash="perfumes" className="hover:text-foreground">Perfumes</Link>
          <Link to="/" hash="combos" className="hover:text-foreground">Combos</Link>
          <Link to="/" hash="byob" className="hover:text-foreground">Build Your Box</Link>
        </nav>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={open} className="relative">
            <ShoppingBag className="w-5 h-5" />
            {count > 0 && (
              <span className="absolute -top-1 -right-1 bg-accent text-accent-foreground text-[10px] min-w-[18px] h-[18px] rounded-full flex items-center justify-center px-1 font-semibold">
                {count}
              </span>
            )}
          </Button>
          <Link to="/auth"><Button variant="outline-luxe" size="sm">Admin</Button></Link>
        </div>
      </div>
    </header>
  );
}
