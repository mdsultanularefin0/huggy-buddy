import { createFileRoute } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";

export const Route = createFileRoute("/admin/products")({ component: () => <Placeholder title="Products" /> });

function Placeholder({ title }: { title: string }) {
  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
      <p className="text-muted-foreground mt-1">Coming in Phase 2.</p>
      <Card className="mt-8 p-12 text-center border-dashed border-2 bg-card/50">
        <p className="text-sm text-muted-foreground">This section will be built in the next phase.</p>
      </Card>
    </div>
  );
}
