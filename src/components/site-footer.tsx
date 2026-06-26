import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { brandingQueryOptions } from "@/lib/branding-query";

const SHOP_LINKS = [
  { label: "Female Scent", slug: "female-fragrance" },
  { label: "Male Scent", slug: "male-fragrance" },
  { label: "Combo Pack", slug: "combo-packs" },
  { label: "Customize Combo", slug: "custom-combo" },
] as const;

const SUPPORT_LINKS = [
  { label: "All Fragrances", to: "/products" as const },
  { label: "Terms & Conditions", to: "/terms" as const },
  { label: "Privacy Policy", to: "/privacy" as const },
  { label: "Admin Sign In", to: "/auth" as const },
];

export function SiteFooter(_props: {
  logoUrl?: string | null;
  logoSize?: number | null;
  logoAlign?: "left" | "center" | "right" | null;
} = {}) {
  const { data: branding } = useQuery(brandingQueryOptions);
  const footerLogo = branding?.site_logo_url ?? branding?.site_icon_url ?? null;

  return (
    <footer className="w-full bg-[#52277a] pt-16 pb-8 text-white mt-20">
      <div className="max-w-7xl mx-auto px-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10">
        <div>
          {footerLogo ? (
            <img
              src={footerLogo}
              alt="Veloura Essence"
              className="h-10 sm:h-12 md:h-14 w-auto max-w-full max-h-16 object-contain"
              loading="lazy"
            />
          ) : (
            <h3 className="text-2xl font-bold tracking-wide">Veloura Essence</h3>
          )}
          <p className="text-gray-300 mt-4 leading-relaxed text-sm">
            Redefining luxury fragrance in Bangladesh — crafted scents, honest
            pricing, and an experience worthy of every occasion.
          </p>
        </div>
        <div>
          <h4 className="text-lg font-semibold mb-4">Shop</h4>
          {SHOP_LINKS.map((l) => (
            <Link
              key={l.slug}
              to="/category/$slug"
              params={{ slug: l.slug }}
              className="text-gray-300 hover:text-white mb-2 block text-sm"
            >
              {l.label}
            </Link>
          ))}
        </div>
        <div>
          <h4 className="text-lg font-semibold mb-4">Support</h4>
          {SUPPORT_LINKS.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              className="text-gray-300 hover:text-white mb-2 block text-sm"
            >
              {l.label}
            </Link>
          ))}
        </div>
        <div>
          <h4 className="text-lg font-semibold mb-4">Stay Updated</h4>
          <p className="text-gray-300 text-sm mb-3">
            Get early access to drops and member-only offers.
          </p>
          <input
            type="email"
            placeholder="Your email"
            className="bg-white/10 rounded-lg py-2 px-4 w-full text-white placeholder-gray-400 focus:outline-none"
          />
          <button className="bg-[#a555f0] text-white rounded-lg py-2 w-full mt-3 font-semibold hover:bg-[#9442e0] transition-colors">
            Subscribe
          </button>
        </div>
      </div>
      <div className="max-w-7xl mx-auto px-4 mt-12 pt-8 border-t border-white/20 flex flex-col md:flex-row justify-between items-center text-sm text-gray-400 gap-4">
        <p>© {new Date().getFullYear()} Veloura Essence. All rights reserved.</p>
        <div className="flex items-center gap-4">
          {["F", "I", "T", "Y"].map((s) => (
            <a
              key={s}
              href="#"
              aria-label={`Social ${s}`}
              className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white text-sm font-semibold transition-colors"
            >
              {s}
            </a>
          ))}
        </div>
      </div>
    </footer>
  );
}
