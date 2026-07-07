import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Mail, Phone, MapPin, Loader2 } from "lucide-react";
import { FaFacebookF, FaInstagram, FaXTwitter, FaYoutube, FaTiktok, FaWhatsapp } from "react-icons/fa6";
import type { IconType } from "react-icons";
import { brandingQueryOptions } from "@/lib/branding-query";
import { subscribeNewsletter } from "@/lib/email.functions";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";



const SUPPORT_LINKS = [
  { label: "About", to: "/about" as const },
  { label: "Track Order", to: "/track" as const },
  { label: "FAQ", to: "/faq" as const },
  { label: "Shipping & Returns", to: "/shipping" as const },
  { label: "Contact Us", to: "/contact" as const },
  { label: "Terms & Conditions", to: "/terms" as const },
  { label: "Privacy Policy", to: "/privacy" as const },
];

export function SiteFooter(_props: {
  logoUrl?: string | null;
  logoSize?: number | null;
  logoAlign?: "left" | "center" | "right" | null;
} = {}) {
  const { data: branding } = useQuery(brandingQueryOptions);
  const footerLogo = branding?.site_logo_url ?? branding?.site_icon_url ?? null;
  const shopName = branding?.shop_name ?? "Veloura Essence";
  const tagline =
    branding?.shop_tagline ??
    "Redefining luxury fragrance in Bangladesh — crafted scents, honest pricing, and an experience worthy of every occasion.";

  const socials: { href: string | null | undefined; label: string; Icon: IconType }[] = [
    { href: branding?.social_facebook, label: "Facebook", Icon: FaFacebookF },
    { href: branding?.social_instagram, label: "Instagram", Icon: FaInstagram },
    { href: branding?.social_twitter, label: "Twitter / X", Icon: FaXTwitter },
    { href: branding?.social_youtube, label: "YouTube", Icon: FaYoutube },
    { href: branding?.social_tiktok, label: "TikTok", Icon: FaTiktok },
    { href: branding?.social_whatsapp, label: "WhatsApp", Icon: FaWhatsapp },
  ];
  const activeSocials = socials.filter((s) => !!s.href);

  return (
    <footer className="w-full bg-[#52277a] pt-16 pb-8 text-white mt-20">
      <div className="max-w-7xl mx-auto px-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10">
        <div>
          {footerLogo ? (
            <img
              src={footerLogo}
              alt={shopName}
              className="h-10 sm:h-12 md:h-14 w-auto max-w-full max-h-16 object-contain"
              loading="lazy"
            />
          ) : (
            <h3 className="text-2xl font-bold tracking-wide">{shopName}</h3>
          )}
          <p className="text-gray-300 mt-4 leading-relaxed text-sm">{tagline}</p>
          <div className="mt-5 space-y-2 text-sm text-gray-300">
            {branding?.shop_address && (
              <p className="flex items-start gap-2"><MapPin className="w-4 h-4 mt-0.5 shrink-0" /><span>{branding.shop_address}</span></p>
            )}
            {branding?.shop_phone && (
              <p className="flex items-center gap-2"><Phone className="w-4 h-4 shrink-0" /><a href={`tel:${branding.shop_phone}`} className="hover:text-white">{branding.shop_phone}</a></p>
            )}
            {branding?.shop_email && (
              <p className="flex items-center gap-2"><Mail className="w-4 h-4 shrink-0" /><a href={`mailto:${branding.shop_email}`} className="hover:text-white">{branding.shop_email}</a></p>
            )}
          </div>
        </div>
        <div>
          <h4 className="text-lg font-semibold mb-4">Shop</h4>
          <Link to="/products" className="text-gray-300 hover:text-white mb-2 block text-sm">
            All Fragrances
          </Link>
          <FooterCategoryLinks />
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
          <SubscribeForm />
        </div>
      </div>
      <div className="max-w-7xl mx-auto px-4 mt-12 pt-8 border-t border-white/20 flex flex-col md:flex-row justify-between items-center text-sm text-gray-400 gap-4">
        <p>© {new Date().getFullYear()} {shopName}. All rights reserved.</p>
        {activeSocials.length > 0 && (
          <div className="flex items-center gap-3">
            {activeSocials.map(({ href, label, Icon }) => (
              <a
                key={label}
                href={href!}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={label}
                className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
              >
                <Icon className="w-4 h-4" />
              </a>
            ))}
          </div>
        )}
      </div>
    </footer>
  );
}

function SubscribeForm() {
  const subscribe = useServerFn(subscribeNewsletter);
  const [email, setEmail] = useState("");
  const m = useMutation({
    mutationFn: (e: string) => subscribe({ data: { email: e, source: "footer" } }),
    onSuccess: (r) => {
      toast.success(r.already ? "You're already subscribed" : "Subscribed! Thank you.");
      setEmail("");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <form
      onSubmit={(e) => { e.preventDefault(); if (email) m.mutate(email); }}
      className="space-y-3"
    >
      <input
        type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
        placeholder="Your email"
        className="bg-white/10 rounded-lg py-2 px-4 w-full text-white placeholder-gray-400 focus:outline-none"
      />
      <button
        type="submit" disabled={m.isPending}
        className="bg-[#a555f0] text-white rounded-lg py-2 w-full font-semibold hover:bg-[#9442e0] transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
      >
        {m.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
        Subscribe
      </button>
    </form>
  );
}

function FooterCategoryLinks() {
  const { data } = useQuery({
    queryKey: ["public", "categories", "footer-top5"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categories")
        .select("name, slug")
        .eq("is_active", true)
        .order("sort_order", { ascending: true })
        .limit(5);
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 5 * 60_000,
  });
  return (
    <>
      {(data ?? []).map((c) => (
        <Link
          key={c.slug}
          to="/category/$slug"
          params={{ slug: c.slug }}
          className="text-gray-300 hover:text-white mb-2 block text-sm"
        >
          {c.name}
        </Link>
      ))}
    </>
  );
}
