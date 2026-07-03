import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Pipette } from "lucide-react";

const SWATCHES = [
  "#f5edff", "#efe0ff", "#e0c9ff", "#a555f0", "#7c3aed", "#52277a",
  "#fce7f3", "#fbcfe8", "#f9a8d4", "#f472b6", "#ec4899", "#be185d",
  "#fef3c7", "#fde68a", "#fbbf24", "#f59e0b", "#d97706", "#92400e",
  "#dcfce7", "#bbf7d0", "#86efac", "#22c55e", "#16a34a", "#166534",
  "#e0f2fe", "#bae6fd", "#7dd3fc", "#0ea5e9", "#0369a1", "#0c4a6e",
  "#f5f5f4", "#e7e5e4", "#a8a29e", "#57534e", "#292524", "#000000",
];

const GRADIENTS = [
  "linear-gradient(135deg, #a555f0, #52277a)",
  "linear-gradient(135deg, #f472b6, #a555f0)",
  "linear-gradient(135deg, #fbbf24, #ec4899)",
  "linear-gradient(135deg, #86efac, #0ea5e9)",
  "linear-gradient(135deg, #f9a8d4, #fde68a)",
  "linear-gradient(135deg, #7dd3fc, #a555f0)",
  "linear-gradient(180deg, #ffffff, #efe0ff)",
  "linear-gradient(135deg, #292524, #7c3aed)",
];

export function ColorPicker({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const isHex = /^#[0-9a-fA-F]{6}$/.test(value);
  const preview = value || "transparent";
  const previewStyle = value.includes("gradient")
    ? { backgroundImage: value }
    : { backgroundColor: preview };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label="Pick color"
              className="h-9 w-9 shrink-0 rounded-md border shadow-sm"
              style={previewStyle}
            />
          </PopoverTrigger>
          <PopoverContent className="w-72 p-3 space-y-3" align="start">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Pipette className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-xs font-medium">Custom color</span>
              </div>
              <input
                type="color"
                value={isHex ? value : "#a555f0"}
                onChange={(e) => onChange(e.target.value)}
                className="h-9 w-full cursor-pointer rounded-md border bg-transparent"
              />
            </div>
            <div>
              <div className="text-xs font-medium mb-2">Swatches</div>
              <div className="grid grid-cols-6 gap-1.5">
                {SWATCHES.map((c) => (
                  <button
                    key={c}
                    type="button"
                    aria-label={c}
                    onClick={() => onChange(c)}
                    className="h-7 w-7 rounded-md border hover:scale-110 transition-transform"
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
            <div>
              <div className="text-xs font-medium mb-2">Gradients</div>
              <div className="grid grid-cols-4 gap-1.5">
                {GRADIENTS.map((g) => (
                  <button
                    key={g}
                    type="button"
                    aria-label="Gradient"
                    onClick={() => onChange(g)}
                    className="h-8 rounded-md border hover:scale-105 transition-transform"
                    style={{ backgroundImage: g }}
                  />
                ))}
              </div>
            </div>
          </PopoverContent>
        </Popover>
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
        />
      </div>
    </div>
  );
}
