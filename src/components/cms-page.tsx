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
    <div className="min-h-screen bg-gradient-to-b from-[#faf7fb] via-white to-white">
      <SiteHeader />
      <main className="max-w-3xl mx-auto py-16 px-4 md:px-6">
        <header className="text-center mb-12">
          <div className="inline-block">
            <h1 className="text-4xl md:text-5xl font-semibold text-[#52277a] tracking-tight">
              {title}
            </h1>
            <div className="mt-3 h-[3px] w-16 mx-auto rounded-full bg-gradient-to-r from-[#a555f0] to-[#52277a]" />
          </div>
          {data?.updated_at && (
            <p className="mt-4 text-xs uppercase tracking-[0.18em] text-gray-400">
              Last updated{" "}
              {new Date(data.updated_at).toLocaleDateString(undefined, {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </p>
          )}
        </header>

        {isLoading ? (
          <p className="text-center text-gray-400">Loading…</p>
        ) : !data ? (
          <p className="text-center text-gray-500">This page has not been published yet.</p>
        ) : (
          <article
            className="cms-content rounded-2xl bg-white/70 backdrop-blur-sm shadow-[0_8px_30px_-12px_rgba(82,39,122,0.15)] ring-1 ring-[#52277a]/5 px-6 md:px-10 py-8 md:py-12
              prose prose-gray max-w-none
              prose-headings:font-semibold prose-headings:text-[#52277a] prose-headings:tracking-tight
              prose-h2:text-2xl prose-h2:mt-10 prose-h2:mb-4 prose-h2:pb-2 prose-h2:border-b prose-h2:border-[#a555f0]/15
              prose-h3:text-lg prose-h3:mt-6 prose-h3:mb-2
              prose-p:text-gray-700 prose-p:leading-[1.8]
              prose-a:text-[#a555f0] prose-a:no-underline hover:prose-a:underline prose-a:underline-offset-4
              prose-strong:text-gray-900
              prose-ul:my-4 prose-ol:my-4 prose-li:my-1.5 prose-li:text-gray-700
              prose-li:marker:text-[#a555f0]
              prose-blockquote:border-l-4 prose-blockquote:border-[#a555f0] prose-blockquote:bg-[#faf2ff]/60 prose-blockquote:rounded-r-lg prose-blockquote:px-5 prose-blockquote:py-1 prose-blockquote:not-italic prose-blockquote:text-gray-700
              prose-code:text-[#52277a] prose-code:bg-[#faf2ff] prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:before:content-none prose-code:after:content-none
              prose-hr:border-[#52277a]/10 prose-hr:my-10"
            dangerouslySetInnerHTML={{ __html: data.content || "" }}
          />
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
