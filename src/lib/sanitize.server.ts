import sanitizeHtml from "sanitize-html";

const RICH_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    "p", "br", "hr", "strong", "b", "em", "i", "u", "s", "code", "pre",
    "blockquote", "ul", "ol", "li", "a",
    "h1", "h2", "h3", "h4", "h5", "h6",
    "span", "div",
    "img", "figure", "figcaption",
    "video", "source", "iframe",
  ],
  allowedAttributes: {
    a: ["href", "title", "target", "rel"],
    img: ["src", "alt", "title", "width", "height", "loading", "style"],
    video: ["src", "controls", "autoplay", "muted", "loop", "playsinline", "poster", "width", "height", "style"],
    source: ["src", "type"],
    iframe: [
      "src", "width", "height", "title", "allow", "allowfullscreen",
      "frameborder", "referrerpolicy", "loading", "style",
    ],
    "*": ["style"],
  },
  allowedSchemes: ["http", "https", "mailto", "tel", "data"],
  allowedSchemesAppliedToAttributes: ["href", "src"],
  allowedIframeHostnames: [
    "www.youtube.com", "youtube.com", "youtube-nocookie.com", "www.youtube-nocookie.com",
    "player.vimeo.com", "vimeo.com",
  ],
  allowProtocolRelative: false,
  disallowedTagsMode: "discard",
  allowedStyles: {
    "*": {
      "max-width": [/^\d+(?:\.\d+)?(?:px|%|rem|em)$/],
      "width": [/^\d+(?:\.\d+)?(?:px|%|rem|em|auto)$/],
      "height": [/^\d+(?:\.\d+)?(?:px|%|rem|em|auto)$/],
      "border-radius": [/^\d+(?:\.\d+)?(?:px|%|rem|em)$/],
      "aspect-ratio": [/^\d+\s*\/\s*\d+$/],
      "text-align": [/^(?:left|right|center|justify)$/],
      "float": [/^(?:left|right|none)$/],
      "margin": [/^[\w\s.%-]+$/],
      "display": [/^(?:block|inline|inline-block|flex|none)$/],
    },
  },
  transformTags: {
    a: (tagName, attribs) => ({
      tagName: "a",
      attribs: {
        ...attribs,
        rel: "noopener noreferrer nofollow",
        target: attribs.target === "_blank" ? "_blank" : "_self",
      },
    }),
    img: (tagName, attribs) => ({
      tagName: "img",
      attribs: { loading: "lazy", ...attribs },
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
