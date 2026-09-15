/* global process, fetch, WebSocket, setTimeout, console */
const cdpUrl = process.env.CDP_URL || 'http://127.0.0.1:9335';
const legacyOrigin = process.env.LEGACY_URL || 'http://127.0.0.1:4173';
const reactOrigin = process.env.REACT_URL || 'http://127.0.0.1:5187';
const widths = [1440, 1280, 1024, 768, 430, 390, 360];
const routes = [
  '/',
  '/about.html',
  '/courses.html',
  '/contact.html',
  '/certifications.html',
  '/videos.html',
  '/pricing.html',
  '/testimonials.html',
  '/scholarships.html',
  '/private-booking/',
  '/payment/',
  '/checkout/',
  '/level-test/',
  '/live/',
];
const target = await fetch(
  cdpUrl + '/json/new?' + encodeURIComponent(reactOrigin),
  { method: 'PUT' },
).then((response) => response.json());
const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  socket.addEventListener('open', resolve, { once: true });
  socket.addEventListener('error', reject, { once: true });
});
let sequence = 0;
const pending = new Map();
const consoleProblems = [];
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
    consoleProblems.push(message.params.exceptionDetails.text);
  if (
    message.method === 'Log.entryAdded' &&
    message.params.entry.level === 'error'
  )
    consoleProblems.push(message.params.entry.text);
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
const wait = (duration) =>
  new Promise((resolve) => setTimeout(resolve, duration));
await Promise.all([
  send('Page.enable'),
  send('Runtime.enable'),
  send('Log.enable'),
]);
await send('Emulation.setEmulatedMedia', {
  features: [{ name: 'prefers-reduced-motion', value: 'reduce' }],
});

async function navigate(url) {
  await send('Page.navigate', { url });
  for (let attempt = 0; attempt < 80; attempt += 1) {
    await wait(40);
    if (
      await evaluate(
        "document.readyState==='complete'&&document.body.innerText.trim().length>20",
      )
    )
      break;
  }
  await evaluate('document.fonts.ready.then(()=>true)');
  await wait(650);
}

const snapshotExpression = `(() => {
 const rect = (element) => element ? Object.fromEntries(['x','y','width','height'].map(key => [key, Math.round(element.getBoundingClientRect()[key] * 10) / 10])) : null;
 const style = (element) => element ? ((computed) => ({fontSize:computed.fontSize,fontWeight:computed.fontWeight,lineHeight:computed.lineHeight,color:computed.color,backgroundColor:computed.backgroundColor,display:computed.display,position:computed.position}))(getComputedStyle(element)) : null;
 const ids=[...document.querySelectorAll('[id]')].map(node=>node.id);
 const duplicateIds=[...new Set(ids.filter((id,index)=>ids.indexOf(id)!==index))];
 const hero=document.querySelector('.home-hero,.about-hero,.courses-hero,.contact-hero,.certifications-hero,.videos-hero,.pricing-hero,.performance-hero,.support-hero,.page-hero');
 const navbar=document.querySelector('.navbar,.app-header');
 const footer=document.querySelector('footer');
 const h1=document.querySelector('h1');
 return {
  title:document.title,
  description:document.querySelector('meta[name="description"]')?.content||'',
  bodyClass:[...document.body.classList].filter(value=>value!=='loaded').sort(),
  dir:document.documentElement.dir,
  overflow:Math.max(0,document.documentElement.scrollWidth-document.documentElement.clientWidth),
  height:document.documentElement.scrollHeight,
  textLength:document.body.innerText.replace(/\\s+/g,' ').trim().length,
  counts:{sections:document.querySelectorAll('section').length,articles:document.querySelectorAll('article').length,forms:document.querySelectorAll('form').length,navs:document.querySelectorAll('nav').length,headings:document.querySelectorAll('h1,h2,h3,h4').length},
  brokenImages:[...document.images].filter(image=>image.complete&&image.naturalWidth===0).map(image=>image.getAttribute('src')),
  duplicateIds,
  geometry:{navbar:rect(navbar),hero:rect(hero),h1:rect(h1),footer:rect(footer)},
  styles:{navbar:style(navbar),h1:style(h1),hero:style(hero)}
 };
})()`;

