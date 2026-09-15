import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { assets, resolveAssetReferences } from '@/assets/registry';
import { useDocumentMetadata } from '@/hooks/useDocumentMetadata';
import type { DocumentMetadata } from '@/hooks/useDocumentMetadata';

interface ParsedDocument {
  bodyClass: string;
  route?: string;
  markup: string;
  metadata: DocumentMetadata;
}

const focusedPublicLinks = [
  { href: '/', label: 'الرئيسية' },
  { href: '/about', label: 'عن مستر أحمد' },
  { href: '/contact', label: 'تواصل معنا' },
  { href: '/login/', label: 'تسجيل الدخول' },
  { href: '/signup/', label: 'إنشاء حساب' },
];

function applyFocusedPublicNavigation(documentSource: Document) {
  const links = focusedPublicLinks
    .map(({ href, label }) => `<li><a href="${href}">${label}</a></li>`)
    .join('');
  documentSource
    .querySelectorAll<HTMLElement>('.navbar .nav-links')
    .forEach((navigation) => {
      navigation.innerHTML = links;
    });
  documentSource
    .querySelectorAll<HTMLElement>('.mobile-menu')
    .forEach((navigation) => {
      const closeButton = navigation.querySelector('button');
      navigation.querySelectorAll(':scope > a').forEach((anchor) => anchor.remove());
      const mobileLinks = focusedPublicLinks
        .map(({ href, label }) => `<a href="${href}">${label}</a>`)
        .join('');
      (closeButton ?? navigation).insertAdjacentHTML('afterend', mobileLinks);
    });
  documentSource
    .querySelectorAll<HTMLAnchorElement>('.navbar .nav-cta > a')
    .forEach((action) => {
      action.href = '/signup/';
      action.textContent = 'إنشاء حساب';
    });
  const footerPlatform = Array.from(
    documentSource.querySelectorAll<HTMLElement>('.footer-col'),
  ).find((column) => column.querySelector('h4')?.textContent?.trim() === 'المنصة');
  if (footerPlatform) {
    footerPlatform.querySelectorAll('a').forEach((anchor) => anchor.remove());
    footerPlatform.insertAdjacentHTML(
      'beforeend',
      focusedPublicLinks
        .map(({ href, label }) => `<a href="${href}">${label}</a>`)
        .join(''),
    );
  }
}

function parseDocument(source: string): ParsedDocument {
  const documentSource = new DOMParser().parseFromString(source, 'text/html');
  applyFocusedPublicNavigation(documentSource);
  if (documentSource.querySelector('#hero')) {
    documentSource
      .querySelectorAll('#video-library, #top-students, #certifications, #subscriptions')
      .forEach((section) => section.remove());
    documentSource
      .querySelectorAll<HTMLAnchorElement>('.home-hero .home-btn-primary')
      .forEach((action) => {
        action.href = '/signup/';
        action.textContent = 'أنشئ حسابًا مجانًا →';
      });
    documentSource
      .querySelectorAll<HTMLAnchorElement>('.home-hero .home-btn-ghost')
      .forEach((action) => {
        action.href = '/contact';
        action.textContent = 'تواصل معنا';
      });
    documentSource.querySelector('#programmes .unit-artwork-grid')?.remove();
    documentSource
      .querySelectorAll('#programmes .programme-card')
      .forEach((card, index) => {
        if (index > 1) card.remove();
      });
    documentSource
      .querySelectorAll<HTMLAnchorElement>(
        '#programmes a[href], .home-final-cta a[href*="courses"]',
      )
      .forEach((action) => {
        action.href = '/signup/';
        action.textContent = 'أنشئ حسابًا للاستكشاف ←';
      });
    Array.from(documentSource.querySelectorAll<HTMLElement>('.footer-col'))
      .find((column) => column.querySelector('h4')?.textContent?.trim() === 'مسارات التعلّم')
      ?.remove();
  }
  documentSource
    .querySelectorAll('script[src]')
    .forEach((script) => script.remove());
  const description = documentSource.querySelector<HTMLMetaElement>(
    'meta[name="description"]',
  )?.content;
  const canonical = documentSource.querySelector<HTMLLinkElement>(
    'link[rel="canonical"]',
  )?.href;
  const openGraph = Array.from(
    documentSource.querySelectorAll<HTMLMetaElement>('meta[property^="og:"]'),
  ).map((meta) => ({
    property: meta.getAttribute('property') ?? '',
    content: meta.content,
  }));
  const structuredData = Array.from(
    documentSource.querySelectorAll<HTMLScriptElement>(
      'script[type="application/ld+json"]',
    ),
  )
    .map((script) => script.textContent ?? '')
    .filter(Boolean);
  return {
    bodyClass: documentSource.body.className,
    route: documentSource.body.dataset.route,
    markup: resolveAssetReferences(documentSource.body.innerHTML),
    metadata: {
      title: documentSource.title,
      description,
      canonical,
      openGraph,
      structuredData,
    },
  };
}

function runScript(source: string) {
  Function(resolveAssetReferences(source))();
}

export function LegacyDocumentPage({
  html,
  scripts = [],
  styles = [],
}: {
  html: string;
  scripts?: string[];
  styles?: string[];
}) {
  const parsed = useMemo(() => parseDocument(html), [html]);
  const rootRef = useRef<HTMLDivElement>(null);
  useDocumentMetadata(parsed.metadata);
  useLayoutEffect(() => {
    const previousClass = document.body.className;
    const previousRoute = document.body.dataset.route;
    document.body.className = parsed.bodyClass;
    if (parsed.route) document.body.dataset.route = parsed.route;
    else delete document.body.dataset.route;
    return () => {
      document.body.className = previousClass;
      if (previousRoute) document.body.dataset.route = previousRoute;
      else delete document.body.dataset.route;
    };
  }, [parsed.bodyClass, parsed.route]);
  useEffect(() => {
    const existingChildren = new Set(document.body.children);
    if (rootRef.current) rootRef.current.innerHTML = parsed.markup;
    for (const source of scripts) runScript(source);
    window.dispatchEvent(new Event('load'));
    return () => {
      for (const child of Array.from(document.body.children))
        if (!existingChildren.has(child)) child.remove();
    };
  }, [parsed.markup, scripts]);
  return (
    <>
      {styles.map((source, index) => (
        <style key={index}>{resolveAssetReferences(source)}</style>
      ))}
      <style>{`.course-cover{background-image:linear-gradient(145deg,rgba(36,126,211,.42),rgba(4,23,53,.94)),url("${assets.logo}")!important;}`}</style>
      <div
        ref={rootRef}
        className="legacy-document-root"
        dangerouslySetInnerHTML={{ __html: parsed.markup }}
      />
    </>
  );
}
