import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ReactNode } from "react";

export function BulkActionBar({
  count,
  onClear,
  children,
  label = "selected",
}: {
  count: number;
  onClear: () => void;
  children: ReactNode;
  label?: string;
}) {
  if (count === 0) return null;
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 px-3 py-2 rounded-full border bg-background shadow-lg animate-in fade-in slide-in-from-bottom-2">
      <span className="text-sm px-2 font-medium">
        {count} {label}
      </span>
      <div className="h-5 w-px bg-border" />
      <div className="flex items-center gap-1">{children}</div>
      <div className="h-5 w-px bg-border" />
      <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full" onClick={onClear}>
        <X className="w-4 h-4" />
      </Button>
    </div>
  );
}
