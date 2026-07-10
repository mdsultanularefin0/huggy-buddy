import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { pageMeta } from "@/lib/seo-meta";

type Faq = { q: string; a: string };

export const Route = createFileRoute("/faq")({
  head: () => pageMeta({
    path: "/faq",
    title: "Frequently Asked Questions | Veloura Essence Help Centre",
    description: "Answers about payments, cash on delivery, shipping times, returns, authenticity and how to choose the right Veloura Essence perfume.",
  }),
  component: FaqPage,
});


function FaqPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["site_settings", "faqs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("site_settings")
        .select("faqs_title, faqs_json")
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const title = (data?.faqs_title as string) || "Frequently Asked Questions";
  const faqs = ((data?.faqs_json as Faq[] | null) ?? []) as Faq[];

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <SiteHeader />
      <main className="flex-1 w-full py-10 sm:py-16 bg-gray-50">
        <div className="max-w-3xl mx-auto px-4">
          <div className="text-center mb-10">
            <h1 className="text-3xl font-bold text-gray-900 inline-block pb-2 border-b-2 border-[#a555f0]">
              {title}
            </h1>
          </div>
          {isLoading ? (
            <p className="text-center text-gray-400">Loading…</p>
          ) : faqs.length === 0 ? (
            <p className="text-center text-gray-500">No FAQs published yet.</p>
          ) : (
            <Accordion type="single" collapsible className="w-full">
              {faqs.map((f, i) => (
                <AccordionItem key={`${f.q}-${i}`} value={`faq-${i}`} className="border-b border-gray-200">
                  <AccordionTrigger className="text-left text-gray-900 font-semibold hover:text-[#52277a]">
                    {f.q}
                  </AccordionTrigger>
                  <AccordionContent className="text-gray-600 leading-relaxed">
                    {f.a}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          )}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
