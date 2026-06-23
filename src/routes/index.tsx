import { createFileRoute, Link } from "@tanstack/react-router";
import { Sparkles, ShieldCheck, Truck, Gift } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Veloura Essence — Luxury Perfumes in Bangladesh" },
      { name: "description", content: "Curated luxury fragrances, dual combo deals, and build-your-own perfume boxes. Delivered across Bangladesh." },
      { property: "og:title", content: "Veloura Essence — Luxury Perfumes" },
      { property: "og:description", content: "Premium fragrances delivered across Bangladesh." },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      {/* Top marquee */}
      <div className="bg-primary text-primary-foreground py-2 overflow-hidden">
        <div className="marquee-track text-sm font-medium tracking-wide">
          <span className="px-8">✦ Free delivery on orders over ৳400</span>
          <span className="px-8">✦ Flash sale ends soon</span>
          <span className="px-8">✦ Crafted in Bangladesh, inspired by the world</span>
          <span className="px-8">✦ Free delivery on orders over ৳400</span>
          <span className="px-8">✦ Flash sale ends soon</span>
          <span className="px-8">✦ Crafted in Bangladesh, inspired by the world</span>
        </div>
      </div>

      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-lg border-b">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-gradient-luxe flex items-center justify-center shadow-soft">
              <Sparkles className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="text-lg font-semibold tracking-tight">Veloura Essence</span>
          </Link>
          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-muted-foreground">
            <a href="#perfumes" className="hover:text-foreground transition-colors">Perfumes</a>
            <a href="#combos" className="hover:text-foreground transition-colors">Combos</a>
            <a href="#byob" className="hover:text-foreground transition-colors">Build Your Box</a>
          </nav>
          <Link to="/auth"><Button variant="outline-luxe" size="sm">Admin</Button></Link>
        </div>
      </header>

      {/* Hero */}
      <section className="bg-gradient-soft">
        <div className="max-w-7xl mx-auto px-6 py-20 grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent/10 text-accent text-xs font-semibold mb-6">
              <Sparkles className="w-3.5 h-3.5" /> New season collection
            </div>
            <h1 className="text-5xl lg:text-6xl font-semibold tracking-tight leading-[1.05]">
              Fragrance, <br />
              <span className="text-gradient-luxe">crafted with care.</span>
            </h1>
            <p className="text-lg text-muted-foreground mt-6 max-w-md">
              Discover signature scents, curated combos, and build-your-own perfume boxes — delivered fresh across Bangladesh.
            </p>
            <div className="flex flex-wrap gap-3 mt-8">
              <Button variant="hero" size="xl">Shop the collection</Button>
              <Button variant="outline-luxe" size="xl">Build your box</Button>
            </div>
            <div className="grid grid-cols-3 gap-4 mt-12 max-w-md">
              <Feature icon={<Truck className="w-4 h-4" />} label="Fast delivery" />
              <Feature icon={<ShieldCheck className="w-4 h-4" />} label="100% authentic" />
              <Feature icon={<Gift className="w-4 h-4" />} label="Combos & gifts" />
            </div>
          </div>

          <div className="relative aspect-[4/5] rounded-3xl bg-gradient-luxe shadow-luxe overflow-hidden">
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center text-primary-foreground/90 px-8">
                <Sparkles className="w-12 h-12 mx-auto mb-4" />
                <p className="text-sm uppercase tracking-widest opacity-80">Featured</p>
                <p className="text-2xl font-semibold mt-2">Coming soon</p>
                <p className="text-sm opacity-80 mt-2">Add products in the admin panel to populate the storefront.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Catalog placeholders */}
      <section id="perfumes" className="max-w-7xl mx-auto px-6 py-20">
        <SectionHeader eyebrow="Signature" title="Individual Perfumes" />
        <EmptyState text="Products will appear here once added in the admin panel." />
      </section>

      <section id="combos" className="bg-gradient-soft">
        <div className="max-w-7xl mx-auto px-6 py-20">
          <SectionHeader eyebrow="Curated" title="Pre-Built Combos" />
          <EmptyState text="Combos will appear here once added in the admin panel." />
        </div>
      </section>

      <section id="byob" className="max-w-7xl mx-auto px-6 py-20">
        <SectionHeader eyebrow="Personal" title="Build Your Own Box" />
        <EmptyState text="BYOB boxes will appear here once added in the admin panel." />
      </section>

      <footer className="border-t bg-card">
        <div className="max-w-7xl mx-auto px-6 py-10 flex flex-col md:flex-row gap-4 items-center justify-between">
          <p className="text-sm text-muted-foreground">© Veloura Essence. All rights reserved.</p>
          <Link to="/auth" className="text-sm text-muted-foreground hover:text-foreground">Admin sign in</Link>
        </div>
      </footer>
    </div>
  );
}

function Feature({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex flex-col items-start gap-2">
      <div className="w-8 h-8 rounded-lg bg-card border flex items-center justify-center text-primary shadow-soft">
        {icon}
      </div>
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
    </div>
  );
}

function SectionHeader({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div className="mb-10">
      <p className="text-xs uppercase tracking-[0.2em] text-accent font-semibold">{eyebrow}</p>
      <h2 className="text-3xl md:text-4xl font-semibold tracking-tight mt-2">{title}</h2>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-3xl border-2 border-dashed border-border bg-card/50 py-20 text-center">
      <Sparkles className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
      <p className="text-sm text-muted-foreground max-w-md mx-auto">{text}</p>
    </div>
  );
}
