import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Mail, Phone, MapPin, Clock, Facebook, Instagram, Twitter, Youtube, Music2, MessageCircle, Loader2 } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { brandingQueryOptions } from "@/lib/branding-query";
import { sendContactMessage } from "@/lib/email.functions";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "Contact Us — Veloura Essence" },
      { name: "description", content: "Get in touch with our team — visit, call, or send a message." },
    ],
  }),
  component: ContactPage,
});

function ContactPage() {
  const { data: branding } = useQuery(brandingQueryOptions);
  const shopName = branding?.shop_name ?? "Veloura Essence";

  const socials = [
    { href: branding?.social_facebook, label: "Facebook", Icon: Facebook },
    { href: branding?.social_instagram, label: "Instagram", Icon: Instagram },
    { href: branding?.social_twitter, label: "Twitter", Icon: Twitter },
    { href: branding?.social_youtube, label: "YouTube", Icon: Youtube },
    { href: branding?.social_tiktok, label: "TikTok", Icon: Music2 },
    { href: branding?.social_whatsapp, label: "WhatsApp", Icon: MessageCircle },
  ].filter((s) => !!s.href);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <SiteHeader />
      <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-12 sm:py-16">
        <header className="text-center mb-10">
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight">Contact {shopName}</h1>
          <p className="text-muted-foreground mt-3 max-w-xl mx-auto">
            We'd love to hear from you. Reach out for orders, support, or wholesale inquiries.
          </p>
        </header>

        <div className="grid sm:grid-cols-2 gap-4">
          {branding?.shop_address && (
            <InfoCard Icon={MapPin} title="Visit us">
              <p className="whitespace-pre-line">{branding.shop_address}</p>
            </InfoCard>
          )}
          {branding?.shop_phone && (
            <InfoCard Icon={Phone} title="Call us">
              <a href={`tel:${branding.shop_phone}`} className="hover:underline">{branding.shop_phone}</a>
            </InfoCard>
          )}
          {branding?.shop_email && (
            <InfoCard Icon={Mail} title="Email us">
              <a href={`mailto:${branding.shop_email}`} className="hover:underline break-all">{branding.shop_email}</a>
            </InfoCard>
          )}
          {branding?.shop_hours && (
            <InfoCard Icon={Clock} title="Hours">
              <p className="whitespace-pre-line">{branding.shop_hours}</p>
            </InfoCard>
          )}
        </div>

        {socials.length > 0 && (
          <section className="mt-12 text-center">
            <h2 className="text-xl font-semibold mb-4">Follow us</h2>
            <div className="flex justify-center gap-3 flex-wrap">
              {socials.map(({ href, label, Icon }) => (
                <a
                  key={label}
                  href={href!}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={label}
                  className="w-11 h-11 rounded-full bg-primary/10 hover:bg-primary hover:text-primary-foreground text-primary flex items-center justify-center transition-colors"
                >
                  <Icon className="w-5 h-5" />
                </a>
              ))}
            </div>
          </section>
        )}

        {!branding?.shop_address && !branding?.shop_phone && !branding?.shop_email && !branding?.shop_hours && (
          <p className="text-center text-muted-foreground mt-10">Contact details coming soon.</p>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}

function InfoCard({ Icon, title, children }: { Icon: typeof Mail; title: string; children: React.ReactNode }) {
  return (
    <Card className="p-6 flex gap-4 items-start shadow-card">
      <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <h3 className="font-semibold">{title}</h3>
        <div className="text-sm text-muted-foreground mt-1">{children}</div>
      </div>
    </Card>
  );
}
