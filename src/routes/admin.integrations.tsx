import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Truck, Loader2, CheckCircle2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  getSteadfastStatus,
  saveSteadfastCredentials,
  deleteSteadfastCredentials,
  testSteadfastConnection,
} from "@/lib/integrations.functions";

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
          Connect third-party services. Credentials are encrypted before being stored.
        </p>
      </div>
      <SteadfastCard />
    </div>
  );
}

function SteadfastCard() {
  const qc = useQueryClient();
  const getStatus = useServerFn(getSteadfastStatus);
  const saveFn = useServerFn(saveSteadfastCredentials);
  const deleteFn = useServerFn(deleteSteadfastCredentials);
  const testFn = useServerFn(testSteadfastConnection);

  const { data: status, isLoading } = useQuery({
    queryKey: ["integration-status", "steadfast"],
    queryFn: () => getStatus(),
  });

  const [apiKey, setApiKey] = useState("");
  const [secretKey, setSecretKey] = useState("");
  const [baseUrl, setBaseUrl] = useState("https://portal.packzy.com/api/v1");

  const save = useMutation({
    mutationFn: () => saveFn({ data: { api_key: apiKey, secret_key: secretKey, base_url: baseUrl } }),
    onSuccess: () => {
      toast.success("Steadfast credentials saved");
      setApiKey(""); setSecretKey("");
      qc.invalidateQueries({ queryKey: ["integration-status", "steadfast"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: () => deleteFn(),
    onSuccess: () => {
      toast.success("Credentials removed");
      qc.invalidateQueries({ queryKey: ["integration-status", "steadfast"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const test = useMutation({
    mutationFn: () => testFn(),
    onSuccess: (r) => toast.success(
      r.balance !== null ? `Connected — balance: ৳ ${r.balance}` : r.message
    ),
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <Truck className="w-5 h-5 text-primary" />
          </div>
          <div>
            <CardTitle className="text-lg">Steadfast Courier</CardTitle>
            <CardDescription className="mt-1">
              Automate order fulfillment and delivery tracking via Steadfast Courier API.
            </CardDescription>
          </div>
        </div>
        {isLoading ? (
          <Badge variant="secondary"><Loader2 className="w-3 h-3 mr-1 animate-spin" /> Checking</Badge>
        ) : status?.configured ? (
          <Badge className="bg-green-600 hover:bg-green-600"><CheckCircle2 className="w-3 h-3 mr-1" /> Connected</Badge>
        ) : (
          <Badge variant="secondary">Not configured</Badge>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {status?.configured && (
          <div className="text-xs text-muted-foreground">
            Last updated: {status.updated_at ? new Date(status.updated_at).toLocaleString() : "—"}
          </div>
        )}

        <div className="grid gap-3">
          <div>
            <Label htmlFor="sf-api-key">API Key</Label>
            <Input
              id="sf-api-key"
              type="password"
              autoComplete="off"
              placeholder={status?.configured ? "•••••••• (enter to replace)" : "Your Steadfast API key"}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="sf-secret-key">Secret Key</Label>
            <Input
              id="sf-secret-key"
              type="password"
              autoComplete="off"
              placeholder={status?.configured ? "•••••••• (enter to replace)" : "Your Steadfast secret key"}
              value={secretKey}
              onChange={(e) => setSecretKey(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="sf-base-url">Base URL</Label>
            <Input
              id="sf-base-url"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="https://portal.packzy.com/api/v1"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-2">
          <Button
            onClick={() => save.mutate()}
            disabled={!apiKey || !secretKey || !baseUrl || save.isPending}
          >
            {save.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Save credentials
          </Button>
          <Button
            variant="outline"
            onClick={() => test.mutate()}
            disabled={!status?.configured || test.isPending}
          >
            {test.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Test connection
          </Button>
          {status?.configured && (
            <Button
              variant="ghost"
              className="text-destructive hover:text-destructive"
              onClick={() => {
                if (confirm("Remove Steadfast credentials?")) remove.mutate();
              }}
              disabled={remove.isPending}
            >
              <Trash2 className="w-4 h-4 mr-2" /> Remove
            </Button>
          )}
        </div>

        <p className="text-xs text-muted-foreground pt-2">
          Credentials are encrypted with AES-256-GCM before being written to the database and are only decrypted server-side when calling the Steadfast API.
        </p>
      </CardContent>
    </Card>
  );
}
