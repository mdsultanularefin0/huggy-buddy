import { createFileRoute } from "@tanstack/react-router";

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
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center px-6">
        <h1 className="text-4xl md:text-6xl font-semibold tracking-tight">Veloura Essence</h1>
        <p className="text-muted-foreground mt-4">Homepage coming soon.</p>
      </div>
    </div>
  );
}
