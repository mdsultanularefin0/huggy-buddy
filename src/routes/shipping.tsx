import { createFileRoute } from "@tanstack/react-router";
import { CmsPage } from "@/components/cms-page";
import { pageMeta } from "@/lib/seo-meta";

export const Route = createFileRoute("/shipping")({
  head: () => pageMeta({
    path: "/shipping",
    title: "Shipping & Returns — Veloura Essence",
    description: "Delivery timelines, shipping charges, and our return policy for Veloura Essence orders.",
  }),
  component: () => <CmsPage slug="shipping" fallbackTitle="Shipping & Returns" />,
});