const problems = [];
const summaries = [];
function compare(path, width, legacy, react) {
  const exactKeys = ['title', 'description', 'dir', 'textLength'];
  for (const key of exactKeys)
    if (JSON.stringify(legacy[key]) !== JSON.stringify(react[key]))
      problems.push(
        `${path} @ ${width}: ${key} mismatch (${JSON.stringify(legacy[key])} vs ${JSON.stringify(react[key])})`,
      );
  for (const key of Object.keys(legacy.counts))
    if (legacy.counts[key] !== react.counts[key])
      problems.push(
        `${path} @ ${width}: ${key} count ${legacy.counts[key]} vs ${react.counts[key]}`,
      );
  if (react.overflow > 0)
    problems.push(
      `${path} @ ${width}: ${react.overflow}px horizontal overflow`,
    );
  if (react.brokenImages.length)
    problems.push(
      `${path} @ ${width}: broken images ${react.brokenImages.join(',')}`,
    );
  if (react.duplicateIds.length)
    problems.push(
      `${path} @ ${width}: duplicate IDs ${react.duplicateIds.join(',')}`,
    );
  if (JSON.stringify(legacy.bodyClass) !== JSON.stringify(react.bodyClass))
    problems.push(`${path} @ ${width}: body class mismatch`);
  const heightDelta = Math.abs(legacy.height - react.height);
  if (heightDelta > 3)
    problems.push(
      `${path} @ ${width}: document height differs by ${heightDelta}px`,
    );
  for (const element of ['navbar', 'hero', 'h1', 'footer']) {
    if (
      JSON.stringify(legacy.styles[element]) !==
      JSON.stringify(react.styles[element])
    )
      problems.push(`${path} @ ${width}: ${element} computed style mismatch`);
    const before = legacy.geometry[element];
    const after = react.geometry[element];
    if (!!before !== !!after)
      problems.push(`${path} @ ${width}: ${element} presence mismatch`);
    else if (
      before &&
      Object.keys(before).some((key) => Math.abs(before[key] - after[key]) > 1)
    )
      problems.push(`${path} @ ${width}: ${element} geometry mismatch`);
  }
  summaries.push({ path, width, heightDelta, overflow: react.overflow });
}
for (const width of widths) {
  await send('Emulation.setDeviceMetricsOverride', {
    width,
    height: width <= 430 ? 850 : 900,
    deviceScaleFactor: 1,
    mobile: width <= 430,
  });
  for (const path of routes) {
    await navigate(legacyOrigin + path);
    const legacy = await evaluate(snapshotExpression);
    await navigate(reactOrigin + path);
    const react = await evaluate(snapshotExpression);
    compare(path, width, legacy, react);
  }
}
await send('Emulation.setDeviceMetricsOverride', {
  width: 390,
  height: 850,
  deviceScaleFactor: 1,
  mobile: true,
});
await navigate(reactOrigin + '/');
const menuPresent = await evaluate("!!document.querySelector('.hamburger')");
await evaluate("document.querySelector('.hamburger')?.click()");
const menuOpen = await evaluate(
  "document.querySelector('.mobile-menu')?.classList.contains('open')===true",
);
if (!menuPresent || !menuOpen)
  problems.push('homepage mobile menu interaction failed');
const homeFilter = await evaluate(
  "(()=>{const buttons=[...document.querySelectorAll('.library-filters [data-filter]')];const cards=[...document.querySelectorAll('.lesson-card[data-category]')];buttons.find(button=>button.dataset.filter==='grammar')?.click();return cards.some(card=>card.dataset.category==='grammar'&&!card.hidden)&&cards.some(card=>card.dataset.category!=='grammar'&&card.hidden)})()",
);
if (!homeFilter) problems.push('homepage video filter interaction failed');
await navigate(reactOrigin + '/courses.html');
const courseFilter = await evaluate(
  `(()=>{const button=document.querySelector('[data-course-filter="middle"]');button?.click();return button?.classList.contains('active')===true&&[...document.querySelectorAll('.course-stage-card[data-category]')].some(card=>card.dataset.category==='middle'&&!card.hidden)})()`,
);
if (!courseFilter) problems.push('courses filter interaction failed');
await navigate(reactOrigin + '/videos.html');
const videoFilter = await evaluate(
  `(()=>{const button=document.querySelector('[data-video-mode="exercise"]');button?.click();return button?.classList.contains('active')===true&&[...document.querySelectorAll('[data-video-card]')].some(card=>card.dataset.mode==='exercise'&&!card.hidden)})()`,
);
if (!videoFilter) problems.push('videos filter interaction failed');
console.log(
  JSON.stringify(
    {
      routesChecked: routes.length,
      widths,
      comparisons: summaries.length,
      interactions: { menuOpen, homeFilter, courseFilter, videoFilter },
      consoleProblems,
      problems,
    },
    null,
    2,
  ),
);
await send('Target.closeTarget', { targetId: target.id });
socket.close();
if (problems.length || consoleProblems.length) process.exitCode = 1;
