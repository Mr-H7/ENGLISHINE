/* global process, fetch, WebSocket, setTimeout, console */
const cdpUrl = process.env.CDP_URL || 'http://127.0.0.1:9335';
const appUrl = process.env.APP_URL || 'http://127.0.0.1:5187';
const widths = [1440, 1280, 1024, 768, 430, 390, 360];
const routes = [
  '/',
  '/courses.html',
  '/videos.html',
  '/pricing.html',
  '/about.html',
  '/certifications.html',
  '/contact.html',
  '/testimonials.html',
  '/scholarships.html',
  '/login/',
  '/signup/',
  '/payment/',
  '/checkout/',
  '/activation/',
  '/account/activation/',
  '/account/devices/',
  '/private-booking/',
  '/level-test/',
  '/live/',
  '/lesson/',
  '/admin/',
  '/admin/courses/',
  '/admin/videos/',
  '/admin/homework/',
  '/admin/students/',
  '/admin/analytics/',
  '/admin/codes/',
  '/admin/notifications/',
  '/admin/comments/',
  '/admin/leaderboard/',
];
const target = await fetch(cdpUrl + '/json/new?' + encodeURIComponent(appUrl), {
  method: 'PUT',
}).then((response) => response.json());
const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  socket.addEventListener('open', resolve, { once: true });
  socket.addEventListener('error', reject, { once: true });
});
let sequence = 0;
const pending = new Map();
const problems = [];
socket.addEventListener('message', ({ data }) => {
  const message = JSON.parse(data);
  if (message.id && pending.has(message.id)) {
    const { resolve, reject } = pending.get(message.id);
    pending.delete(message.id);
    return message.error
      ? reject(new Error(JSON.stringify(message.error)))
      : resolve(message.result);
  }
  if (message.method === 'Runtime.exceptionThrown')
    problems.push('exception: ' + message.params.exceptionDetails.text);
  if (
    message.method === 'Log.entryAdded' &&
    ['error', 'warning'].includes(message.params.entry.level)
  )
    problems.push(
      message.params.entry.level + ': ' + message.params.entry.text,
    );
});
const send = (method, params = {}) =>
  new Promise((resolve, reject) => {
    const id = ++sequence;
    pending.set(id, { resolve, reject });
    socket.send(JSON.stringify({ id, method, params }));
  });
const evaluate = async (expression) =>
  (
    await send('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true,
    })
  ).result.value;
const wait = (duration = 100) =>
  new Promise((resolve) => setTimeout(resolve, duration));
await Promise.all([
  send('Page.enable'),
  send('Runtime.enable'),
  send('Log.enable'),
]);
await send('Page.addScriptToEvaluateOnNewDocument', {
  source:
    "window.__shellCls=0;new PerformanceObserver((list)=>{for(const entry of list.getEntries()){if(!entry.hadRecentInput)window.__shellCls+=entry.value}}).observe({type:'layout-shift',buffered:true});",
});
async function navigate(path) {
  await send('Page.navigate', { url: appUrl + path });
  for (let attempt = 0; attempt < 50; attempt += 1) {
    await wait(60);
    if (
      await evaluate(
        "document.readyState==='complete' && document.body.innerText.trim().length>0",
      )
    )
      break;
  }
  await evaluate('document.fonts.ready.then(() => true)');
}
for (const path of routes) {
  await send('Emulation.setDeviceMetricsOverride', {
    width: 1440,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await navigate(path);
  const result = await evaluate(
    `(() => ({path:location.pathname,dir:document.documentElement.dir,lang:document.documentElement.lang,main:!!document.querySelector('main'),header:!!document.querySelector('header'),content:document.body.innerText.trim().length,overlay:!!document.querySelector('.vite-error-overlay'),overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth,logo:document.querySelector('.ui-brand img')?.complete&&document.querySelector('.ui-brand img')?.naturalWidth>0}))()`,
  );
  if (
    result.path !== path ||
    result.dir !== 'rtl' ||
    result.lang !== 'ar' ||
    !result.main ||
    !result.header ||
    result.content < 20 ||
    result.overlay ||
    result.overflow > 0 ||
    !result.logo
  )
    problems.push('route ' + path + ': ' + JSON.stringify(result));
}
const responsive = [];
for (const width of widths) {
  await send('Emulation.setDeviceMetricsOverride', {
    width,
    height: width <= 430 ? 800 : 900,
    deviceScaleFactor: 1,
    mobile: width <= 430,
  });
  for (const path of ['/', '/login/', '/admin/']) {
    await navigate(path);
    const result = await evaluate(
      `(() => ({overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth,dir:getComputedStyle(document.body).direction,landmarks:{header:!!document.querySelector('header'),main:!!document.querySelector('main'),footer:!!document.querySelector('footer'),aside:!!document.querySelector('aside')},menu:getComputedStyle(document.querySelector('.ui-menu-toggle')).display,cls:window.__shellCls||0}))()`,
    );
    responsive.push({ width, path, ...result });
    if (result.overflow > 0 || result.dir !== 'rtl' || result.cls > 0.1)
      problems.push(
        'responsive ' + width + ' ' + path + ': ' + JSON.stringify(result),
      );
  }
  await navigate('/');
  await send('Runtime.evaluate', {
    expression: "document.querySelector('.ui-menu-toggle')?.click()",
  });
  await wait(100);
  const drawerOpen = await evaluate(
    "!!document.querySelector('.ui-drawer[open]') && document.querySelectorAll('.ui-mobile-nav a').length>0",
  );
  if (width < 1280 && !drawerOpen)
    problems.push('mobile navigation did not open at ' + width);
  if (drawerOpen)
    await send('Input.dispatchKeyEvent', {
      type: 'keyDown',
      key: 'Escape',
      code: 'Escape',
      windowsVirtualKeyCode: 27,
    });
}
await navigate('/');
await send('Input.dispatchKeyEvent', {
  type: 'keyDown',
  key: 'Tab',
  code: 'Tab',
  windowsVirtualKeyCode: 9,
});
const keyboardFocus = await evaluate(
  'document.activeElement !== document.body && !!document.activeElement',
);
if (!keyboardFocus) problems.push('keyboard focus was not established');
console.log(
  JSON.stringify(
    {
      routesChecked: routes.length,
      widths,
      responsive,
      keyboardFocus,
      problems,
    },
    null,
    2,
  ),
);
await send('Target.closeTarget', { targetId: target.id });
socket.close();
if (problems.length) process.exitCode = 1;
