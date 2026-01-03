import { Accordion, Accordions } from "fumadocs-ui/components/accordion";
import { Banner } from "fumadocs-ui/components/banner";
import { GithubInfo } from "fumadocs-ui/components/github-info";
import { Step, Steps } from "fumadocs-ui/components/steps";
import { TypeTable } from "fumadocs-ui/components/type-table";
import defaultMdxComponents from "fumadocs-ui/mdx";
import type { MDXComponents } from "mdx/types";
import { Mermaid } from "@/components/mdx/mermaid";

export function getMDXComponents(components?: MDXComponents): MDXComponents {
  // Type assertion needed for React 19 compatibility with fumadocs
  return {
    ...defaultMdxComponents,
    Mermaid,
    Banner,
    Steps,
    Step,
    Accordions,
    Accordion,
    GithubInfo,
    TypeTable,
    ...components,
  } as MDXComponents;
}
