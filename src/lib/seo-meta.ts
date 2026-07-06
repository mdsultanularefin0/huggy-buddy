// Small helper to produce consistent per-route meta + canonical.
// Keeps og:url and canonical self-referencing the current page so crawlers
// attribute per-page metadata correctly.

const SITE = "https://heart-hug-light.lovable.app";

export function pageMeta(opts: {
  path: string; // e.g. "/about"
  title: string;
  description: string;
  ogType?: string; // defaults to "website"
  image?: string; // absolute URL only
}) {
  const url = `${SITE}${opts.path}`;
  const meta: Array<Record<string, string>> = [
    { title: opts.title },
    { name: "description", content: opts.description },
    { property: "og:title", content: opts.title },
    { property: "og:description", content: opts.description },
    { property: "og:type", content: opts.ogType ?? "website" },
    { property: "og:url", content: url },
    { name: "twitter:title", content: opts.title },
    { name: "twitter:description", content: opts.description },
  ];
  if (opts.image) {
    meta.push({ property: "og:image", content: opts.image });
    meta.push({ name: "twitter:image", content: opts.image });
  }
  return {
    meta,
    links: [{ rel: "canonical", href: url }],
  };
}
