import { siteUrl } from "@/lib/env";
import { getSitemapEntries, STATIC_PAGES, urlsetXml, xmlResponse } from "@/lib/data/sitemap";

// Карта сайта одного раздела: /sitemaps/biznes.xml, /sitemaps/specialisty.xml, /sitemaps/pages.xml.
export function generateStaticParams() {
  return [{ file: "pages.xml" }, { file: "biznes.xml" }, { file: "specialisty.xml" }];
}

export async function GET(_: Request, { params }: RouteContext<"/sitemaps/[file]">) {
  const { file } = await params;
  const base = siteUrl();
  if (file === "pages.xml") return xmlResponse(urlsetXml(base, STATIC_PAGES.map((path) => ({ path }))));
  if (file !== "biznes.xml" && file !== "specialisty.xml") return new Response("Not found", { status: 404 });
  const section = file.replace(".xml", "");
  const entries = (await getSitemapEntries()).filter((e) => e.section === section);
  return xmlResponse(urlsetXml(base, entries));
}
