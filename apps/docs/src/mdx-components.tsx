import defaultMdxComponents from 'fumadocs-ui/mdx';
import { Banner } from 'fumadocs-ui/components/banner';
import { Steps, Step } from 'fumadocs-ui/components/steps';
import { Accordions, Accordion } from 'fumadocs-ui/components/accordion';
import { GithubInfo } from 'fumadocs-ui/components/github-info';
import { TypeTable } from 'fumadocs-ui/components/type-table';
import { Mermaid } from '@/components/mdx/mermaid';
import type { MDXComponents } from 'mdx/types';

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
