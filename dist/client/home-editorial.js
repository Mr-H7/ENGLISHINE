/* Progressive presentation only. Existing navigation and filters remain in script.js. */
(() => {
  'use strict';
  if (!document.body.classList.contains('home-editorial')) return;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const statement = document.querySelector('.statement-copy');
  if (statement) {
    // Reveal whole Arabic words: splitting letters would break connected glyphs.
    const words = statement.textContent.trim().split(/\s+/);
    statement.setAttribute('aria-label', statement.textContent.trim());
    statement.replaceChildren(...words.flatMap((word, i) => {
      const span = document.createElement('span');
      span.className = 'statement-word'; span.textContent = word;
      span.setAttribute('aria-hidden', 'true');
      return i ? [document.createTextNode(' '), span] : [span];
    }));
    let scheduled = false;
    const update = () => {
      scheduled = false;
      const box = statement.getBoundingClientRect();
      const progress = Math.max(0, Math.min(1, (innerHeight * .9 - box.top) / (innerHeight * .65)));
      statement.querySelectorAll('span').forEach((word, i) => {
        word.style.opacity = reduced.matches ? '1' : String(.25 + .75 * Math.max(0, Math.min(1, progress * (words.length + 3) - i)));
      });
    };
    const queue = () => { if (!scheduled) { scheduled = true; requestAnimationFrame(update); } };
    addEventListener('scroll', queue, { passive: true }); addEventListener('resize', queue);
    reduced.addEventListener('change', queue); update();
  }
  if (!reduced.matches && 'IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      entry.target.animate([{ opacity: .45, transform: 'translateY(20px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: 700, easing: 'cubic-bezier(.2,.7,.3,1)' });
      observer.unobserve(entry.target);
    }), { threshold: .12 });
    document.querySelectorAll('.journey-list li, .philosophy-principle, .unit-artwork, .home-section-head, .about-content > h2, .home-final-cta h2, .programme-card, .home-video-card, .home-cert').forEach(el => observer.observe(el));
  }
})();

// Authority bridge: counts are configured in HTML, never invented or fetched here.
(() => {
  const section = document.getElementById('platform-introduction');
  if (!section) return;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const countStat = el => {
    const raw = el.dataset.value;
    if (!raw || !/^\d+$/.test(raw)) return;
    const target = Number(raw);
    if (!Number.isSafeInteger(target)) return;
    const suffix = el.dataset.suffix || '';
    const formatter = new Intl.NumberFormat('ar-EG');
    const format = value => formatter.format(value) + suffix;
    el.textContent = format(target);
    el.setAttribute('aria-label', format(target));
    if (reduced.matches) return;
    const start = performance.now();
    const tick = now => {
      const progress = Math.min(1, (now - start) / 1000);
      el.textContent = format(Math.round(target * (1 - Math.pow(1 - progress, 3))));
      if (progress < 1 && !reduced.matches) requestAnimationFrame(tick);
      else el.textContent = format(target);
    };
    requestAnimationFrame(tick);
  };
  const stats = section.querySelectorAll('[data-trust-stat]');
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      countStat(entry.target); observer.unobserve(entry.target);
    }), { threshold: .4 });
    stats.forEach(el => observer.observe(el));
  } else stats.forEach(countStat);
  if (!reduced.matches && 'IntersectionObserver' in window) {
    const grid = section.querySelector('.platform-pillar-grid');
    const entrance = new IntersectionObserver(entries => entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const elements = entry.target === grid ? [...grid.children] : [entry.target];
      elements.forEach((el, index) => {
        if (reduced.matches || !el.animate) return;
        const animation = el.animate([{ opacity: .35, transform: 'translateY(14px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: 650, delay: index * 75, easing: 'cubic-bezier(.2,.7,.3,1)', fill: 'backwards' });
        const stop = () => { if (reduced.matches) animation.finish(); };
        reduced.addEventListener('change', stop);
        animation.finished.finally(() => reduced.removeEventListener('change', stop));
      });
      entrance.unobserve(entry.target);
    }), { threshold: .1 });
    [section.querySelector('.platform-intro-copy'), grid].filter(Boolean).forEach(el => entrance.observe(el));
  }
})();
// Small photography drift on large screens only; no animation loop while idle.
(() => {
  const photo = document.querySelector('.home-editorial .about-portrait img');
  if (!photo) return;
  const enabled = matchMedia('(min-width: 1025px) and (prefers-reduced-motion: no-preference)');
  let visible = false, pending = false;
  const draw = () => {
    pending = false;
    if (!enabled.matches) { photo.style.translate = ''; return; }
    if (!visible) return;
    const rect = photo.parentElement.getBoundingClientRect();
    const offset = Math.max(-6, Math.min(6, (innerHeight / 2 - rect.top - rect.height / 2) * .015));
    photo.style.translate = '0 ' + offset.toFixed(2) + 'px';
  };
  const queue = () => { if (!pending && enabled.matches && visible) { pending = true; requestAnimationFrame(draw); } };
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => { visible = entries[0].isIntersecting; queue(); });
    observer.observe(photo.parentElement);
    addEventListener('scroll', queue, { passive: true });
    addEventListener('resize', queue);
    enabled.addEventListener('change', () => { if (!enabled.matches) photo.style.translate = ''; else queue(); });
  }
})();