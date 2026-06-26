import { supabase } from "@/integrations/supabase/client";

const TEN_YEARS_SECONDS = 60 * 60 * 24 * 365 * 10;

// Buckets that are public — uploads return a permanent public CDN URL.
const PUBLIC_BUCKETS = new Set(["hero-images"]);

export async function uploadImage(bucket: string, file: File): Promise<string> {
  const ext = file.name.split(".").pop() || "jpg";
  const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    cacheControl: "3600",
    upsert: false,
  });
  if (error) throw error;

  if (PUBLIC_BUCKETS.has(bucket)) {
    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    return data.publicUrl;
  }

  const { data, error: signErr } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, TEN_YEARS_SECONDS);
  if (signErr || !data) throw signErr ?? new Error("Failed to sign URL");
  return data.signedUrl;
}
