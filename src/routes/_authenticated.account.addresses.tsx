import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listMyAddresses, saveMyAddress, deleteMyAddress } from "@/lib/account.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Trash2, Plus, MapPin, Star, Pencil } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { BD_DISTRICTS } from "@/lib/bd-districts";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { normalizeBdPhone } from "@/lib/phone";

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

const addressSchema = z.object({
  id: z.string().uuid().optional(),
  label: z.string().trim().max(40).optional(),
  recipient_name: z.string().trim().min(1, "Required").max(100),
  phone: z.string().trim().min(6, "Enter a valid phone").max(20),
  district: z.string().trim().min(1, "Select a district").max(80),
  area: z.string().trim().max(120).optional(),
  address_line: z.string().trim().min(5, "Address is too short").max(500),
  is_default: z.boolean().optional(),
});
type AddressValues = z.infer<typeof addressSchema>;

const emptyValues: AddressValues = {
  label: "",
  recipient_name: "",
  phone: "",
  district: "",
  area: "",
  address_line: "",
  is_default: false,
};

function AddressesPage() {
  const fetchList = useServerFn(listMyAddresses);
  const save = useServerFn(saveMyAddress);
  const del = useServerFn(deleteMyAddress);
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["my-addresses"],
    queryFn: () => fetchList() as Promise<Address[]>,
  });

  const form = useForm<AddressValues>({
    resolver: zodResolver(addressSchema),
    defaultValues: emptyValues,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["my-addresses"] });

  const saveMut = useMutation({
    mutationFn: (v: AddressValues) => save({ data: v }),
    onSuccess: () => {
      toast.success("Address saved");
      setDialogOpen(false);
      setEditingId(null);
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

  function openAdd() {
    setEditingId(null);
    form.reset(emptyValues);
    setDialogOpen(true);
  }

  function openEdit(a: Address) {
    setEditingId(a.id);
    form.reset({
      id: a.id,
      label: a.label ?? "",
      recipient_name: a.recipient_name,
      phone: a.phone,
      district: a.district,
      area: a.area ?? "",
      address_line: a.address_line,
      is_default: a.is_default,
    });
    setDialogOpen(true);
  }

  useEffect(() => {
    if (!dialogOpen) form.reset(emptyValues);
  }, [dialogOpen, form]);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold">Delivery addresses</h1>
          <p className="text-sm text-muted-foreground">Manage saved shipping addresses.</p>
        </div>
        <Button size="sm" variant="hero" onClick={openAdd}>
          <Plus className="w-4 h-4" /> Add address
        </Button>
      </div>

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
            <Card
              key={a.id}
              className={`relative transition ${a.is_default ? "border-primary ring-1 ring-primary/30 bg-primary/5" : ""}`}
            >
              <CardContent className="p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-semibold text-sm flex items-center gap-2">
                    {a.label || "Address"}
                    {a.is_default && (
                      <Badge className="gap-1 bg-primary text-primary-foreground">
                        <Star className="w-3 h-3" /> Default
                      </Badge>
                    )}
                  </p>
                </div>
                <p className="text-sm">{a.recipient_name} · {a.phone}</p>
                <p className="text-sm text-muted-foreground">{a.address_line}</p>
                <p className="text-xs text-muted-foreground">{a.area ? `${a.area}, ` : ""}{a.district}</p>
                <div className="flex gap-2 pt-2">
                  <Button size="sm" variant="outline" onClick={() => openEdit(a)}>
                    <Pencil className="w-3.5 h-3.5 mr-1" /> Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive"
                    onClick={() => deleteMut.mutate(a.id)}
                    disabled={deleteMut.isPending}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit address" : "Add new address"}</DialogTitle>
            <DialogDescription>
              Delivery details used for your Veloura Essence orders.
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form
              id="address-form"
              onSubmit={form.handleSubmit((v) => saveMut.mutate(v))}
              className="grid gap-3 sm:grid-cols-2"
            >
              <FormField
                control={form.control}
                name="label"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Label (optional)</FormLabel>
                    <FormControl><Input placeholder="Home, Office…" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="recipient_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Recipient name</FormLabel>
                    <FormControl><Input {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="tel"
                        inputMode="numeric"
                        autoComplete="tel"
                        maxLength={16}
                        placeholder="01XXXXXXXXX"
                        onChange={(e) => field.onChange(normalizeBdPhone(e.target.value))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="district"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>District</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger><SelectValue placeholder="Select district" /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {BD_DISTRICTS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="area"
                render={({ field }) => (
                  <FormItem className="sm:col-span-2">
                    <FormLabel>Area / Thana (optional)</FormLabel>
                    <FormControl><Input {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="address_line"
                render={({ field }) => (
                  <FormItem className="sm:col-span-2">
                    <FormLabel>Address line</FormLabel>
                    <FormControl><Input placeholder="House, road, landmark" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="is_default"
                render={({ field }) => (
                  <FormItem className="sm:col-span-2 flex flex-row items-center gap-2 space-y-0">
                    <FormControl>
                      <Checkbox checked={!!field.value} onCheckedChange={(v) => field.onChange(!!v)} />
                    </FormControl>
                    <FormLabel className="!mt-0">Set as default address</FormLabel>
                  </FormItem>
                )}
              />
            </form>
          </Form>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button type="submit" form="address-form" variant="hero" disabled={saveMut.isPending}>
              {saveMut.isPending ? "Saving…" : editingId ? "Save changes" : "Add address"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
