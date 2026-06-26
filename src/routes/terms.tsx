import { createFileRoute } from "@tanstack/react-router";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms & Conditions — Veloura Essence" },
      { name: "description", content: "Read the Terms & Conditions for shopping with Veloura Essence." },
    ],
  }),
  component: TermsPage,
});

function TermsPage() {
  return (
    <div className="min-h-screen bg-white">
      <SiteHeader />
      <main className="max-w-3xl mx-auto py-16 px-4">
        <h1 className="text-3xl md:text-4xl font-semibold text-center text-[#52277a] mb-10">
          Terms &amp; Conditions
        </h1>
        <div className="space-y-8 text-gray-700 leading-relaxed">
          <section>
            <h2 className="text-xl font-semibold text-[#52277a] mb-3">1. Acceptance of Terms</h2>
            <p>
              By accessing or shopping at Veloura Essence, you agree to be bound by these Terms &amp; Conditions
              and our Privacy Policy.
            </p>
          </section>
          <section>
            <h2 className="text-xl font-semibold text-[#52277a] mb-3">2. Orders &amp; Payment</h2>
            <p>
              All orders are subject to product availability and confirmation of payment. We accept Cash on
              Delivery and supported digital payment methods at checkout.
            </p>
            <ul className="list-disc list-inside mt-3 space-y-1">
              <li>Prices are listed in Bangladeshi Taka (৳).</li>
              <li>We reserve the right to refuse or cancel any order.</li>
              <li>Promotional codes cannot be combined unless specified.</li>
            </ul>
          </section>
          <section>
            <h2 className="text-xl font-semibold text-[#52277a] mb-3">3. Shipping &amp; Delivery</h2>
            <p>
              We deliver nationwide across Bangladesh. Estimated delivery is 2–4 business days. Free shipping
              on orders above ৳999.
            </p>
          </section>
          <section>
            <h2 className="text-xl font-semibold text-[#52277a] mb-3">4. Returns &amp; Exchanges</h2>
            <p>
              Unopened products can be returned or exchanged within 7 days of delivery. Opened fragrances are
              not eligible for return for hygiene reasons.
            </p>
          </section>
          <section>
            <h2 className="text-xl font-semibold text-[#52277a] mb-3">5. Intellectual Property</h2>
            <p>
              All content on this site — including product names, imagery, and branding — is the property of
              Veloura Essence and may not be reproduced without permission.
            </p>
          </section>
          <section>
            <h2 className="text-xl font-semibold text-[#52277a] mb-3">6. Contact</h2>
            <p>For questions about these terms, reach us via the contact details on our footer.</p>
          </section>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
