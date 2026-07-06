import { createFileRoute } from "@tanstack/react-router";
import { CmsPage } from "@/components/cms-page";
import { pageMeta } from "@/lib/seo-meta";

export const Route = createFileRoute("/terms")({
  head: () => pageMeta({
    path: "/terms",
    title: "Terms & Conditions — Veloura Essence",
    description: "The terms that apply when you shop with Veloura Essence.",
  }),
  component: () => <CmsPage slug="terms" fallbackTitle="Terms & Conditions" />,
});

