import { createFileRoute } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";

export const Route = createFileRoute("/admin/combos")({ component: Page });

function Page() {
  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-3xl font-semibold tracking-tight capitalize">combos</h1>
      <p className="text-muted-foreground mt-1">Coming in a later phase.</p>
      <Card className="mt-8 p-12 text-center border-dashed border-2 bg-card/50">
        <p className="text-sm text-muted-foreground">This section will be built next.</p>
      </Card>
    </div>
  );
}
