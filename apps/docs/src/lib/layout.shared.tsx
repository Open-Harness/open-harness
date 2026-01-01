import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';

export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: 'Open Harness',
    },
    sidebar: {
      tabs: false,
    },
  };
}
