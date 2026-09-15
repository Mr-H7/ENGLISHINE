import html from '../../../../checkout/index.html?raw';
import { LegacyDocumentPage } from '@/components/legacy/LegacyDocumentPage';
import {
  platformScripts,
  platformStyles,
} from '@/pages/public/platformRuntime';
export function Component() {
  return (
    <LegacyDocumentPage
      html={html}
      scripts={platformScripts}
      styles={platformStyles}
    />
  );
}
