import { useEffect } from 'react';
import { assets } from '@/assets/registry';

export interface DocumentMetadata {
  title: string;
  description?: string;
  canonical?: string;
  openGraph: { property: string; content: string }[];
  structuredData: string[];
}

export function useDocumentMetadata(metadata: DocumentMetadata) {
  useEffect(() => {
    document.title = metadata.title;
    document.head
      .querySelectorAll('[data-englishine-page-meta]')
      .forEach((node) => node.remove());
    const add = (element: HTMLElement) => {
      element.dataset.englishinePageMeta = '';
      document.head.appendChild(element);
    };
    if (metadata.description) {
      const meta = document.createElement('meta');
      meta.name = 'description';
      meta.content = metadata.description;
      add(meta);
    }
    for (const item of metadata.openGraph) {
      const meta = document.createElement('meta');
      meta.setAttribute('property', item.property);
      meta.content = item.content;
      add(meta);
    }
    if (metadata.canonical) {
      const link = document.createElement('link');
      link.rel = 'canonical';
      link.href = metadata.canonical;
      add(link);
    }
    for (const source of metadata.structuredData) {
      const script = document.createElement('script');
      script.type = 'application/ld+json';
      script.textContent = source;
      add(script);
    }
    let icon = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    if (!icon) {
      icon = document.createElement('link');
      icon.rel = 'icon';
      document.head.appendChild(icon);
    }
    icon.href = assets.favicon;
  }, [metadata]);
}
