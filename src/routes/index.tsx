import { createFileRoute } from "@tanstack/react-router";
import { SiteHeader } from "@/components/site-header";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Veloura Essence" },
      { name: "description", content: "Veloura Essence — coming soon." },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="flex items-center justify-center py-32 px-6 text-center">
        <div>
          <h1 className="text-4xl md:text-6xl font-semibold tracking-tight">Veloura Essence</h1>
          <p className="text-muted-foreground mt-4">Homepage coming soon.</p>
        </div>
      </main>
    </div>
  );
}
