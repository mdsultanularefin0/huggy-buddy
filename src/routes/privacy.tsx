import { createFileRoute } from "@tanstack/react-router";
import { CmsPage } from "@/components/cms-page";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — Veloura Essence" },
      { name: "description", content: "Learn how Veloura Essence collects, uses, and protects your information." },
    ],
  }),
  component: () => <CmsPage slug="privacy" fallbackTitle="Privacy Policy" />,
});
