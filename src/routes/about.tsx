import { createFileRoute } from "@tanstack/react-router";
import { CmsPage } from "@/components/cms-page";
import { pageMeta } from "@/lib/seo-meta";

export const Route = createFileRoute("/about")({
  head: () => pageMeta({
    path: "/about",
    title: "Our Story & Mission | About Veloura Essence",
    description: "Learn who we are: the founders, values, and craftsmanship philosophy behind Veloura Essence, Bangladesh's boutique luxury perfume house.",
  }),
  component: () => <CmsPage slug="about" fallbackTitle="About Us" />,
});
