import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(userId: string, supabase: unknown) {
  const { assertAdmin: check } = await import("@/lib/admin-guard.server");
  return check(userId, supabase);
}

// ---------- Orders CSV export ----------

const exportOrdersSchema = z.object({
  from: z.string().nullable().optional(),
  to: z.string().nullable().optional(),
  statusFilter: z
    .enum(["Pending", "Processing", "Shipped", "Completed", "Cancelled", "Returned", "all"])
    .default("all"),
});

export type OrderCSVRow = {
  order_number: string;
  date: string;
  customer_name: string;
  phone: string;
  district: string;
  total: number;
  payment_status: string;
  order_status: string;
};

export const exportOrdersForCSV = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => exportOrdersSchema.parse(data ?? {}))
  .handler(async ({ data, context }): Promise<OrderCSVRow[]> => {
    await assertAdmin(context.userId, context.supabase);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let q = supabaseAdmin
      .from("orders")
      .select("order_number, created_at, customer_json, total, payment_status, order_status")
      .order("created_at", { ascending: false })
      .limit(10000);

    if (data.statusFilter !== "all") q = q.eq("order_status", data.statusFilter);
    if (data.from) q = q.gte("created_at", new Date(data.from).toISOString());
    if (data.to) {
      const end = new Date(data.to);
      end.setDate(end.getDate() + 1);
      q = q.lt("created_at", end.toISOString());
    }

    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);

    return (rows ?? []).map((o) => {
      const c = (o.customer_json ?? {}) as { name?: string; phone?: string; district?: string };
      return {
        order_number: o.order_number,
        date: new Date(o.created_at).toISOString(),
        customer_name: c.name ?? "",
        phone: c.phone ?? "",
        district: c.district ?? "",
        total: Number(o.total ?? 0),
        payment_status: o.payment_status,
        order_status: o.order_status,
      };
    });
  });

// ---------- Bulk product import ----------

export const BULK_IMPORT_HEADERS = [
  "Product Handle",
  "Product Name",
  "Description",
  "Short Description",
  "Category Slug",
  "Scent Profile",
  "Badge",
  "Image URL",
  "Sale Price",
  "Is Active",
  "Variant Size Label",
  "Variant Price",
  "Variant Sale Price",
  "Variant Stock",
  "Variant Sort Order",
] as const;

const importRowSchema = z.object({
  product_handle: z.string().trim().min(1).max(120),
  product_name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(5000).optional().nullable(),
  short_description: z.string().trim().max(500).optional().nullable(),
  category_slug: z.string().trim().max(120).optional().nullable(),
  scent_profile: z.string().trim().max(200).optional().nullable(),
  badge: z.string().trim().max(60).optional().nullable(),
  image_url: z.string().trim().max(1000).optional().nullable(),
  sale_price: z.number().nonnegative().optional().nullable(),
  is_active: z.boolean().optional(),
  variant_size_label: z.string().trim().min(1).max(60),
  variant_price: z.number().nonnegative(),
  variant_sale_price: z.number().nonnegative().optional().nullable(),
  variant_stock: z.number().int().nonnegative(),
  variant_sort_order: z.number().int().optional(),
});

const importSchema = z.object({
  rows: z.array(z.unknown()).min(1).max(2000),
});

export type ImportResult = {
  created_products: number;
  updated_products: number;
  variants_upserted: number;
  errors: { row: number; message: string }[];
};

