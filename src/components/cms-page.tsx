import { useQuery } from "@tanstack/react-query";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { supabase } from "@/integrations/supabase/client";

export function cmsPageQueryOptions(slug: string) {
  return {
    queryKey: ["site_page", slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("site_pages")
        .select("slug,title,content,meta_description,updated_at")
        .eq("slug", slug)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  };
}

export function CmsPage({ slug, fallbackTitle }: { slug: string; fallbackTitle: string }) {
  const { data, isLoading } = useQuery(cmsPageQueryOptions(slug));
  const title = data?.title ?? fallbackTitle;

  return (
    <div className="min-h-screen bg-white">
      <SiteHeader />
      <main className="max-w-3xl mx-auto py-16 px-4">
        <h1 className="text-3xl md:text-4xl font-semibold text-center text-[#52277a] mb-10">
          {title}
        </h1>
        {isLoading ? (
          <p className="text-center text-gray-400">Loading…</p>
        ) : !data ? (
          <p className="text-center text-gray-500">This page has not been published yet.</p>
        ) : (
          <article
            className="prose prose-gray max-w-none prose-headings:text-[#52277a] prose-headings:font-semibold prose-h2:text-xl prose-h2:mt-8 prose-h2:mb-3 prose-a:text-[#a555f0] prose-li:my-1"
            dangerouslySetInnerHTML={{ __html: data.content || "" }}
          />
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
