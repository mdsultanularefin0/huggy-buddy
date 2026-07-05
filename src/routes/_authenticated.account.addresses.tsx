import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listMyAddresses, saveMyAddress, deleteMyAddress } from "@/lib/account.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Trash2, Plus, MapPin } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { BD_DISTRICTS } from "@/lib/bd-districts";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/account/addresses")({
  head: () => ({
    meta: [
      { title: "Addresses — My Account | Veloura Essence" },
      { name: "description", content: "Manage your saved delivery addresses." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AddressesPage,
});

type Address = {
  id: string;
  label: string | null;
  recipient_name: string;
  phone: string;
  district: string;
  area: string | null;
  address_line: string;
  is_default: boolean;
};

function AddressesPage() {
  const fetchList = useServerFn(listMyAddresses);
  const save = useServerFn(saveMyAddress);
  const del = useServerFn(deleteMyAddress);
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Partial<Address> | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["my-addresses"],
    queryFn: () => fetchList() as Promise<Address[]>,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["my-addresses"] });

  const saveMut = useMutation({
    mutationFn: (v: Partial<Address>) => save({ data: v as never }),
    onSuccess: () => {
      toast.success("Address saved");
      setEditing(null);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => {
      toast.success("Address removed");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold">Delivery addresses</h1>
          <p className="text-sm text-muted-foreground">Manage saved shipping addresses.</p>
        </div>
        {!editing && (
          <Button size="sm" variant="hero" onClick={() => setEditing({})}>
            <Plus className="w-4 h-4" /> Add address
          </Button>
        )}
      </div>

      {editing && (
        <form
          className="p-4 rounded-xl border bg-muted/30 space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            saveMut.mutate(editing);
          }}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label>Label (optional)</Label>
              <Input value={editing.label ?? ""} onChange={(e) => setEditing({ ...editing, label: e.target.value })} placeholder="Home, Office…" />
            </div>
            <div className="space-y-1">
              <Label>Recipient name</Label>
              <Input required value={editing.recipient_name ?? ""} onChange={(e) => setEditing({ ...editing, recipient_name: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Phone</Label>
              <Input required value={editing.phone ?? ""} onChange={(e) => setEditing({ ...editing, phone: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>District</Label>
              <Select value={editing.district ?? ""} onValueChange={(v) => setEditing({ ...editing, district: v })}>
                <SelectTrigger><SelectValue placeholder="Select district" /></SelectTrigger>
                <SelectContent>
                  {BD_DISTRICTS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label>Area / Thana (optional)</Label>
              <Input value={editing.area ?? ""} onChange={(e) => setEditing({ ...editing, area: e.target.value })} />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label>Address line</Label>
              <Input required value={editing.address_line ?? ""} onChange={(e) => setEditing({ ...editing, address_line: e.target.value })} placeholder="House, road, landmark" />
            </div>
            <label className="flex items-center gap-2 text-sm sm:col-span-2">
              <Checkbox checked={!!editing.is_default} onCheckedChange={(v) => setEditing({ ...editing, is_default: !!v })} />
              Set as default
            </label>
          </div>
          <div className="flex gap-2">
            <Button type="submit" variant="hero" disabled={saveMut.isPending}>
              {saveMut.isPending ? "Saving…" : "Save"}
            </Button>
            <Button type="button" variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
          </div>
        </form>
      )}

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : !data || data.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <MapPin className="w-10 h-10 mx-auto mb-2 opacity-50" />
          <p>No saved addresses yet.</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {data.map((a) => (
            <div key={a.id} className="p-4 rounded-xl border bg-card relative">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold text-sm flex items-center gap-2">
                    {a.label || "Address"}
                    {a.is_default && <span className="text-[10px] px-2 py-0.5 rounded bg-primary/10 text-primary">Default</span>}
                  </p>
                  <p className="text-sm">{a.recipient_name} · {a.phone}</p>
                  <p className="text-sm text-muted-foreground">{a.address_line}</p>
                  <p className="text-xs text-muted-foreground">{a.area ? `${a.area}, ` : ""}{a.district}</p>
                </div>
              </div>
              <div className="flex gap-2 mt-3">
                <Button size="sm" variant="outline" onClick={() => setEditing(a)}>Edit</Button>
                <Button size="sm" variant="ghost" className="text-destructive" onClick={() => deleteMut.mutate(a.id)}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
