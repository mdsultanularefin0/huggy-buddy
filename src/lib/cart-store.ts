import { create } from "zustand";
import { persist } from "zustand/middleware";

export type CartItem = {
  /** unique line id (e.g. product:uuid:size:3.5ml or combo:uuid or byob:uuid:hash) */
  lineId: string;
  kind: "product" | "combo" | "byob";
  refId: string; // product or combo id
  name: string;
  imageUrl?: string | null;
  unitPrice: number;
  regularPrice: number;
  quantity: number;
  size?: string | null;
  /** For BYOB combos: the chosen product ids the customer picked. */
  selections?: { productId: string; name: string }[];
};

type CartState = {
  items: CartItem[];
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
  add: (item: CartItem) => void;
  remove: (lineId: string) => void;
  setQty: (lineId: string, qty: number) => void;
  clear: () => void;
};

export const useCart = create<CartState>()(
  persist(
    (set) => ({
      items: [],
      isOpen: false,
      open: () => set({ isOpen: true }),
      close: () => set({ isOpen: false }),
      toggle: () => set((s) => ({ isOpen: !s.isOpen })),
      add: (item) =>
        set((s) => {
          const existing = s.items.find((i) => i.lineId === item.lineId);
          if (existing) {
            return {
              items: s.items.map((i) =>
                i.lineId === item.lineId ? { ...i, quantity: i.quantity + item.quantity } : i,
              ),
              isOpen: true,
            };
          }
          return { items: [...s.items, item], isOpen: true };
        }),
      remove: (lineId) => set((s) => ({ items: s.items.filter((i) => i.lineId !== lineId) })),
      setQty: (lineId, qty) =>
        set((s) => ({
          items: s.items
            .map((i) => (i.lineId === lineId ? { ...i, quantity: Math.max(1, qty) } : i))
            .filter((i) => i.quantity > 0),
        })),
      clear: () => set({ items: [] }),
    }),
    { name: "veloura-cart" },
  ),
);

export const cartSubtotal = (items: CartItem[]) =>
  items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);

export const cartCount = (items: CartItem[]) =>
  items.reduce((n, i) => n + i.quantity, 0);
