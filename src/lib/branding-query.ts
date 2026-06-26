import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const brandingQueryOptions = queryOptions({
  queryKey: ["storefront", "branding"],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("site_settings")
      .select("site_logo_url, site_icon_url, header_logo_size")
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data ?? null;
  },
  staleTime: 60_000,
});
