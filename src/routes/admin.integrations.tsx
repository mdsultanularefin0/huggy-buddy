import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Truck } from "lucide-react";

export const Route = createFileRoute("/admin/integrations")({
  head: () => ({ meta: [{ title: "Integrations — Admin" }, { name: "robots", content: "noindex" }] }),
  component: AdminIntegrations,
});

function AdminIntegrations() {
  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-semibold">Integrations</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Connect third-party services to power shipping, payments, and more.
        </p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Truck className="w-5 h-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">Steadfast Courier</CardTitle>
              <CardDescription className="mt-1">
                Automate order fulfillment and delivery tracking with Steadfast Courier API.
              </CardDescription>
            </div>
          </div>
          <Badge variant="secondary">Coming soon</Badge>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Configuration options (API key, secret, base URL, and auto-push settings) will be added here.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
