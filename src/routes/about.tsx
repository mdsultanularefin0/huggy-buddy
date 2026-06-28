import { createFileRoute } from "@tanstack/react-router";
import { CmsPage } from "@/components/cms-page";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About — Veloura Essence" },
      { name: "description", content: "Discover the story behind Veloura Essence." },
    ],
  }),
  component: () => <CmsPage slug="about" fallbackTitle="About Us" />,
});
