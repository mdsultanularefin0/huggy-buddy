import { createFileRoute } from "@tanstack/react-router";
import { CmsPage } from "@/components/cms-page";

export const Route = createFileRoute("/faq")({
  head: () => ({
    meta: [
      { title: "FAQ — Veloura Essence" },
      { name: "description", content: "Frequently asked questions about Veloura Essence." },
    ],
  }),
  component: () => <CmsPage slug="faq" fallbackTitle="Frequently Asked Questions" />,
});
