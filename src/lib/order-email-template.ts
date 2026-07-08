// Default order confirmation email template + variable substitution.
// Invoice-style design: thank-you header then invoice-like details.

export const DEFAULT_ORDER_EMAIL_SUBJECT =
  "Invoice for Order #{{order_number}} — {{shop_name}}";

export const DEFAULT_ORDER_EMAIL_BODY = `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;max-width:640px;margin:0 auto;background:#ffffff;color:#1f1f1f;border:1px solid #ece4f5">
  <div style="padding:32px 28px 20px;text-align:center;border-bottom:1px solid #ece4f5">
    <h1 style="margin:0 0 6px;font-size:24px;color:#52277a;font-weight:700;letter-spacing:0.3px">Thank you, {{customer_name}}!</h1>
    <p style="margin:0;font-size:14px;color:#555;line-height:1.55">
      We've received your order and are preparing it with care.<br/>
      A confirmation of your purchase is below.
    </p>
  </div>

  <div style="padding:24px 28px 8px;display:flex;justify-content:space-between;flex-wrap:wrap;gap:16px">
    <div style="flex:1;min-width:220px">
      <div style="font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#888;margin-bottom:6px">Invoice From</div>
      <div style="font-size:15px;font-weight:600;color:#52277a">{{shop_name}}</div>
      <div style="font-size:13px;color:#666;line-height:1.5">{{shop_tagline}}<br/>{{shop_email}}</div>
    </div>
    <div style="flex:1;min-width:220px;text-align:right">
      <div style="font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#888;margin-bottom:6px">Invoice</div>
      <div style="font-size:15px;font-weight:600;color:#1f1f1f">#{{order_number}}</div>
      <div style="font-size:13px;color:#666">{{order_date}}</div>
    </div>
  </div>

  <div style="padding:16px 28px 8px">
    <div style="font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#888;margin-bottom:6px">Billed To</div>
    <div style="font-size:14px;color:#1f1f1f;line-height:1.5">
      <strong>{{customer_name}}</strong><br/>
      {{shipping_address}}
    </div>
  </div>

  <div style="padding:20px 28px 0">
    <table style="width:100%;border-collapse:collapse;font-size:14px">
      <thead>
        <tr style="background:#faf7fd;color:#52277a">
          <th style="text-align:left;padding:10px 12px;border-bottom:1px solid #ece4f5">Description</th>
          <th style="text-align:right;padding:10px 12px;border-bottom:1px solid #ece4f5">Amount</th>
        </tr>
      </thead>
      <tbody>
        {{items}}
      </tbody>
      <tfoot>
        <tr><td style="padding:8px 12px;color:#666">Subtotal</td><td style="padding:8px 12px;text-align:right">৳ {{subtotal}}</td></tr>
        <tr><td style="padding:8px 12px;color:#666">Shipping</td><td style="padding:8px 12px;text-align:right">৳ {{shipping}}</td></tr>
        {{discount_row}}
        <tr><td style="padding:12px;border-top:2px solid #52277a;font-weight:700;color:#52277a">Total</td><td style="padding:12px;border-top:2px solid #52277a;text-align:right;font-weight:700;color:#52277a">৳ {{total}}</td></tr>
      </tfoot>
    </table>
  </div>

  <div style="margin:24px 28px;padding:16px;background:#faf7fd;border-radius:8px;font-size:13px;color:#4a4a4a;line-height:1.6">
    <div><strong style="color:#52277a">Payment Method:</strong> {{payment_method}}</div>
    <div><strong style="color:#52277a">Ships To:</strong> {{shipping_address}}</div>
  </div>

  <div style="padding:0 28px 28px;font-size:13px;color:#777;line-height:1.55">
    Questions about this invoice? Reply to this email or contact us at {{shop_email}}.
  </div>

  <div style="background:#f6f3fa;padding:16px;text-align:center;font-size:12px;color:#888">
    © {{shop_name}} · Thank you for shopping with us
  </div>
</div>`;

export type OrderEmailVars = {
  order_number: string | number;
  order_date: string;
  customer_name: string;
  items: string; // pre-rendered <tr> rows
  subtotal: number | string;
  shipping: number | string;
  discount: number | string;
  discount_row: string; // full <tr> or empty
  total: number | string;
  payment_method: string;
  shipping_address: string;
  shop_name: string;
  shop_tagline: string;
  shop_email: string;
};

export function renderOrderEmail(
  template: string,
  vars: OrderEmailVars,
): string {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k: string) => {
    const v = (vars as Record<string, unknown>)[k];
    return v === undefined || v === null ? "" : String(v);
  });
}
