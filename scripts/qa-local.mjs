import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const base = "http://127.0.0.1:8765";
const edge = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const routes = [
  "/", "/courses.html", "/videos.html", "/pricing.html", "/about.html",
  "/certifications.html", "/contact.html", "/testimonials.html", "/scholarships.html",
  "/login/", "/signup/", "/payment/", "/checkout/", "/account/devices/",
  "/account/activation/", "/activation/", "/private-booking/", "/level-test/",
  "/live/", "/lesson/", "/admin/", "/admin/courses/", "/admin/videos/",
  "/admin/homework/", "/admin/students/", "/admin/analytics/", "/admin/codes/",
  "/admin/notifications/", "/admin/comments/", "/admin/leaderboard/"
];
const visualRoutes = ["/", "/courses.html", "/videos.html", "/lesson/", "/pricing.html", "/login/", "/account/activation/", "/private-booking/", "/level-test/", "/live/", "/admin/", "/admin/notifications/"];
const widths = [1440, 1024, 768, 430, 390, 360];
const failures = [];
const browser = await chromium.launch({ executablePath: edge, headless: true });

for (const route of routes) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
  page.on("pageerror", error => errors.push(error.message));
  const response = await page.goto(base + route, { waitUntil: "networkidle" });
  if (response?.status() !== 200) failures.push(`${route}: HTTP ${response?.status()}`);
  const root = await page.locator("html").evaluate(el => ({ lang: el.lang, dir: el.dir }));
  if (root.lang !== "ar" || root.dir !== "rtl") failures.push(`${route}: root ${root.lang}/${root.dir}`);
  const ids = await page.locator("[id]").evaluateAll(els => els.map(el => el.id));
  const duplicates = [...new Set(ids.filter((id, index) => ids.indexOf(id) !== index))];
  if (duplicates.length) failures.push(`${route}: duplicate ids ${duplicates.join(",")}`);
  if (errors.length) failures.push(`${route}: console ${errors.join(" | ")}`);
  await page.close();
}

for (const route of visualRoutes) {
  for (const width of widths) {
    const page = await browser.newPage({ viewport: { width, height: 1000 } });
    await page.goto(base + route, { waitUntil: "networkidle" });
    const dimensions = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
    if (dimensions.scroll > dimensions.client + 1) failures.push(`${route}@${width}: overflow ${dimensions.scroll - dimensions.client}px`);
    const tiny = await page.locator("body *:visible").evaluateAll(els => els.filter(el => {
      const style = getComputedStyle(el); const text = (el.textContent || "").trim();
      return text && !el.children.length && parseFloat(style.fontSize) < 10;
    }).slice(0, 3).map(el => `${el.tagName}.${el.className}:${getComputedStyle(el).fontSize}`));
    if (tiny.length) failures.push(`${route}@${width}: tiny text ${tiny.join(",")}`);
    if (width <= 430) {
      const toggle = page.locator(".nav-toggle");
      if (await toggle.count()) {
        await toggle.click();
        if (await toggle.getAttribute("aria-expanded") !== "true") failures.push(`${route}@${width}: mobile menu did not open`);
      }
    }
    await page.close();
  }
}

const interaction = await browser.newPage({ viewport: { width: 390, height: 900 } });
await interaction.goto(base + "/courses.html", { waitUntil: "networkidle" });
await interaction.selectOption("#stage-filter", "prep");
await interaction.selectOption("#grade-filter", "prep1");
await interaction.selectOption("#term-filter", "term1");
if (await interaction.locator("#unit-grid > article:visible").count() !== 6) failures.push("courses: hierarchy filters did not show six units");

await interaction.goto(base + "/lesson/", { waitUntil: "networkidle" });
if (await interaction.locator("#speed-select option").count() !== 9) failures.push("lesson: speed options mismatch");
if (await interaction.locator("#quality-select option").count() !== 7) failures.push("lesson: quality options mismatch");
if (await interaction.locator("[data-video-section]").count() !== 6) failures.push("lesson: section timestamps mismatch");
await interaction.fill("#homework-text", "إجابة تجريبية");
await interaction.locator("#homework-form").evaluate(form => form.requestSubmit());
if (await interaction.locator("#solution-card button").isDisabled()) failures.push("lesson: homework solution did not unlock");

await interaction.goto(base + "/account/activation/", { waitUntil: "networkidle" });
for (const value of ["success", "used", "expired", "invalid"]) {
  await interaction.fill("#activation-code", "DEMO-CODE");
  await interaction.selectOption("#activation-preview", value);
  await interaction.locator("#activation-form").evaluate(form => form.requestSubmit());
  if (!await interaction.locator("#activation-status").isVisible()) failures.push(`activation: state missing for ${value}`);
}

await interaction.goto(base + "/private-booking/", { waitUntil: "networkidle" });
for (const [selector, value] of [["#booking-name", "طالب تجريبي"], ["#booking-phone", "01000000000"], ["#booking-grade", "الصف الأول الإعدادي"], ["#booking-schedule", "بعد الظهر"], ["#booking-goal", "تحسين القواعد"]]) await interaction.fill(selector, value);
await interaction.locator("#booking-form").evaluate(form => form.requestSubmit());
if (!await interaction.locator("#booking-status").isVisible()) failures.push("booking: confirmation missing");
await interaction.close();

await browser.close();
if (failures.length) { console.error(failures.join("\n")); process.exit(1); }
console.log(`QA passed: ${routes.length} routes, ${visualRoutes.length * widths.length} responsive views, navigation shell and key interactions.`);
