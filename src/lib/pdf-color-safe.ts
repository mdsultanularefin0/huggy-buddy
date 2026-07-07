// Walks the cloned DOM used by html2canvas and rewrites every computed color
// that still resolves to oklch(...) into an sRGB rgb() string. html2canvas /
// jsPDF cannot parse oklch, so without this any Tailwind v4 default color
// (which is oklch under the hood) crashes PDF export.
export function normalizeOklchInClone(clonedDoc: Document, clonedEl: HTMLElement) {
  const win = clonedDoc.defaultView;
  if (!win) return;
  const ctx = clonedDoc.createElement("canvas").getContext("2d");
  if (!ctx) return;

  const toRgb = (v: string): string => {
    try {
      ctx.fillStyle = "#000";
      ctx.fillStyle = v;
      const out = ctx.fillStyle as string;
      return out.includes("oklch") ? "rgb(0,0,0)" : out;
    } catch {
      return "rgb(0,0,0)";
    }
  };

  const props: (keyof CSSStyleDeclaration)[] = [
    "color",
    "backgroundColor",
    "borderTopColor",
    "borderRightColor",
    "borderBottomColor",
    "borderLeftColor",
    "outlineColor",
    "textDecorationColor",
    "fill",
    "stroke",
    "columnRuleColor",
    "caretColor",
  ];

  const walk = (el: Element) => {
    const cs = win.getComputedStyle(el);
    const style = (el as HTMLElement).style;
    for (const p of props) {
      const v = cs[p] as string | undefined;
      if (v && v.includes("oklch")) style[p as string] = toRgb(v);
    }
    // Background images (gradients) that use oklch — strip to none as fallback.
    const bg = cs.backgroundImage;
    if (bg && bg.includes("oklch")) style.backgroundImage = "none";
  };

  walk(clonedEl);
  clonedEl.querySelectorAll<Element>("*").forEach(walk);
}
