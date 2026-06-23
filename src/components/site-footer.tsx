import { Link } from "@tanstack/react-router";
import { Sparkles, ShieldCheck, Truck, Phone, Mail, MapPin, Banknote, Wallet } from "lucide-react";

export function SiteFooter() {
  return (
    <footer className="bg-gradient-to-b from-background to-secondary/40 border-t mt-20">
      <div className="max-w-7xl mx-auto px-6 py-14 grid gap-10 md:grid-cols-2 lg:grid-cols-4">
        <div>
          <div className="flex items-center gap-2 mb-4">
            <div className="w-9 h-9 rounded-xl bg-gradient-luxe flex items-center justify-center shadow-soft">
              <Sparkles className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="text-lg font-semibold tracking-tight">Veloura Essence</span>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Curated luxury fragrances and build-your-own perfume boxes, crafted for the modern Bangladesh.
          </p>
        </div>

        <div>
          <h4 className="text-sm font-semibold mb-4">Quick Links</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li><Link to="/" className="hover:text-foreground">Home</Link></li>
            <li><Link to="/" hash="perfumes" className="hover:text-foreground">Perfumes</Link></li>
            <li><Link to="/" hash="combos" className="hover:text-foreground">Combos</Link></li>
            <li><Link to="/" hash="byob" className="hover:text-foreground">Build Your Box</Link></li>
          </ul>
        </div>

        <div>
          <h4 className="text-sm font-semibold mb-4">Customer Support</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li className="flex items-center gap-2"><Phone className="w-3.5 h-3.5" /> +880 1XXX-XXXXXX</li>
            <li className="flex items-center gap-2"><Mail className="w-3.5 h-3.5" /> hello@veloura.bd</li>
            <li className="flex items-center gap-2"><MapPin className="w-3.5 h-3.5" /> Dhaka, Bangladesh</li>
            <li className="flex items-center gap-2"><Truck className="w-3.5 h-3.5" /> Nationwide delivery</li>
          </ul>
        </div>

        <div>
          <h4 className="text-sm font-semibold mb-4 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-primary" /> Secure Payments
          </h4>
          <div className="flex flex-wrap gap-2">
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl border bg-card shadow-soft">
              <Wallet className="w-4 h-4 text-accent" />
              <span className="text-xs font-medium">bKash</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl border bg-card shadow-soft">
              <Banknote className="w-4 h-4 text-primary" />
              <span className="text-xs font-medium">Cash on Delivery</span>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-4">100% authentic · Easy returns within 7 days</p>
        </div>
      </div>
      <div className="border-t">
        <div className="max-w-7xl mx-auto px-6 py-5 flex flex-col md:flex-row gap-3 items-center justify-between text-xs text-muted-foreground">
          <p>© {new Date().getFullYear()} Veloura Essence. All rights reserved.</p>
          <Link to="/auth" className="hover:text-foreground">Admin sign in</Link>
        </div>
      </div>
    </footer>
  );
}
