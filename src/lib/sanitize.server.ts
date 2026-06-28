import sanitizeHtml from "sanitize-html";

const RICH_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    "p", "br", "hr", "strong", "b", "em", "i", "u", "s", "code", "pre",
    "blockquote", "ul", "ol", "li", "a",
    "h1", "h2", "h3", "h4", "h5", "h6",
    "span", "div",
  ],
  allowedAttributes: {
    a: ["href", "title", "target", "rel"],
    "*": [],
  },
  allowedSchemes: ["http", "https", "mailto", "tel"],
  allowedSchemesAppliedToAttributes: ["href"],
  allowProtocolRelative: false,
  disallowedTagsMode: "discard",
  transformTags: {
    a: (tagName, attribs) => ({
      tagName: "a",
      attribs: {
        ...attribs,
        rel: "noopener noreferrer nofollow",
        target: attribs.target === "_blank" ? "_blank" : "_self",
      },
    }),
  },
};

export function sanitizeRichHtml(input: unknown): string {
  if (typeof input !== "string") return "";
  return sanitizeHtml(input, RICH_OPTIONS);
}

export function sanitizePlainText(input: unknown): string {
  if (typeof input !== "string") return "";
  return sanitizeHtml(input, { allowedTags: [], allowedAttributes: {} }).trim();
}
