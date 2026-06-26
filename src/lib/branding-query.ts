import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const brandingQueryOptions = queryOptions({
  queryKey: ["storefront", "branding"],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("site_settings")
      .select(
        "site_logo_url, site_icon_url, header_logo_size, footer_logo_size, footer_logo_align, shop_name, shop_tagline, shop_email, shop_phone, shop_address, shop_hours, social_facebook, social_instagram, social_twitter, social_youtube, social_tiktok, social_whatsapp"
      )
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data ?? null;
  },
  staleTime: 60_000,
});
