// Default order confirmation email template + variable substitution.
// Shared between the admin editor (preview / "load default") and the
// checkout server function that actually sends the mail.

export const DEFAULT_ORDER_EMAIL_SUBJECT =
  "Order #{{order_number}} — {{shop_name}}";

export const DEFAULT_ORDER_EMAIL_BODY = `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;max-width:600px;margin:0 auto;background:#ffffff;color:#1f1f1f">
  <div style="background:#52277a;padding:28px 24px;text-align:center;color:#ffffff">
    <h1 style="margin:0;font-size:22px;font-weight:600;letter-spacing:0.3px">{{shop_name}}</h1>
    <p style="margin:6px 0 0;font-size:13px;opacity:0.85">{{shop_tagline}}</p>
  </div>
  <div style="padding:28px 24px">
    <h2 style="margin:0 0 8px;font-size:20px;color:#52277a">Thank you, {{customer_name}}!</h2>
    <p style="margin:0 0 18px;font-size:14px;line-height:1.55;color:#4a4a4a">
      We've received your order <strong>#{{order_number}}</strong> and are preparing it with care. You'll get another email as soon as it ships.
    </p>
    <table style="width:100%;border-collapse:collapse;font-size:14px;margin-top:8px">
      <thead>
        <tr style="background:#faf7fd;color:#52277a">
          <th style="text-align:left;padding:10px 12px;border-bottom:1px solid #ece4f5">Item</th>
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
    <div style="margin-top:24px;padding:16px;background:#faf7fd;border-radius:8px;font-size:13px;color:#4a4a4a">
      <strong style="color:#52277a">Payment:</strong> {{payment_method}}<br/>
      <strong style="color:#52277a">Ships to:</strong> {{shipping_address}}
    </div>
    <p style="margin:24px 0 0;font-size:13px;color:#777;line-height:1.5">
      Questions? Reply to this email or reach us at {{shop_email}}.
    </p>
  </div>
  <div style="background:#f6f3fa;padding:16px;text-align:center;font-size:12px;color:#888">
    © {{shop_name}} · Thank you for shopping with us
  </div>
</div>`;

export type OrderEmailVars = {
  order_number: string | number;
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
