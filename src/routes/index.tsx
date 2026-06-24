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
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 w-full max-w-7xl mx-auto py-8 items-stretch">
          {/* Left: reserved placeholder for hero image */}
          <div className="relative w-full aspect-[16/10] lg:aspect-auto lg:h-full min-h-[260px] rounded-2xl overflow-hidden bg-gradient-to-br from-purple-100 to-purple-50" />

          {/* Right: 4 category cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 w-full">
            {categories.map((label) => (
              <div
                key={label}
                className="relative w-full aspect-square rounded-2xl overflow-hidden shadow-lg bg-gradient-to-br from-purple-200 to-purple-100 bg-cover bg-center"
              >
                <div className="absolute bottom-0 left-0 w-full bg-[#52277a]/70 backdrop-blur-sm py-3 px-2 text-center text-white text-base md:text-lg font-medium tracking-wide">
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