function slugify(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export const bulkImportProducts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => importSchema.parse(data))
  .handler(async ({ data, context }): Promise<ImportResult> => {
    await assertAdmin(context.userId, context.supabase);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Pre-load categories for slug lookup.
    const { data: cats, error: catsErr } = await supabaseAdmin
      .from("categories")
      .select("id, slug");
    if (catsErr) throw new Error(catsErr.message);
    const catBySlug = new Map((cats ?? []).map((c) => [c.slug.toLowerCase(), c.id]));

    // Pre-load notes for scent profile lookup (case-insensitive on scent_profile text).
    const { data: notes, error: notesErr } = await supabaseAdmin
      .from("notes")
      .select("id, scent_profile")
      .eq("is_active", true);
    if (notesErr) throw new Error(notesErr.message);
    const noteByProfile = new Map<string, string>();
    for (const n of notes ?? []) {
      if (n.scent_profile) noteByProfile.set(n.scent_profile.trim().toLowerCase(), n.id);
    }

    const errors: { row: number; message: string }[] = [];
    // Group rows by product handle.
    const groups = new Map<
      string,
      {
        product: z.infer<typeof importRowSchema>;
        variants: z.infer<typeof importRowSchema>[];
        firstRow: number;
      }
    >();

    data.rows.forEach((raw, idx) => {
      const rowNum = idx + 2; // +1 for header, +1 for 1-based
      const parsed = importRowSchema.safeParse(raw);
      if (!parsed.success) {
        errors.push({ row: rowNum, message: parsed.error.issues[0]?.message ?? "Invalid row" });
        return;
      }
      const r = parsed.data;
      const handle = slugify(r.product_handle);
      if (!handle) {
        errors.push({ row: rowNum, message: "Empty Product Handle" });
        return;
      }
      // Validate category/notes here so we can skip the row cleanly.
      if (r.category_slug && !catBySlug.has(r.category_slug.trim().toLowerCase())) {
        errors.push({ row: rowNum, message: `Category not found: ${r.category_slug}` });
        return;
      }
      if (r.scent_profile && !noteByProfile.has(r.scent_profile.trim().toLowerCase())) {
        errors.push({ row: rowNum, message: `Scent Profile not found: ${r.scent_profile}` });
        return;
      }
      const g = groups.get(handle);
      if (g) g.variants.push(r);
      else groups.set(handle, { product: r, variants: [r], firstRow: rowNum });
    });

    let created = 0;
    let updated = 0;
    let variantsUpserted = 0;

    for (const [handle, g] of groups) {
      try {
        const firstVariant = g.variants[0];
        const categoryId = g.product.category_slug
          ? catBySlug.get(g.product.category_slug.trim().toLowerCase()) ?? null
          : null;

        // Check if product exists.
        const { data: existing, error: exErr } = await supabaseAdmin
          .from("products")
          .select("id")
          .eq("slug", handle)
          .maybeSingle();
        if (exErr) throw new Error(exErr.message);

        const productPayload = {
          slug: handle,
          name: g.product.product_name,
          description: g.product.description ?? null,
          short_description: g.product.short_description ?? null,
          scent_profile: g.product.scent_profile ?? null,
          category_id: categoryId,
          regular_price: Math.round(firstVariant.variant_price),
          sale_price: g.product.sale_price != null ? Math.round(g.product.sale_price) : null,
          badge: g.product.badge ?? null,
          image_url: g.product.image_url ?? null,
          stock_quantity: g.variants.reduce((s, v) => s + v.variant_stock, 0),
          in_stock: g.variants.some((v) => v.variant_stock > 0),
          is_active: g.product.is_active ?? true,
          sizes_json: [],
          images_json: [],
        };

        let productId: string;
        if (existing) {
          const { error } = await supabaseAdmin
            .from("products")
            .update({
              name: productPayload.name,
              description: productPayload.description,
              short_description: productPayload.short_description,
              scent_profile: productPayload.scent_profile,
              category_id: productPayload.category_id,
              regular_price: productPayload.regular_price,
              sale_price: productPayload.sale_price,
              badge: productPayload.badge,
              image_url: productPayload.image_url,
              is_active: productPayload.is_active,
              stock_quantity: productPayload.stock_quantity,
              in_stock: productPayload.in_stock,
            })
            .eq("id", existing.id);
          if (error) throw new Error(error.message);
          productId = existing.id;
          updated++;
        } else {
          const { data: ins, error } = await supabaseAdmin
            .from("products")
            .insert(productPayload)
            .select("id")
            .single();
          if (error) throw new Error(error.message);
          productId = ins.id;
          created++;
        }

        // Sync product_categories link.
        if (categoryId) {
          await supabaseAdmin
            .from("product_categories")
            .upsert({ product_id: productId, category_id: categoryId }, { onConflict: "product_id,category_id" });
        }
        // Sync product_notes link.
        if (g.product.scent_profile) {
          const noteId = noteByProfile.get(g.product.scent_profile.trim().toLowerCase());
          if (noteId) {
            await supabaseAdmin
              .from("product_notes")
              .upsert({ product_id: productId, note_id: noteId }, { onConflict: "product_id,note_id" });
          }
        }

        // Upsert each variant on (product_id, size_label).
        for (const v of g.variants) {
          const { error } = await supabaseAdmin
            .from("product_variants")
            .upsert(
              {
                product_id: productId,
                size_label: v.variant_size_label,
                price: Math.round(v.variant_price),
                sale_price: v.variant_sale_price != null ? Math.round(v.variant_sale_price) : null,
                sort_order: v.variant_sort_order ?? 0,
                stock_quantity: v.variant_stock,
                in_stock: v.variant_stock > 0,
              },
              { onConflict: "product_id,size_label" },
            );
          if (error) throw new Error(error.message);
          variantsUpserted++;
        }
      } catch (e) {
        errors.push({
          row: g.firstRow,
          message: `Handle "${handle}": ${e instanceof Error ? e.message : "failed"}`,
        });
      }
    }

    return {
      created_products: created,
      updated_products: updated,
      variants_upserted: variantsUpserted,
      errors,
    };
  });
