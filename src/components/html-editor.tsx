import { useEffect, useRef } from "react";
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
} from "lucide-react";

type Props = {
  value: string;
  onChange: (html: string) => void;
};

// Lightweight contenteditable rich-text editor with quick-access toolbar.
// Uses document.execCommand — fine for simple CMS-style HTML editing.
export function HtmlEditor({ value, onChange }: Props) {
  const ref = useRef<HTMLDivElement>(null);

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
