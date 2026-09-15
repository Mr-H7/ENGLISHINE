import html from '../../../../courses.html?raw';
import platformData from '../../../../platform-data.js?raw';
import { LegacyDocumentPage } from '@/components/legacy/LegacyDocumentPage';
import { marketingScripts } from '@/pages/public/marketingRuntime';
const scripts = [platformData, ...marketingScripts];
export function Component() {
  return <LegacyDocumentPage html={html} scripts={scripts} />;
}
