import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useCart, cartSubtotal, type CartItem } from "@/lib/cart-store";
import { formatBDT } from "@/lib/currency";
import { Minus, Plus, Trash2, ShoppingBag } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";

export function CartDrawer() {
  const { items, isOpen, close, setQty, remove } = useCart();
  const subtotal = cartSubtotal(items);

  const handleRemove = (item: CartItem) => {
    remove(item.lineId);
    toast.success(`Removed ${item.name}${item.size ? ` (${item.size})` : ""}`);
  };

  return (
    <Sheet open={isOpen} onOpenChange={(o) => !o && close()}>
      <SheetContent className="w-full sm:max-w-md flex flex-col">
        <SheetHeader>
          <SheetTitle>Your Cart ({items.length})</SheetTitle>
        </SheetHeader>

        {items.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
            <ShoppingBag className="w-12 h-12 text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">Your cart is empty.</p>
            <Button variant="luxe" className="mt-6" onClick={close}>Continue shopping</Button>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto py-4 space-y-3">
              {items.map((item) => (
                <div key={item.lineId} className="flex gap-3 p-3 rounded-xl border bg-card">
                  <div className="w-16 h-16 rounded-lg bg-muted overflow-hidden flex-shrink-0">
                    {item.imageUrl ? (
                      <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
                    ) : null}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{item.name}</p>
                    {item.size && <p className="text-xs text-muted-foreground">{item.size}</p>}
                    {item.selections && item.selections.length > 0 && (
                      <p className="text-xs text-muted-foreground truncate">
                        {item.selections.map((s) => s.name).join(", ")}
                      </p>
                    )}
                    <div className="flex items-center justify-between mt-2">
                      <div className="flex items-center gap-1">
                        <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => setQty(item.lineId, item.quantity - 1)}>
                          <Minus className="w-3 h-3" />
                        </Button>
                        <span className="w-6 text-center text-sm">{item.quantity}</span>
                        <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => setQty(item.lineId, item.quantity + 1)}>
                          <Plus className="w-3 h-3" />
                        </Button>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold">{formatBDT(item.unitPrice * item.quantity)}</span>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" onClick={() => remove(item.lineId)}>
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="border-t pt-4 space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-semibold text-base">{formatBDT(subtotal)}</span>
              </div>
              <p className="text-xs text-muted-foreground">Delivery calculated at checkout.</p>
              <Link to="/checkout" onClick={close}>
                <Button variant="hero" size="lg" className="w-full">Checkout</Button>
              </Link>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
