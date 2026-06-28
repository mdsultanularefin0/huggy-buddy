import { createFileRoute } from "@tanstack/react-router";
import { CmsPage } from "@/components/cms-page";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms & Conditions — Veloura Essence" },
      { name: "description", content: "Read the Terms & Conditions for shopping with Veloura Essence." },
    ],
  }),
  component: () => <CmsPage slug="terms" fallbackTitle="Terms & Conditions" />,
});
