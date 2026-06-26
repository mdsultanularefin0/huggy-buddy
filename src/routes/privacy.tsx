import { createFileRoute } from "@tanstack/react-router";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — Veloura Essence" },
      { name: "description", content: "Learn how Veloura Essence collects, uses, and protects your information." },
    ],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <div className="min-h-screen bg-white">
      <SiteHeader />
      <main className="max-w-3xl mx-auto py-16 px-4">
        <h1 className="text-3xl md:text-4xl font-semibold text-center text-[#52277a] mb-10">Privacy Policy</h1>
        <div className="space-y-8 text-gray-700 leading-relaxed">
          <section>
            <h2 className="text-xl font-semibold text-[#52277a] mb-3">1. Information We Collect</h2>
            <p>We collect information you provide when placing an order or contacting support, including:</p>
            <ul className="list-disc list-inside mt-3 space-y-1">
              <li>Name, phone number, and delivery address</li>
              <li>Email address (optional)</li>
              <li>Order history and payment preferences</li>
            </ul>
          </section>
          <section>
            <h2 className="text-xl font-semibold text-[#52277a] mb-3">2. How We Use Your Information</h2>
            <p>
              Your information is used to process orders, coordinate delivery, provide customer support, and
              improve our products and services.
            </p>
          </section>
          <section>
            <h2 className="text-xl font-semibold text-[#52277a] mb-3">3. Sharing &amp; Disclosure</h2>
            <p>
              We never sell your personal information. Limited information is shared with delivery partners
              and payment processors strictly to fulfill your order.
            </p>
          </section>
          <section>
            <h2 className="text-xl font-semibold text-[#52277a] mb-3">4. Data Security</h2>
            <p>
              We use industry-standard safeguards to protect your information. No method of transmission over
              the internet is 100% secure, but we take security seriously.
            </p>
          </section>
          <section>
            <h2 className="text-xl font-semibold text-[#52277a] mb-3">5. Your Rights</h2>
            <p>
              You may request access to, correction of, or deletion of your personal data at any time by
              contacting us.
            </p>
          </section>
          <section>
            <h2 className="text-xl font-semibold text-[#52277a] mb-3">6. Contact</h2>
            <p>For privacy-related questions, reach us via the contact details in our footer.</p>
          </section>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
