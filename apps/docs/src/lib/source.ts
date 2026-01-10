import { docs } from "fumadocs-mdx:collections/server";
import { type InferPageType, loader } from "fumadocs-core/source";
import { lucideIconsPlugin } from "fumadocs-core/source/lucide-icons";

// See https://fumadocs.dev/docs/headless/source-api for more info
export const source = loader({
	baseUrl: "/docs",
	source: docs.toFumadocsSource(),
	plugins: [lucideIconsPlugin()],
});

export function getPageImage(page: InferPageType<typeof source>) {
	const segments = [...page.slugs, "image.png"];

	return {
		segments,
		url: `/og/docs/${segments.join("/")}`,
	};
}

export async function getLLMText(page: InferPageType<typeof source>) {
	// Fumadocs types do not currently expose getText on PageData.
	const data = page.data as typeof page.data & {
		getText: (variant: string) => Promise<string>;
	};
	const processed = await data.getText("processed");

	return `# ${page.data.title}

${processed}`;
}
