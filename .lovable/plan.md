## Goal
Remove the signed-URL hop for branding assets so the header logo loads as fast as the hero images.

## Steps

1. **Flip the bucket** — call `storage_update_bucket` to set `hero-images` to public. (Now allowed since you enabled the workspace policy.)

2. **Update `src/lib/upload.ts`** — replace the `createSignedUrl` call with `getPublicUrl`. Returns a permanent CDN URL with no token/expiry.

   ```ts
   const { data: { publicUrl } } = supabase.storage.from(bucket).getPublicUrl(path);
   return publicUrl;
   ```

3. **Leave existing rows alone** — old signed URLs in `site_settings` still work until they expire. Next time the admin re-uploads the logo/icon, the new public URL gets saved. No migration needed.

## Notes
- `fetchPriority="high"` is already on the header `<img>` from the previous turn.
- The `useQuery` for branding stays — it's still needed to read `site_logo_url` / `site_icon_url` / `header_logo_size` from `site_settings`. The slowness was the signed URL, not the query.
- Other callers of `uploadImage` (product/combo images) also move to public URLs. If you want those buckets to stay private, say so and I'll scope the change to hero-images only.
