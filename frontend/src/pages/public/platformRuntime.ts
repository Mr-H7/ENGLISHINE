import platformData from '../../../../platform-data.js?raw';
import platformScript from '../../../../platform.js?raw';
import platformCss from '../../../../platform.css?raw';
export const platformScripts = [platformData, platformScript];
export const platformStyles = [
  platformCss.replace("@import url('/styles.css');", ''),
];
