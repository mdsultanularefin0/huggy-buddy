import { createFileRoute } from "@tanstack/react-router";
import { SiteHeader } from "@/components/site-header";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Veloura Essence" },
      { name: "description", content: "Veloura Essence — premium fragrances." },
    ],
  }),
  component: Landing,
});

const categories = [
  "Summer Combo",
  "Girl's Secret",
  "Student Budget",
  "Gift Ready",
];

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="px-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 w-full max-w-7xl mx-auto py-8">
          {/* Left: reserved placeholder */}
          <div className="relative w-full h-[400px] lg:h-[500px]" />

          {/* Right: 4 category cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 w-full h-full content-end">
            {categories.map((label) => (
              <div
                key={label}
                className="relative w-full aspect-[3/4] rounded-2xl overflow-hidden shadow-lg bg-gray-200 bg-cover bg-center"
              >
                <div className="absolute bottom-0 left-0 w-full bg-[#52277a] py-2 px-1 text-center text-white text-sm md:text-base font-semibold">
                  {label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
