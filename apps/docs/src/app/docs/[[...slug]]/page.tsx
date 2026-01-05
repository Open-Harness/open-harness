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
	params: PageParams;
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
	return source.generateParams();
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
