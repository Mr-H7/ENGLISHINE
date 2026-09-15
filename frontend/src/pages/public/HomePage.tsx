import html from '../../../../index.html?raw';
import editorialScript from '../../../../home-editorial.js?raw';
import { LegacyDocumentPage } from '@/components/legacy/LegacyDocumentPage';
import { marketingScripts } from '@/pages/public/marketingRuntime';
const scripts = [...marketingScripts, editorialScript];
export function Component() {
  return <LegacyDocumentPage html={html} scripts={scripts} />;
}
