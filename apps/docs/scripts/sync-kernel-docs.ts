import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

type SyncOptions = {
  srcRootAbs: string;
  dstRootAbs: string;
};

type MdLink = {
  fullMatch: string;
  href: string;
  start: number;
  end: number;
};

function isExternalHref(href: string): boolean {
  return (
    href.startsWith("http://") ||
    href.startsWith("https://") ||
    href.startsWith("mailto:") ||
    href.startsWith("tel:") ||
    href.startsWith("#")
  );
}

function splitHref(href: string): { pathPart: string; suffix: string } {
  const hashIdx = href.indexOf("#");
  const queryIdx = href.indexOf("?");
  const idx =
    hashIdx === -1
      ? queryIdx
      : queryIdx === -1
        ? hashIdx
        : Math.min(hashIdx, queryIdx);

  if (idx === -1) return { pathPart: href, suffix: "" };
  return { pathPart: href.slice(0, idx), suffix: href.slice(idx) };
}

function rewriteHref(href: string): string {
  if (isExternalHref(href)) return href;
  const { pathPart, suffix } = splitHref(href);
  if (!pathPart.endsWith(".md")) return href;

  const parts = pathPart.split("/");
  const last = parts[parts.length - 1] ?? "";

  if (last.toLowerCase() === "readme.md") {
    parts[parts.length - 1] = "index.mdx";
    return `${parts.join("/")}${suffix}`;
  }

  parts[parts.length - 1] = last.replace(/\.md$/i, ".mdx");
  return `${parts.join("/")}${suffix}`;
}

function findMarkdownLinks(markdown: string): MdLink[] {
  const regex = /\[[^\]]*?\]\(([^)\s]+)\)/g;
  const matches: MdLink[] = [];
  let m: RegExpExecArray | null;
  while ((m = regex.exec(markdown)) !== null) {
    const fullMatch = m[0];
    const href = m[1] ?? "";
    const start = m.index;
    const end = start + fullMatch.length;

    // filter out images: ![alt](href)
    const prevChar = start > 0 ? markdown[start - 1] : "";
    if (prevChar === "!") continue;

    matches.push({ fullMatch, href, start, end });
  }
  return matches;
}

