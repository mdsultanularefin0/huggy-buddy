import { createFileRoute } from "@tanstack/react-router";
import { CmsPage } from "@/components/cms-page";
import { pageMeta } from "@/lib/seo-meta";

export const Route = createFileRoute("/about")({
  head: () => pageMeta({
    path: "/about",
    title: "About — Veloura Essence",
    description: "Discover the story behind Veloura Essence — luxury perfumes crafted for Bangladesh.",
  }),
  component: () => <CmsPage slug="about" fallbackTitle="About Us" />,
});
