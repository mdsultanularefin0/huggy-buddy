import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Bold,
  Italic,
  Underline,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
  Link as LinkIcon,
  Undo2,
  Redo2,
  Eraser,
  Image as ImageIcon,
  Video as VideoIcon,
  Youtube,
  Loader2,
} from "lucide-react";
import { uploadImage } from "@/lib/upload";
import { MediaPicker } from "@/components/media-picker";
import { toast } from "sonner";

type Props = {
  value: string;
  onChange: (html: string) => void;
};

const MEDIA_BUCKET = "hero-images";

// Lightweight contenteditable rich-text editor with quick-access toolbar.
// Uses document.execCommand — fine for simple CMS-style HTML editing.
export function HtmlEditor({ value, onChange }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  // Keep DOM in sync when value changes from outside (e.g. switching pages).
  useEffect(() => {
    const el = ref.current;
    if (el && el.innerHTML !== value) {
      el.innerHTML = value || "";
    }
  }, [value]);

  const exec = (cmd: string, arg?: string) => {
    ref.current?.focus();
    document.execCommand(cmd, false, arg);
    if (ref.current) onChange(ref.current.innerHTML);
  };

  const insertHtml = (html: string) => {
    ref.current?.focus();
    document.execCommand("insertHTML", false, html);
    if (ref.current) onChange(ref.current.innerHTML);
  };

  const insertImage = (url: string, alt = "") => {
    if (!url) return;
    const safeAlt = alt.replace(/"/g, "&quot;");
    insertHtml(
      `<p><img src="${url}" alt="${safeAlt}" style="max-width:100%;height:auto;border-radius:8px" /></p><p><br/></p>`,
    );
  };

  const insertVideo = (url: string) => {
    if (!url) return;
    insertHtml(
      `<p><video src="${url}" controls playsinline style="max-width:100%;height:auto;border-radius:8px"></video></p><p><br/></p>`,
    );
  };

  const insertYouTube = (url: string) => {
    // extract youtube id
    const m = url.match(
      /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([\w-]{11})/,
    );
    const id = m?.[1];
    if (!id) {
      toast.error("Could not parse YouTube URL");
      return;
    }
    insertHtml(
      `<p><iframe src="https://www.youtube.com/embed/${id}" width="560" height="315" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen style="max-width:100%;aspect-ratio:16/9;border-radius:8px"></iframe></p><p><br/></p>`,
    );
  };

  const handleUpload = async (file: File, kind: "image" | "video") => {
    setUploading(true);
    try {
      const url = await uploadImage(MEDIA_BUCKET, file);
      if (kind === "image") insertImage(url, file.name);
      else insertVideo(url);
      toast.success(`${kind === "image" ? "Image" : "Video"} inserted`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const tools: { icon: React.ReactNode; title: string; run: () => void }[] = [
    { icon: <Bold className="h-4 w-4" />, title: "Bold (Ctrl+B)", run: () => exec("bold") },
    { icon: <Italic className="h-4 w-4" />, title: "Italic (Ctrl+I)", run: () => exec("italic") },
    { icon: <Underline className="h-4 w-4" />, title: "Underline", run: () => exec("underline") },
    { icon: <Heading2 className="h-4 w-4" />, title: "Heading 2", run: () => exec("formatBlock", "<h2>") },
    { icon: <Heading3 className="h-4 w-4" />, title: "Heading 3", run: () => exec("formatBlock", "<h3>") },
    { icon: <Quote className="h-4 w-4" />, title: "Quote", run: () => exec("formatBlock", "<blockquote>") },
    { icon: <List className="h-4 w-4" />, title: "Bulleted list", run: () => exec("insertUnorderedList") },
    { icon: <ListOrdered className="h-4 w-4" />, title: "Numbered list", run: () => exec("insertOrderedList") },
    {
      icon: <LinkIcon className="h-4 w-4" />,
      title: "Insert link",
      run: () => {
        const url = window.prompt("Link URL");
        if (url) exec("createLink", url);
      },
    },
    { icon: <Eraser className="h-4 w-4" />, title: "Clear formatting", run: () => exec("removeFormat") },
    { icon: <Undo2 className="h-4 w-4" />, title: "Undo", run: () => exec("undo") },
    { icon: <Redo2 className="h-4 w-4" />, title: "Redo", run: () => exec("redo") },
  ];

  return (
    <div className="border rounded-md overflow-hidden bg-background">
      <div className="flex flex-wrap items-center gap-1 border-b bg-muted/50 p-1">
        <select
          className="text-xs h-8 px-2 rounded border bg-background"
          onChange={(e) => {
            const v = e.target.value;
            if (v) exec("formatBlock", v);
            e.target.value = "";
          }}
          defaultValue=""
          title="Paragraph style"
        >
          <option value="" disabled>
            Style…
          </option>
          <option value="<p>">Paragraph</option>
          <option value="<h2>">Heading 2</option>
          <option value="<h3>">Heading 3</option>
          <option value="<h4>">Heading 4</option>
          <option value="<blockquote>">Quote</option>
          <option value="<pre>">Code block</option>
        </select>
        {tools.map((t, i) => (
          <Button
            key={i}
            type="button"
            size="sm"
            variant="ghost"
            className="h-8 w-8 p-0"
            title={t.title}
            onMouseDown={(e) => e.preventDefault()}
            onClick={t.run}
          >
            {t.icon}
          </Button>
        ))}

        <div className="mx-1 h-6 w-px bg-border" />

        {/* Image upload */}
        <input
          ref={imageInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleUpload(f, "image");
            e.target.value = "";
          }}
        />
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-8 px-2 gap-1"
          title="Upload image"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => imageInputRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageIcon className="h-4 w-4" />}
        </Button>

        {/* Video upload */}
        <input
          ref={videoInputRef}
          type="file"
          accept="video/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleUpload(f, "video");
            e.target.value = "";
          }}
        />
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-8 px-2"
          title="Upload video"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => videoInputRef.current?.click()}
          disabled={uploading}
        >
          <VideoIcon className="h-4 w-4" />
        </Button>

        {/* YouTube embed */}
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-8 px-2"
          title="Embed YouTube video"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            const url = window.prompt("YouTube URL (watch, shorts, or youtu.be)");
            if (url) insertYouTube(url);
          }}
        >
          <Youtube className="h-4 w-4" />
        </Button>

        {/* Pick from media library */}
        <div onMouseDown={(e) => e.preventDefault()}>
          <MediaPicker
            label="Library"
            onPick={(url) => {
              const isVideo = /\.(mp4|webm|mov|m4v|ogg)(\?|$)/i.test(url);
              if (isVideo) insertVideo(url);
              else insertImage(url);
            }}
          />
        </div>
      </div>
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        onInput={(e) => onChange((e.target as HTMLDivElement).innerHTML)}
        className="prose prose-sm prose-gray max-w-none min-h-[420px] p-4 focus:outline-none prose-headings:text-[#52277a]"
      />
    </div>
  );
}