function extractTitleAndDescription(markdown: string): {
  title: string;
  description: string;
  bodyWithoutH1: string;
} {
  const lines = markdown.split(/\r?\n/);

  let i = 0;
  while (i < lines.length && (lines[i]?.trim() ?? "") === "") i++;

  let title = "Untitled";
  let bodyStart = i;

  const h1 = lines[i] ?? "";
  const h1Match = /^#\s+(.*)\s*$/.exec(h1);
  if (h1Match) {
    title = (h1Match[1] ?? "").trim() || title;
    bodyStart = i + 1;
  }

  let j = bodyStart;
  while (j < lines.length && (lines[j]?.trim() ?? "") === "") j++;
  const para: string[] = [];
  while (j < lines.length) {
    const line = lines[j] ?? "";
    if (line.trim() === "") break;
    if (/^#{1,6}\s+/.test(line)) break;
    para.push(line);
    j++;
  }
  let description = para.join(" ").replace(/\s+/g, " ").trim();
  if (description.length > 180) description = `${description.slice(0, 177)}...`;

  const bodyWithoutH1 = lines
    .slice(bodyStart)
    .join("\n")
    .replace(/^\s*\n/, "");

  return { title, description, bodyWithoutH1 };
}

function toFrontmatter(title: string, description: string): string {
  const safeTitle = title.replace(/"/g, '\\"');
  const safeDesc = description.replace(/"/g, '\\"');
  return `---\ntitle: "${safeTitle}"\ndescription: "${safeDesc}"\n---\n\n`;
}

async function walkFiles(absDir: string): Promise<string[]> {
  const entries = await readdir(absDir, { withFileTypes: true });
  const out: string[] = [];
  for (const ent of entries) {
    const abs = path.join(absDir, ent.name);
    if (ent.isDirectory()) out.push(...(await walkFiles(abs)));
    else if (ent.isFile()) out.push(abs);
  }
  return out;
}

function toPosix(p: string): string {
  return p.split(path.sep).join(path.posix.sep);
}

function dstPathForSrc(srcRelPosix: string): string {
  const parts = srcRelPosix.split("/");
  const last = parts[parts.length - 1] ?? "";
  const isReadme = last.toLowerCase() === "readme.md";

  if (isReadme) {
    parts[parts.length - 1] = "index.mdx";
    return parts.join("/");
  }

  if (last.toLowerCase().endsWith(".md")) {
    parts[parts.length - 1] = last.replace(/\.md$/i, ".mdx");
    return parts.join("/");
  }

  return parts.join("/");
}

async function syncKernelDocs({ srcRootAbs, dstRootAbs }: SyncOptions) {
  await rm(dstRootAbs, { recursive: true, force: true });
  await mkdir(dstRootAbs, { recursive: true });

  const srcFilesAbs = await walkFiles(srcRootAbs);
  const mdFilesAbs = srcFilesAbs.filter((p) => p.toLowerCase().endsWith(".md"));

  for (const srcAbs of mdFilesAbs) {
    const rel = toPosix(path.relative(srcRootAbs, srcAbs));
    const dstRel = dstPathForSrc(rel);
    const dstAbs = path.join(dstRootAbs, dstRel);

    await mkdir(path.dirname(dstAbs), { recursive: true });

    const raw = await readFile(srcAbs, "utf8");

    // Rewrite markdown links (extension + README mapping)
    let rewritten = raw;
    const links = findMarkdownLinks(raw);
    // Apply replacements from end to start to preserve indices
    for (let k = links.length - 1; k >= 0; k--) {
      const link = links[k]!;
      const newHref = rewriteHref(link.href);
      if (newHref === link.href) continue;
      rewritten =
        rewritten.slice(0, link.start) +
        link.fullMatch.replace(link.href, newHref) +
        rewritten.slice(link.end);
    }

    // Extract Mermaid code blocks to preserve them from escaping
    // Mermaid needs literal characters, not HTML entities
    const mermaidBlocks: string[] = [];
    const mermaidPlaceholder = (index: number) => `__MERMAID_BLOCK_${index}__`;
    rewritten = rewritten.replace(
      /```mermaid\n([\s\S]*?)```/g,
      (match: string, _content: string) => {
        const index = mermaidBlocks.length;
        mermaidBlocks.push(match); // Store the entire block including ```mermaid and ```
        return mermaidPlaceholder(index);
      },
    );

    // Fix MDX parsing issues:
    // 1. Escape curly braces and angle brackets in inline code (MDX tries to parse them as JSX)
    // Pattern: `{...}` or `<...>` -> escape as HTML entities
    rewritten = rewritten.replace(
      /`([^`]*?)`/g,
      (match: string, content: string) => {
        // Only escape if content contains braces or angle brackets that could be parsed as JSX
        if (content.includes("{") || content.includes("<")) {
          const escaped = content
            .replace(/\{/g, "&#123;")
            .replace(/\}/g, "&#125;")
            .replace(/</g, "&#60;")
            .replace(/>/g, "&#62;");
          return `\`${escaped}\``;
        }
        return match; // No escaping needed
      },
    );

    // 2. Escape < followed by numbers or letters in specific contexts (MDX tries to parse as JSX tags)
    // Pattern: <100ms, <1s, <json>, etc. -> &lt;100ms, &lt;1s, &lt;json>
    // Escape < in code blocks and when followed by numbers/letters that aren't HTML tags
    rewritten = rewritten.replace(
      /`([^`]*<[a-zA-Z0-9]+[^`]*)`/g,
      (_match: string, content: string) => {
        // Escape < inside code blocks if it's not part of a valid HTML tag pattern
        return `\`${content.replace(
          /<([a-zA-Z0-9]+)/g,
          (m: string, tag: string) => {
            // Don't escape common HTML tags
            const htmlTags = [
              "code",
              "div",
              "span",
              "p",
              "a",
              "strong",
              "em",
              "ul",
              "ol",
              "li",
              "h1",
              "h2",
              "h3",
              "h4",
              "h5",
              "h6",
            ];
            if (htmlTags.includes(tag.toLowerCase())) {
              return m;
            }
            return `&lt;${tag}`;
          },
        )}\``;
      },
    );

    // Also escape standalone < followed by numbers (outside code blocks)
    rewritten = rewritten.replace(
      /(?<!`)(?<!&lt;)<(\d+[a-zA-Z]*)/g,
      (_match: string, rest: string) => {
        return `&lt;${rest}`;
      },
    );

    // 3. Fix headings with backticks and parentheses that cause parsing errors
    // Pattern: ### Title (`path`) - MDX has trouble parsing this
    // Solution: Remove backticks from headings, keep just the path in parentheses
    rewritten = rewritten.replace(
      /^(#{1,6}\s+[^(]*?)\(`([^`]+)`\)/gm,
      (_match: string, heading: string, path: string) => {
        // Remove backticks, keep path in parentheses
        return `${heading}(${path})`;
      },
    );

    // Restore Mermaid code blocks (unchanged, no escaping applied)
    for (let i = 0; i < mermaidBlocks.length; i++) {
      rewritten = rewritten.replace(mermaidPlaceholder(i), mermaidBlocks[i]!);
    }

    const { title, description, bodyWithoutH1 } =
      extractTitleAndDescription(rewritten);
    const fm = toFrontmatter(title, description);

    const isRootIndex = dstRel === "index.mdx";
    const generatedNote = isRootIndex
      ? `> **Generated page.** Edit the source at \`packages/kernel/docs/README.md\`.\n\n`
      : "";

    const out = `${fm}${generatedNote}${bodyWithoutH1}`;
    await writeFile(dstAbs, out, "utf8");
  }

  // Generate meta.json files so sidebar ordering stays stable even though this folder is regenerated.
  await writeKernelSpecMeta(dstRootAbs);
}

function titleFromDirName(dirName: string): string {
  const map: Record<string, string> = {
    "": "Kernel Spec",
    spec: "Kernel Protocol",
    flow: "Flow Protocol",
    testing: "Testing",
    implementation: "Implementation",
    decisions: "Decisions",
    reference: "Reference",
    patterns: "Patterns",
  };
  return map[dirName] ?? dirName.replace(/-/g, " ");
}

async function writeJson(absPath: string, data: unknown) {
  await writeFile(absPath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

async function listDirsAndMdxFiles(absDir: string): Promise<{
  subdirs: string[];
  mdxFiles: string[];
}> {
  const entries = await readdir(absDir, { withFileTypes: true });
  const subdirs: string[] = [];
  const mdxFiles: string[] = [];

  for (const ent of entries) {
    if (ent.isDirectory()) subdirs.push(ent.name);
    else if (ent.isFile() && ent.name.toLowerCase().endsWith(".mdx"))
      mdxFiles.push(ent.name);
  }

  subdirs.sort();
  mdxFiles.sort();
  return { subdirs, mdxFiles };
}

function slugFromMdxFilename(filename: string): string {
  return filename.replace(/\.mdx$/i, "");
}

async function writeKernelSpecMeta(dstRootAbs: string) {
  // Root meta groups top-level dirs in a predictable order.
  const rootMeta = {
    title: "Kernel Spec",
    pages: [
      "index",
      "spec/...",
      "flow/...",
      "testing/...",
      "implementation/...",
      "decisions/...",
      "reference/...",
    ],
  };
  await writeJson(path.join(dstRootAbs, "meta.json"), rootMeta);

  // Per-directory meta: index first, then remaining pages.
  const allDirsAbs = await (async () => {
    const dirs: string[] = [dstRootAbs];
    const queue: string[] = [dstRootAbs];
    while (queue.length) {
      const cur = queue.shift()!;
      const { subdirs } = await listDirsAndMdxFiles(cur);
      for (const d of subdirs) {
        const next = path.join(cur, d);
        dirs.push(next);
        queue.push(next);
      }
    }
    return dirs;
  })();

  for (const dirAbs of allDirsAbs) {
    const relPosix = toPosix(path.relative(dstRootAbs, dirAbs));
    const dirName = relPosix === "" ? "" : relPosix.split("/").slice(-1)[0]!;

    const { subdirs, mdxFiles } = await listDirsAndMdxFiles(dirAbs);
    const slugs = mdxFiles.map(slugFromMdxFilename);
    const pages: string[] = [];

    if (slugs.includes("index")) pages.push("index");
    for (const s of slugs) {
      if (s === "index") continue;
      pages.push(s);
    }
    for (const d of subdirs) {
      pages.push(`${d}/...`);
    }

    const meta = {
      title: titleFromDirName(dirName),
      pages,
    };
    await writeJson(path.join(dirAbs, "meta.json"), meta);
  }
}

async function main() {
  // Running from apps/docs
  const repoRoot = path.resolve(process.cwd(), "../..");
  const srcRootAbs = path.join(repoRoot, "packages/kernel/docs");
  const dstRootAbs = path.join(
    repoRoot,
    "apps/docs/content/docs/reference/kernel-spec",
  );

  await syncKernelDocs({ srcRootAbs, dstRootAbs });
  // eslint-disable-next-line no-console
  console.log(`Synced kernel docs: ${srcRootAbs} -> ${dstRootAbs} (md -> mdx)`);
}

await main();
