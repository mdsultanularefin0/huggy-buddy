import { createFileRoute } from "@tanstack/react-router";
import { CmsPage } from "@/components/cms-page";

export const Route = createFileRoute("/shipping")({
  head: () => ({
    meta: [
      { title: "Shipping & Returns — Veloura Essence" },
      { name: "description", content: "Shipping timelines, charges, and return policy." },
    ],
  }),
  component: () => <CmsPage slug="shipping" fallbackTitle="Shipping & Returns" />,
});
