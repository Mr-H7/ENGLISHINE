import html from '../../../../about.html?raw';
import { LegacyDocumentPage } from '@/components/legacy/LegacyDocumentPage';
import { marketingScripts } from '@/pages/public/marketingRuntime';
export function Component() {
  return <LegacyDocumentPage html={html} scripts={marketingScripts} />;
}
