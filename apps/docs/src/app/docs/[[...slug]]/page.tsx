import { DocsBody, DocsDescription, DocsPage, DocsTitle } from "fumadocs-ui/layouts/docs/page";
import { createRelativeLink } from "fumadocs-ui/mdx";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { ComponentType } from "react";
import { getPageImage, source } from "@/lib/source";
import { getMDXComponents } from "@/mdx-components";

type PageParams = {
	slug?: string[];
};

type PageProps = {
	params: Promise<PageParams>;
};

type DocsPageProps = Parameters<typeof DocsPage>[0];

export default async function Page(props: PageProps) {
	const params = await props.params;
	const page = source.getPage(params.slug);
	if (!page) notFound();

	// Fumadocs types do not currently expose MDX fields on PageData.
	const pageData = page.data as typeof page.data & {
		body: ComponentType<Record<string, unknown>>;
		toc: DocsPageProps["toc"];
		full: DocsPageProps["full"];
	};
	const MDX = pageData.body;

	return (
		<DocsPage toc={pageData.toc} full={pageData.full}>
			<DocsTitle>{pageData.title}</DocsTitle>
			<DocsDescription>{pageData.description}</DocsDescription>
			<DocsBody>
				<MDX
					components={getMDXComponents({
						// this allows you to link to other pages with relative file paths
						// eslint-disable-next-line @typescript-eslint/no-explicit-any
						// biome-ignore lint/suspicious/noExplicitAny: fumadocs createRelativeLink return type incompatible with MDXComponents
						a: createRelativeLink(source, page) as any,
					})}
				/>
			</DocsBody>
		</DocsPage>
	);
}

export async function generateStaticParams() {
	const params = source.generateParams();
	// For optional catch-all route [[...slug]], Next.js requires all possible params
	// including the root case (empty slug) for static export
	// Check if we need to add the root case
	const hasRootCase = params.some((p) => p.slug === undefined || (Array.isArray(p.slug) && p.slug.length === 0));
	if (!hasRootCase) {
		// Add root case for /docs route
		return [{ slug: [] }, ...params];
	}
	return params;
}

export async function generateMetadata(props: PageProps): Promise<Metadata> {
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
