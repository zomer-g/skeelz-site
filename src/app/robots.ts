import type { MetadataRoute } from "next";

/** Admin-only preview: nothing may be crawled. At launch this becomes the public site's robots.txt. */
export default function robots(): MetadataRoute.Robots {
  return { rules: [{ userAgent: "*", disallow: "/" }] };
}
