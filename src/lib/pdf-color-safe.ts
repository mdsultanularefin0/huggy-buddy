// Walks the cloned DOM used by html2canvas and rewrites every computed color
// that still resolves to oklch(...) into an sRGB rgb() string. html2canvas /
// jsPDF cannot parse oklch, so without this any Tailwind v4 default color
// (which is oklch under the hood) crashes PDF export.
export function normalizeOklchInClone(clonedDoc: Document, clonedEl: HTMLElement) {
  const win = clonedDoc.defaultView;
  if (!win) return;
  const ctx = clonedDoc.createElement("canvas").getContext("2d");
  if (!ctx) return;

  // Convert any CSS color string (including oklch) → rgb() via the browser's
  // own color parser. Canvas 2D fillStyle supports oklch in modern browsers
  // and normalizes to "#rrggbb"/"rgba(...)" on read.
  const toRgb = (v: string): string => {
    try {
      ctx.fillStyle = "#000";
      ctx.fillStyle = v;
      const out = ctx.fillStyle as string;
      if (!out || out.includes("oklch") || out.includes("oklab") || out.includes("color("))
        return "rgb(0,0,0)";
      return out;
    } catch {
      return "rgb(0,0,0)";
    }
  };

  // Replace every oklch(...) / oklab(...) / color(...) occurrence inside an
  // arbitrary CSS value (handles gradients, shadows, borders shorthand, etc).
  const replaceFns = (input: string): string => {
    if (!input) return input;
    if (!/oklch\(|oklab\(|color\(/i.test(input)) return input;
    let out = "";
    let i = 0;
    while (i < input.length) {
      const rest = input.slice(i);
      const m = rest.match(/(oklch|oklab|color)\(/i);
      if (!m || m.index === undefined) {
        out += rest;
        break;
      }
      out += rest.slice(0, m.index);
      let depth = 1;
      let j = m.index + m[0].length;
      while (j < rest.length && depth > 0) {
        const ch = rest[j];
        if (ch === "(") depth++;
        else if (ch === ")") depth--;
        j++;
      }
      const full = rest.slice(m.index, j);
      out += toRgb(full);
      i += j;
    }
    return out;
  };

  // 1) Rewrite all stylesheet rules so pseudo-elements and inherited vars are safe.
  const sheets = Array.from(clonedDoc.styleSheets) as CSSStyleSheet[];
  for (const sheet of sheets) {
    let rules: CSSRuleList | null = null;
    try { rules = sheet.cssRules; } catch { continue; }
    if (!rules) continue;
    const visit = (rule: CSSRule) => {
      if (rule instanceof win.CSSStyleRule || (rule as CSSStyleRule).style) {
        const style = (rule as CSSStyleRule).style;
        if (!style) return;
        for (let k = 0; k < style.length; k++) {
          const prop = style.item(k);
          const val = style.getPropertyValue(prop);
          if (val && /oklch\(|oklab\(|color\(/i.test(val)) {
            const priority = style.getPropertyPriority(prop);
            try { style.setProperty(prop, replaceFns(val), priority); } catch { /* ignore */ }
          }
        }
      }
      // Recurse into grouping rules (media, supports, layer, etc).
      const inner = (rule as unknown as { cssRules?: CSSRuleList }).cssRules;
      if (inner) for (let k = 0; k < inner.length; k++) visit(inner[k]);
    };
    for (let k = 0; k < rules.length; k++) visit(rules[k]);
  }

  // 2) Belt-and-braces: rewrite inline styles + computed longhand colors on every element.
  const props: string[] = [
    "color",
    "background-color",
    "border-top-color",
    "border-right-color",
    "border-bottom-color",
    "border-left-color",
    "outline-color",
    "text-decoration-color",
    "fill",
    "stroke",
    "column-rule-color",
    "caret-color",
    "box-shadow",
    "background-image",
    "background",
  ];

  const walk = (el: Element) => {
    const cs = win.getComputedStyle(el);
    const style = (el as HTMLElement).style;
    for (const p of props) {
      const v = cs.getPropertyValue(p);
      if (v && /oklch\(|oklab\(|color\(/i.test(v)) {
        try { style.setProperty(p, replaceFns(v)); } catch { /* ignore */ }
      }
    }
  };

  walk(clonedEl);
  clonedEl.querySelectorAll<Element>("*").forEach(walk);
}
