import sanitizeHtml from "sanitize-html";

/**
 * A job's description_html is untrusted: it is typed into Salesforce / the old
 * site's editor and could hold anything. Only this allow-list reaches the page:
 *   p, br, ul, ol, li, strong, b, em, u, h2–h4, and a[href] to https: or mailto:.
 * Every other tag is dropped (its text kept); script/style/iframe content is
 * dropped whole. No attributes survive except a link's href, and links get a
 * fixed rel/target. h1 becomes h2 (the page has its own h1), h5/h6 become h4.
 */
const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: ["p", "br", "ul", "ol", "li", "strong", "b", "em", "u", "a", "h2", "h3", "h4"],
  allowedAttributes: { a: ["href", "target", "rel"] },
  allowedSchemes: ["https", "mailto"],
  allowedSchemesByTag: { a: ["https", "mailto"] },
  allowedSchemesAppliedToAttributes: ["href"],
  allowProtocolRelative: false,
  disallowedTagsMode: "discard",
  nonTextTags: ["script", "style", "textarea", "option", "noscript", "iframe", "object", "embed", "svg", "math", "template"],
  transformTags: {
    h1: "h2",
    h5: "h4",
    h6: "h4",
    a: (tagName, input) => {
      const href = (input.href ?? "").trim();
      // Any other scheme (javascript:, http:, protocol-relative…) loses the link but keeps its text: an <a>
      // without href is inert. (Changing the tag name here would mismatch sanitize-html's closing tag.)
      if (!/^(https:\/\/|mailto:)/i.test(href)) return { tagName, attribs: {} };
      const attribs: Record<string, string> = /^https:\/\//i.test(href)
        ? { href, target: "_blank", rel: "noopener noreferrer nofollow" }
        : { href };
      return { tagName, attribs };
    },
  },
  // Empty paragraphs say nothing.
  exclusiveFilter: (frame) => frame.tag === "p" && !frame.text.trim() && !frame.mediaChildren.length,
};

export function sanitizeDescription(html: string | null | undefined): string {
  if (!html) return "";
  return sanitizeHtml(html, OPTIONS).trim();
}

/** Plain text of a description, for the meta description. */
export function descriptionText(html: string | null | undefined, max = 160): string {
  if (!html) return "";
  const text = sanitizeHtml(html, { allowedTags: [], allowedAttributes: {} })
    .replace(/&nbsp;/g, " ")
    .replace(/&(amp|lt|gt|quot|#39);/g, (_, e: string) => ({ amp: "&", lt: "<", gt: ">", quot: '"', "#39": "'" })[e]!)
    .replace(/\s+/g, " ")
    .trim();
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}
