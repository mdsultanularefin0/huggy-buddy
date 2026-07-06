import { createFileRoute } from "@tanstack/react-router";
import { CmsPage } from "@/components/cms-page";
import { pageMeta } from "@/lib/seo-meta";

export const Route = createFileRoute("/privacy")({
  head: () => pageMeta({
    path: "/privacy",
    title: "Privacy Policy — Veloura Essence",
    description: "How Veloura Essence collects, uses, and protects your personal information.",
  }),
  component: () => <CmsPage slug="privacy" fallbackTitle="Privacy Policy" />,
});

