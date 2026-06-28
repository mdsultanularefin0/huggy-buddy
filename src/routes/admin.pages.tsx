import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";

export const Route = createFileRoute("/admin/pages")({
  head: () => ({ meta: [{ title: "Pages — Admin" }, { name: "robots", content: "noindex" }] }),
  component: AdminPages,
});

type Page = {
  slug: string;
  title: string;
  content: string;
  meta_description: string | null;
  updated_at: string;
};

const KNOWN = [
  { slug: "terms", label: "Terms & Conditions" },
  { slug: "privacy", label: "Privacy Policy" },
  { slug: "faq", label: "FAQ" },
  { slug: "about", label: "About" },
  { slug: "shipping", label: "Shipping & Returns" },
];

function AdminPages() {
  const qc = useQueryClient();
  const { data: pages = [], isLoading } = useQuery({
    queryKey: ["admin", "site_pages"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("site_pages")
        .select("slug,title,content,meta_description,updated_at")
        .order("slug");
      if (error) throw error;
      return data as Page[];
    },
  });

  const [active, setActive] = useState<string>("terms");
  const current = pages.find((p) => p.slug === active);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Site Pages</h1>
        <p className="text-sm text-muted-foreground">
          Edit the content of public pages (Terms, Privacy, FAQ, About, Shipping). Supports Markdown.
        </p>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <Tabs value={active} onValueChange={setActive}>
          <TabsList className="flex-wrap h-auto">
            {KNOWN.map((k) => (
              <TabsTrigger key={k.slug} value={k.slug}>{k.label}</TabsTrigger>
            ))}
          </TabsList>
          {KNOWN.map((k) => (
            <TabsContent key={k.slug} value={k.slug}>
              <PageEditor
                slug={k.slug}
                fallbackTitle={k.label}
                page={pages.find((p) => p.slug === k.slug)}
                onSaved={() => qc.invalidateQueries({ queryKey: ["admin", "site_pages"] })}
              />
            </TabsContent>
          ))}
        </Tabs>
      )}

      {current && (
        <p className="text-xs text-muted-foreground">
          Last updated: {new Date(current.updated_at).toLocaleString()}
        </p>
      )}
    </div>
  );
}

function PageEditor({
  slug,
  fallbackTitle,
  page,
  onSaved,
}: {
  slug: string;
  fallbackTitle: string;
  page?: Page;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState(page?.title ?? fallbackTitle);
  const [metaDesc, setMetaDesc] = useState(page?.meta_description ?? "");
  const [content, setContent] = useState(page?.content ?? "");

  useEffect(() => {
    setTitle(page?.title ?? fallbackTitle);
    setMetaDesc(page?.meta_description ?? "");
    setContent(page?.content ?? "");
  }, [page?.slug, page?.updated_at, fallbackTitle, page?.title, page?.meta_description, page?.content]);

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("site_pages")
        .upsert({
          slug,
          title: title.trim() || fallbackTitle,
          meta_description: metaDesc.trim() || null,
          content,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Page saved");
      onSaved();
      void supabase.auth.getSession(); // no-op
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="grid lg:grid-cols-2 gap-6 mt-4">
      <div className="space-y-4">
        <div>
          <Label>Title</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div>
          <Label>Meta description (SEO)</Label>
          <Input value={metaDesc} onChange={(e) => setMetaDesc(e.target.value)} />
        </div>
        <div>
          <Label>Content (Markdown)</Label>
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={22}
            className="font-mono text-sm"
          />
        </div>
        <Button onClick={() => save.mutate()} disabled={save.isPending}>
          {save.isPending ? "Saving…" : "Save changes"}
        </Button>
      </div>
      <div className="border rounded-xl p-5 bg-muted/30 overflow-auto">
        <p className="text-xs uppercase tracking-wide text-muted-foreground mb-3">Preview</p>
        <h2 className="text-2xl font-semibold text-[#52277a] mb-4">{title}</h2>
        <article className="prose prose-sm prose-gray max-w-none prose-headings:text-[#52277a] prose-h2:text-base prose-h2:mt-5 prose-h2:mb-2">
          <ReactMarkdown>{content || "_Nothing yet._"}</ReactMarkdown>
        </article>
      </div>
    </div>
  );
}
