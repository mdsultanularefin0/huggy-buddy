import { formatBDT } from "@/lib/currency";

type Item = {
  name?: string;
  qty?: number;
  quantity?: number;
  price?: number;
  unitPrice?: number;
  size?: string | null;
  image?: string | null;
  imageUrl?: string | null;
  selections?: { productId?: string; name?: string }[] | null;
};

type Customer = {
  name?: string;
  phone?: string;
  email?: string;
  address?: string;
  area?: string;
  district?: string;
};

export type InvoiceOrder = {
  id: string;
  order_number: string;
  created_at: string;
  total: number;
  subtotal: number;
  shipping_fee: number;
  discount: number;
  payment_method: string;
  payment_details?: { senderNumber?: string; trxId?: string } | null;
  payment_status: string;
  order_status: string;
  tracking_code?: string | null;
  referral_used?: string | null;
  customer_json: Customer | null;
  items_json: Item[] | null;
};

export type InvoiceBranding = {
  shop_name?: string | null;
  shop_tagline?: string | null;
  shop_email?: string | null;
  shop_phone?: string | null;
  shop_address?: string | null;
  site_logo_url?: string | null;
} | null;

export function InvoiceDocument({
  order,
  branding,
}: {
  order: InvoiceOrder;
  branding: InvoiceBranding;
}) {
  const items = (order.items_json ?? []).map((it) => ({
    name: it.name ?? "",
    qty: it.qty ?? it.quantity ?? 1,
    price: it.price ?? it.unitPrice ?? 0,
    size: it.size ?? null,
    image: it.image ?? it.imageUrl ?? null,
    selections: Array.isArray(it.selections) ? it.selections : null,
  }));
  const c = order.customer_json ?? {};
  const shopName = branding?.shop_name ?? "Invoice";

  return (
    <div
      id="invoice-document"
      className="bg-white text-black mx-auto p-10 shadow print:shadow-none"
      style={{ width: "210mm", minHeight: "297mm", boxSizing: "border-box", fontFamily: "system-ui, sans-serif", borderColor: "#e5e7eb" }}
    >

      {/* Header */}
      <div className="flex items-start justify-between gap-6 pb-6" style={{ borderBottom: "1px solid #e5e7eb" }}>
        <div className="flex items-start gap-4">
          {branding?.site_logo_url && (
            <img src={branding.site_logo_url} alt={shopName} style={{ height: 56, width: "auto", objectFit: "contain" }} />
          )}
          <div>
            <div className="text-xl font-semibold">{shopName}</div>
            {branding?.shop_tagline && <div className="text-xs" style={{ color: "#6b7280" }}>{branding.shop_tagline}</div>}
            {branding?.shop_address && <div className="text-xs mt-1 whitespace-pre-line" style={{ color: "#4b5563" }}>{branding.shop_address}</div>}
            <div className="text-xs" style={{ color: "#4b5563" }}>
              {branding?.shop_phone && <span>{branding.shop_phone}</span>}
              {branding?.shop_phone && branding?.shop_email && <span> · </span>}
              {branding?.shop_email && <span>{branding.shop_email}</span>}
            </div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold tracking-wide">INVOICE</div>
          <div className="text-sm font-mono mt-1">{order.order_number}</div>
          <div className="text-xs mt-1" style={{ color: "#4b5563" }}>
            {new Date(order.created_at).toLocaleDateString()}
          </div>
          <div className="text-xs mt-2">
            <span className="inline-block px-2 py-0.5 rounded" style={{ background: "#f3f4f6", border: "1px solid #e5e7eb" }}>Payment: {order.payment_status}</span>
          </div>

        </div>
      </div>


      {/* Bill to */}
      <div className="grid grid-cols-2 gap-6 mt-6 text-sm">
        <div>
          <div className="text-xs uppercase tracking-wider text-gray-500 mb-1">Bill to</div>
          <div className="font-medium">{c.name ?? "—"}</div>
          {c.phone && <div className="text-gray-700">{c.phone}</div>}
          {c.email && <div className="text-gray-700">{c.email}</div>}
        </div>
        <div>
          <div className="text-xs uppercase tracking-wider text-gray-500 mb-1">Ship to</div>
          {c.address && <div className="text-gray-700 whitespace-pre-line">{c.address}</div>}
          {(c.area || c.district) && (
            <div className="text-gray-700">{[c.area, c.district].filter(Boolean).join(", ")}</div>
          )}
          {!c.address && !c.area && !c.district && <div className="text-gray-500">—</div>}
        </div>
      </div>

      {/* Items */}
      <table className="w-full mt-8 text-sm" style={{ borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th className="text-left p-2 font-medium" style={{ background: "#f9fafb", borderTop: "1px solid #e5e7eb", borderBottom: "1px solid #e5e7eb" }}>Item</th>
            <th className="text-right p-2 font-medium w-16" style={{ background: "#f9fafb", borderTop: "1px solid #e5e7eb", borderBottom: "1px solid #e5e7eb" }}>Qty</th>
            <th className="text-right p-2 font-medium w-28" style={{ background: "#f9fafb", borderTop: "1px solid #e5e7eb", borderBottom: "1px solid #e5e7eb" }}>Unit</th>
            <th className="text-right p-2 font-medium w-28" style={{ background: "#f9fafb", borderTop: "1px solid #e5e7eb", borderBottom: "1px solid #e5e7eb" }}>Total</th>
          </tr>
        </thead>
        <tbody>
          {items.map((it, i) => (
            <tr key={i} className="align-top pdf-keep" style={{ pageBreakInside: "avoid", breakInside: "avoid" }}>
              <td className="p-2" style={{ borderBottom: "1px solid #e5e7eb" }}>
                <div className="font-medium">{it.name}</div>
                {it.size && <div className="text-xs" style={{ color: "#6b7280" }}>{it.size}</div>}
                {it.selections && it.selections.length > 0 && (
                  <ul className="mt-1 ml-3 text-xs list-disc list-inside" style={{ color: "#4b5563" }}>
                    {it.selections.map((s, si) => (
                      <li key={si}>{s.name}</li>
                    ))}
                  </ul>
                )}
              </td>
              <td className="p-2 text-right" style={{ borderBottom: "1px solid #e5e7eb" }}>{it.qty}</td>
              <td className="p-2 text-right" style={{ borderBottom: "1px solid #e5e7eb" }}>{formatBDT(it.price)}</td>
              <td className="p-2 text-right" style={{ borderBottom: "1px solid #e5e7eb" }}>{formatBDT(it.price * it.qty)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Totals */}
      <div className="flex justify-end mt-4 pdf-keep" style={{ pageBreakInside: "avoid", breakInside: "avoid" }}>
        <div className="w-72 text-sm space-y-1">
          <div className="flex justify-between"><span style={{ color: "#4b5563" }}>Subtotal</span><span>{formatBDT(order.subtotal)}</span></div>
          <div className="flex justify-between"><span style={{ color: "#4b5563" }}>Shipping</span><span>{formatBDT(order.shipping_fee)}</span></div>
          {order.discount > 0 && (
            <div className="flex justify-between">
              <span style={{ color: "#4b5563" }}>Discount{order.referral_used ? ` (${order.referral_used})` : ""}</span>
              <span>−{formatBDT(order.discount)}</span>
            </div>
          )}
          <div className="flex justify-between font-semibold text-base pt-2 mt-1" style={{ borderTop: "1px solid #e5e7eb" }}>
            <span>Total</span><span>{formatBDT(order.total)}</span>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-10 pt-6 text-xs space-y-1 pdf-keep" style={{ borderTop: "1px solid #e5e7eb", color: "#4b5563", pageBreakInside: "avoid", breakInside: "avoid" }}>
        <div><span style={{ color: "#6b7280" }}>Payment method:</span> {order.payment_method}</div>
        {order.payment_details?.senderNumber && (
          <div><span style={{ color: "#6b7280" }}>Sender number:</span> <span className="font-mono">{order.payment_details.senderNumber}</span></div>
        )}
        {order.payment_details?.trxId && (
          <div><span style={{ color: "#6b7280" }}>TrxID:</span> <span className="font-mono">{order.payment_details.trxId}</span></div>
        )}
        {order.tracking_code && <div><span style={{ color: "#6b7280" }}>Tracking:</span> {order.tracking_code}</div>}
        <div className="pt-3 text-center" style={{ color: "#6b7280" }}>Thank you for shopping with {shopName}.</div>
      </div>

      <style>{`
        #invoice-document tr, #invoice-document .pdf-keep { page-break-inside: avoid; break-inside: avoid; }
        #invoice-document thead { display: table-header-group; }
      `}</style>


    </div>
  );
}
