import { docs } from "fumadocs-mdx:collections/server";
import { type InferPageType, loader } from "fumadocs-core/source";
import { lucideIconsPlugin } from "fumadocs-core/source/lucide-icons";

// See https://fumadocs.dev/docs/headless/source-api for more info
const baseUrl = "/docs";
// #region agent log
if (typeof fetch !== 'undefined') {
  fetch('http://127.0.0.1:7247/ingest/81b38bdf-96e8-4619-9fbd-725bea09e361',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'source.ts:7',message:'Source loader config',data:{baseUrl},timestamp:Date.now(),sessionId:'debug-session',runId:'initial',hypothesisId:'A'})}).catch(()=>{});
}
// #endregion
export const source = loader({
  baseUrl,
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
  const processed = await page.data.getText("processed");

  return `# ${page.data.title}

${processed}`;
}
