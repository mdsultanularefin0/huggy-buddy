import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Plus, Trash2, Pencil, ExternalLink, Eye } from "lucide-react";
import { toast } from "sonner";
import { HtmlEditor } from "@/components/html-editor";
import { saveSitePage, deleteSitePage } from "@/lib/content.functions";


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

const slugify = (s: string) =>
  s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

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

  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteSlug, setDeleteSlug] = useState<string | null>(null);

  const selected = useMemo(
    () => pages.find((p) => p.slug === selectedSlug) ?? null,
    [pages, selectedSlug],
  );

  useEffect(() => {
    if (!selectedSlug && pages.length > 0) setSelectedSlug(pages[0].slug);
  }, [pages, selectedSlug]);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["admin", "site_pages"] });

  const deletePage = useMutation({
    mutationFn: async (slug: string) => {
      await deleteSitePage({ data: { slug } });
    },
    onSuccess: (_d, slug) => {
      toast.success("Page deleted");
      if (selectedSlug === slug) setSelectedSlug(null);
      setDeleteSlug(null);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Site Pages</h1>
          <p className="text-sm text-muted-foreground">
            Create, edit, and delete public pages. Content supports Markdown.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus /> New page
        </Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : pages.length === 0 ? (
        <div className="border rounded-xl p-8 text-center text-sm text-muted-foreground">
          No pages yet. Click <strong>New page</strong> to create one.
        </div>
      ) : (
        <div className="grid lg:grid-cols-[260px_1fr] gap-6">
          <aside className="space-y-1">
            {pages.map((p) => (
              <div
                key={p.slug}
                className={`group flex items-center justify-between rounded-md border px-3 py-2 text-sm ${
                  selectedSlug === p.slug ? "bg-muted border-primary/40" : "bg-background"
                }`}
              >
                <button
                  type="button"
                  onClick={() => setSelectedSlug(p.slug)}
                  className="flex-1 text-left truncate"
                >
                  <div className="font-medium truncate">{p.title}</div>
                  <div className="text-xs text-muted-foreground truncate">/{p.slug}</div>
                </button>
                <div className="flex items-center gap-1 opacity-60 group-hover:opacity-100">
                  <a
                    href={`/${p.slug}`}
                    target="_blank"
                    rel="noreferrer"
                    className="p-1 rounded hover:bg-accent/20"
                    title="View"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                  <button
                    type="button"
                    onClick={() => setDeleteSlug(p.slug)}
                    className="p-1 rounded hover:bg-destructive/10 text-destructive"
                    title="Delete"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </aside>

          <div>
            {selected ? (
              <PageEditor key={selected.slug} page={selected} onSaved={invalidate} />
            ) : (
              <p className="text-sm text-muted-foreground">Select a page to edit.</p>
            )}
          </div>
        </div>
      )}

      <CreatePageDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        existingSlugs={pages.map((p) => p.slug)}
        onCreated={(slug) => {
          setSelectedSlug(slug);
          invalidate();
        }}
      />

      <AlertDialog open={!!deleteSlug} onOpenChange={(o) => !o && setDeleteSlug(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this page?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove <strong>/{deleteSlug}</strong>. Visitors will see a
              "not published" message until you recreate it. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                if (deleteSlug) deletePage.mutate(deleteSlug);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletePage.isPending ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function CreatePageDialog({
  open,
  onOpenChange,
  existingSlugs,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  existingSlugs: string[];
  onCreated: (slug: string) => void;
}) {
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);

  useEffect(() => {
    if (!open) {
      setTitle("");
      setSlug("");
      setSlugTouched(false);
    }
  }, [open]);

  useEffect(() => {
    if (!slugTouched) setSlug(slugify(title));
  }, [title, slugTouched]);

  const create = useMutation({
    mutationFn: async () => {
      const finalSlug = slugify(slug);
      if (!finalSlug) throw new Error("Slug is required");
      if (existingSlugs.includes(finalSlug)) throw new Error("A page with that slug already exists");
      await saveSitePage({
        data: {
          slug: finalSlug,
          title: title.trim() || finalSlug,
          content: "",
          meta_description: null,
        },
      });
      return finalSlug;
    },
    onSuccess: (newSlug) => {
      toast.success("Page created");
      onCreated(newSlug);
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New page</DialogTitle>
          <DialogDescription>
            The slug becomes the public URL: <code>/your-slug</code>.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="About Us" />
          </div>
          <div>
            <Label>Slug</Label>
            <Input
              value={slug}
              onChange={(e) => {
                setSlugTouched(true);
                setSlug(e.target.value);
              }}
              placeholder="about"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => create.mutate()} disabled={create.isPending || !title.trim()}>
            {create.isPending ? "Creating…" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PageEditor({ page, onSaved }: { page: Page; onSaved: () => void }) {
  const [title, setTitle] = useState(page.title);
  const [metaDesc, setMetaDesc] = useState(page.meta_description ?? "");
  const [content, setContent] = useState(page.content);

  useEffect(() => {
    setTitle(page.title);
    setMetaDesc(page.meta_description ?? "");
    setContent(page.content);
  }, [page.slug, page.updated_at, page.title, page.meta_description, page.content]);

  const save = useMutation({
    mutationFn: async () => {
      await saveSitePage({
        data: {
          slug: page.slug,
          title: title.trim() || page.slug,
          meta_description: metaDesc.trim() || null,
          content,
        },
      });
    },
    onSuccess: () => {
      toast.success("Page saved");
      onSaved();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const dirty =
    title !== page.title ||
    (metaDesc || "") !== (page.meta_description ?? "") ||
    content !== page.content;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="text-xs text-muted-foreground">
          Slug: <code>/{page.slug}</code> · Updated{" "}
          {new Date(page.updated_at).toLocaleString()}
        </div>
        <Button onClick={() => save.mutate()} disabled={save.isPending || !dirty}>
          <Pencil /> {save.isPending ? "Saving…" : "Save changes"}
        </Button>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <Label>Title</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div>
          <Label>Meta description (SEO)</Label>
          <Input value={metaDesc} onChange={(e) => setMetaDesc(e.target.value)} />
        </div>
      </div>

      <div>
        <Label className="mb-2 block">Content</Label>
        <Tabs defaultValue="edit" className="w-full">
          <TabsList>
            <TabsTrigger value="edit">
              <Pencil className="h-3.5 w-3.5 mr-1" /> Edit
            </TabsTrigger>
            <TabsTrigger value="preview">
              <Eye className="h-3.5 w-3.5 mr-1" /> Live preview
            </TabsTrigger>
          </TabsList>
          <TabsContent value="edit" className="mt-3">
            <HtmlEditor value={content} onChange={setContent} />
            <p className="mt-2 text-xs text-muted-foreground">
              Use the toolbar for quick formatting — headings, lists, links, quotes.
            </p>
          </TabsContent>
          <TabsContent value="preview" className="mt-3">
            <div className="rounded-md border bg-white">
              <div className="border-b px-4 py-2 text-xs text-muted-foreground bg-muted/40">
                Public preview · <code>/{page.slug}</code>
              </div>
              <div className="max-w-3xl mx-auto py-12 px-4">
                <h1 className="text-3xl md:text-4xl font-semibold text-center text-[#52277a] mb-10">
                  {title || page.slug}
                </h1>
                {content.trim() ? (
                  <article
                    className="prose prose-gray max-w-none prose-headings:text-[#52277a] prose-headings:font-semibold prose-h2:text-xl prose-h2:mt-8 prose-h2:mb-3 prose-a:text-[#a555f0] prose-li:my-1"
                    dangerouslySetInnerHTML={{ __html: content }}
                  />
                ) : (
                  <p className="text-center text-gray-400 text-sm">Nothing to preview yet.</p>
                )}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
