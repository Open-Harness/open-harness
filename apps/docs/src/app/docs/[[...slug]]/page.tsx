import {
  DocsBody,
  DocsDescription,
  DocsPage,
  DocsTitle,
} from "fumadocs-ui/layouts/docs/page";
import { createRelativeLink } from "fumadocs-ui/mdx";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPageImage, source } from "@/lib/source";
import { getMDXComponents } from "@/mdx-components";

export default async function Page(props: PageProps<"/docs/[[...slug]]">) {
  const params = await props.params;
  // #region agent log
  const logData = {
    slug: params.slug,
    slugType: typeof params.slug,
    slugArray: Array.isArray(params.slug) ? params.slug : null,
  };
  console.log("[DEBUG] Page params:", JSON.stringify(logData));
  if (typeof fetch !== "undefined") {
    fetch("http://127.0.0.1:7247/ingest/81b38bdf-96e8-4619-9fbd-725bea09e361", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        location: "page.tsx:16",
        message: "Params resolved",
        data: logData,
        timestamp: Date.now(),
        sessionId: "debug-session",
        runId: "initial",
        hypothesisId: "B",
      }),
    }).catch(() => {});
  }
  // #endregion
  const page = source.getPage(params.slug);
  // #region agent log
  const pageLogData = {
    pageFound: !!page,
    pageTitle: page?.data.title,
    pageSlugs: page?.slugs,
  };
  console.log("[DEBUG] Page lookup:", JSON.stringify(pageLogData));
  if (typeof fetch !== "undefined") {
    fetch("http://127.0.0.1:7247/ingest/81b38bdf-96e8-4619-9fbd-725bea09e361", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        location: "page.tsx:18",
        message: "Page lookup result",
        data: pageLogData,
        timestamp: Date.now(),
        sessionId: "debug-session",
        runId: "initial",
        hypothesisId: "C",
      }),
    }).catch(() => {});
  }
  // #endregion
  if (!page) {
    // #region agent log
    console.log("[DEBUG] Page not found, calling notFound()");
    if (typeof fetch !== "undefined") {
      fetch(
        "http://127.0.0.1:7247/ingest/81b38bdf-96e8-4619-9fbd-725bea09e361",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            location: "page.tsx:20",
            message: "Page not found - 404 triggered",
            data: { slug: params.slug },
            timestamp: Date.now(),
            sessionId: "debug-session",
            runId: "initial",
            hypothesisId: "C",
          }),
        },
      ).catch(() => {});
    }
    // #endregion
    notFound();
  }

  const MDX = page.data.body;

  return (
    <DocsPage toc={page.data.toc} full={page.data.full}>
      <DocsTitle>{page.data.title}</DocsTitle>
      <DocsDescription>{page.data.description}</DocsDescription>
      <DocsBody>
        <MDX
          components={getMDXComponents({
            // this allows you to link to other pages with relative file paths
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            a: createRelativeLink(source, page) as any,
          })}
        />
      </DocsBody>
    </DocsPage>
  );
}

export async function generateStaticParams() {
  // #region agent log
  const params = source.generateParams();
  console.log(
    "[DEBUG] generateStaticParams result:",
    JSON.stringify({
      count: params.length,
      firstFew: params.slice(0, 3),
      firstType: typeof params[0],
      firstKeys: params[0] ? Object.keys(params[0]) : null,
    }),
  );
  if (typeof fetch !== "undefined") {
    fetch("http://127.0.0.1:7247/ingest/81b38bdf-96e8-4619-9fbd-725bea09e361", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        location: "page.tsx:59",
        message: "generateStaticParams result",
        data: {
          paramCount: params.length,
          firstFewParams: params.slice(0, 3),
          firstType: typeof params[0],
          firstKeys: params[0] ? Object.keys(params[0]) : null,
        },
        timestamp: Date.now(),
        sessionId: "debug-session",
        runId: "post-fix",
        hypothesisId: "D",
      }),
    }).catch(() => {});
  }
  // #endregion

  // Fumadocs already returns params in the correct format: [{ slug: string[] | undefined }]
  // For optional catch-all [[...slug]], empty array [] represents root route
  return params;
}

export async function generateMetadata(
  props: PageProps<"/docs/[[...slug]]">,
): Promise<Metadata> {
  const params = await props.params;
  const page = source.getPage(params.slug);
  if (!page) notFound();

  return {
    title: page.data.title,
    description: page.data.description,
    openGraph: {
      images: getPageImage(page).url,
    },
  };
}
