import logo from '../../../assets/logo/englishine-logo.svg?url';
import portrait from '../../../assets/mr-ahmed/mr-ahmed-portrait.png?url';
import teacherProfile from '../../../assets/homepage/teacher-profile.png?url';
import unitOne from '../../../assets/homepage/unit-1.png?url';
import unitTwo from '../../../assets/homepage/unit-2.png?url';
import favicon from '../../../favicon.ico?url';

export const assets = {
  logo,
  portrait,
  teacherProfile,
  unitOne,
  unitTwo,
  favicon,
} as const;

const references = new Map<string, string>([
  ['assets/logo/englishine-logo.svg', logo],
  ['assets/mr-ahmed/mr-ahmed-portrait.png', portrait],
  ['assets/homepage/teacher-profile.png', teacherProfile],
  ['assets/homepage/unit-1.png', unitOne],
  ['assets/homepage/unit-2.png', unitTwo],
]);

export function resolveAssetReferences(source: string) {
  let resolved = source;
  for (const [reference, url] of references) {
    for (const quote of ['"', "'"]) {
      resolved = resolved.replaceAll(
        `${quote}${reference}${quote}`,
        `${quote}${url}${quote}`,
      );
      resolved = resolved.replaceAll(
        `${quote}/${reference}${quote}`,
        `${quote}${url}${quote}`,
      );
    }
  }
  return resolved;
}
