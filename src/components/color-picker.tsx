import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Pipette, Plus, X } from "lucide-react";

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

const PRESETS_KEY = "color-picker-custom-presets";

function loadPresets(): string[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(PRESETS_KEY) || "[]"); } catch { return []; }
}

function savePresets(list: string[]) {
  if (typeof window !== "undefined") localStorage.setItem(PRESETS_KEY, JSON.stringify(list));
}

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
  const [presets, setPresets] = useState<string[]>([]);
  useEffect(() => { setPresets(loadPresets()); }, [open]);

  const isHex = /^#[0-9a-fA-F]{6}$/.test(value);
  const preview = value || "transparent";
  const previewStyle = value.includes("gradient")
    ? { backgroundImage: value }
    : { backgroundColor: preview };

  function addPreset() {
    if (!value) return;
    if (presets.includes(value)) return;
    const next = [value, ...presets].slice(0, 24);
    setPresets(next);
    savePresets(next);
  }

  function removePreset(c: string) {
    const next = presets.filter((p) => p !== c);
    setPresets(next);
    savePresets(next);
  }

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
          <PopoverContent className="w-72 p-3 space-y-3 max-h-[70vh] overflow-y-auto" align="start">
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
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium">My presets</span>
                <button
                  type="button"
                  onClick={addPreset}
                  disabled={!value || presets.includes(value)}
                  className="text-xs flex items-center gap-1 text-primary hover:underline disabled:opacity-40 disabled:no-underline"
                >
                  <Plus className="w-3 h-3" /> Save current
                </button>
              </div>
              {presets.length === 0 ? (
                <p className="text-[11px] text-muted-foreground">No saved presets yet.</p>
              ) : (
                <div className="grid grid-cols-6 gap-1.5">
                  {presets.map((c) => (
                    <div key={c} className="relative group">
                      <button
                        type="button"
                        aria-label={c}
                        onClick={() => onChange(c)}
                        className="h-7 w-7 rounded-md border hover:scale-110 transition-transform"
                        style={c.includes("gradient") ? { backgroundImage: c } : { backgroundColor: c }}
                      />
                      <button
                        type="button"
                        onClick={() => removePreset(c)}
                        aria-label="Remove preset"
                        className="absolute -top-1 -right-1 opacity-0 group-hover:opacity-100 bg-background border rounded-full p-0.5 shadow"
                      >
                        <X className="w-2.5 h-2.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
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
