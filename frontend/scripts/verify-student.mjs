/* global process, fetch, WebSocket, setTimeout, console, Buffer */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
const origin = process.env.REACT_URL || 'http://127.0.0.1:5187';
const cdpUrl = process.env.CDP_URL || 'http://127.0.0.1:9335';
const widths = [1440, 1024, 768, 390, 360];
const routes = [
  '/login/',
  '/signup/',
  '/forgot-password/',
  '/reset-password/',
  '/activation/',
  '/account/activation/',
  '/student/',
  '/student/courses/',
  '/student/homework/',
  '/student/assignments/',
  '/student/exams/',
  '/student/certificates/',
  '/student/progress/',
  '/student/notifications/',
  '/student/profile/',
  '/student/support/',
];
const target = await fetch(`${cdpUrl}/json/new?${encodeURIComponent(origin)}`, {
  method: 'PUT',
}).then((response) => response.json());
const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  socket.addEventListener('open', resolve, { once: true });
  socket.addEventListener('error', reject, { once: true });
});
let id = 0;
const pending = new Map();
const consoleErrors = [];
socket.addEventListener('message', ({ data }) => {
  const message = JSON.parse(data);
  if (message.id && pending.has(message.id)) {
    const callbacks = pending.get(message.id);
    pending.delete(message.id);
    return message.error
      ? callbacks.reject(new Error(JSON.stringify(message.error)))
      : callbacks.resolve(message.result);
  }
  if (message.method === 'Runtime.exceptionThrown')
    consoleErrors.push(message.params.exceptionDetails.text);
  if (
    message.method === 'Log.entryAdded' &&
    message.params.entry.level === 'error'
  )
    consoleErrors.push(message.params.entry.text);
});
const send = (method, params = {}) =>
  new Promise((resolve, reject) => {
    const requestId = ++id;
    pending.set(requestId, { resolve, reject });
    socket.send(JSON.stringify({ id: requestId, method, params }));
  });
const evaluate = async (expression) =>
  (
    await send('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true,
    })
  ).result.value;
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
await Promise.all([
  send('Page.enable'),
  send('Runtime.enable'),
  send('Log.enable'),
]);
await send('Emulation.setEmulatedMedia', {
  features: [{ name: 'prefers-reduced-motion', value: 'reduce' }],
});

async function navigate(path) {
  await send('Page.navigate', { url: origin + path });
  for (let attempt = 0; attempt < 80; attempt += 1) {
    await wait(50);
    if (
      await evaluate(
        "document.readyState==='complete'&&document.body.innerText.trim().length>30",
      )
    )
      break;
  }
  await evaluate('document.fonts.ready.then(()=>true)');
  await wait(150);
}

const problems = [];
for (const width of widths) {
  await send('Emulation.setDeviceMetricsOverride', {
    width,
    height: width <= 430 ? 850 : 900,
    deviceScaleFactor: 1,
    mobile: width <= 430,
  });
  for (const path of routes) {
    await navigate(path);
    const state = await evaluate(`(() => {
      const ids=[...document.querySelectorAll('[id]')].map(node=>node.id);
      return {
        rtl: document.documentElement.dir==='rtl',
        text: document.body.innerText.trim().length,
        overflow: Math.max(0,document.documentElement.scrollWidth-document.documentElement.clientWidth),
        brokenImages:[...document.images].filter(image=>image.complete&&image.naturalWidth===0).map(image=>image.src),
        duplicateIds:[...new Set(ids.filter((value,index)=>ids.indexOf(value)!==index))],
        overlay:!!document.querySelector('.vite-error-overlay,[data-nextjs-dialog]'),
        main:!!document.querySelector('main'),
      };
    })()`);
    if (!state.rtl) problems.push(`${path} @ ${width}: RTL missing`);
    if (state.text < 30) problems.push(`${path} @ ${width}: blank content`);
    if (state.overflow > 0)
      problems.push(
        `${path} @ ${width}: ${state.overflow}px horizontal overflow`,
      );
    if (state.brokenImages.length)
      problems.push(`${path} @ ${width}: broken image`);
    if (state.duplicateIds.length)
      problems.push(
        `${path} @ ${width}: duplicate IDs ${state.duplicateIds.join(',')}`,
      );
    if (state.overlay) problems.push(`${path} @ ${width}: error overlay`);
    if (!state.main) problems.push(`${path} @ ${width}: main landmark missing`);
  }
}

const screenshots = [];
for (const width of [1440, 390]) {
  await send('Emulation.setDeviceMetricsOverride', {
    width,
    height: width === 390 ? 850 : 900,
    deviceScaleFactor: 1,
    mobile: width === 390,
  });
  await navigate('/student/');
  const capture = await send('Page.captureScreenshot', {
    format: 'png',
    captureBeyondViewport: true,
  });
  const screenshotPath = join(tmpdir(), `englishine-student-${width}.png`);
  writeFileSync(screenshotPath, Buffer.from(capture.data, 'base64'));
  screenshots.push(screenshotPath);
}
await send('Emulation.setDeviceMetricsOverride', {
  width: 390,
  height: 850,
  deviceScaleFactor: 1,
  mobile: true,
});
await navigate('/student/');
const dashboardSections = await evaluate(
  `['كمّل التعلم','الواجب','الاختبارات','الإعلانات','تقدم التعلم','وصول سريع','النشاط الأخير','الاشتراك الحالي','أحدث الشهادات'].every(label=>document.body.innerText.includes(label))`,
);
if (!dashboardSections) problems.push('dashboard required sections missing');
await evaluate("document.querySelector('.student-mobile-menu')?.click()");
await wait(80);
const drawerOpen = await evaluate(
  "document.querySelector('.ui-drawer')?.open===true",
);
if (!drawerOpen) problems.push('mobile student drawer failed');

await navigate('/login/');
await evaluate(
  `(()=>{const email=document.querySelector('#login-email');const password=document.querySelector('#login-password');email.value='student@example.com';email.dispatchEvent(new Event('input',{bubbles:true}));password.value='password';password.dispatchEvent(new Event('input',{bubbles:true}));document.querySelector('form').requestSubmit()})()`,
);
await wait(50);
const authHonest = await evaluate(
  "document.querySelector('.auth-status')?.textContent.includes('غير متصل')===true",
);
if (!authHonest) problems.push('login preview status failed');

await navigate('/activation/');
await evaluate(
  `(()=>{document.querySelector('#activation-code').value='DEMO-CODE';document.querySelector('#activation-preview').value='expired';document.querySelector('form').requestSubmit()})()`,
);
await wait(50);
const activationState = await evaluate(
  "document.querySelector('.auth-status')?.textContent.includes('انتهت')===true",
);
if (!activationState) problems.push('activation state preview failed');

console.log(
  JSON.stringify(
    {
      routesChecked: routes.length,
      widths,
      comparisons: routes.length * widths.length,
      dashboardSections,
      drawerOpen,
      authHonest,
      activationState,
      screenshots,
      consoleErrors,
      problems,
    },
    null,
    2,
  ),
);
await send('Target.closeTarget', { targetId: target.id });
socket.close();
if (problems.length || consoleErrors.length) process.exitCode = 1;
