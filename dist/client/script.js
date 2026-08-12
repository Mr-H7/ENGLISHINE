/* ============================================================
   ENGLISHINE â€” script.js v2.0
   Advanced Animations Â· Luxury Interactions Â· Premium UX
   ============================================================ */

(function () {
  'use strict';

  /* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
     SCROLL PROGRESS BAR
  â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
  const progressEl = document.getElementById('scroll-progress');
  if (progressEl) {
    window.addEventListener('scroll', () => {
      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      progressEl.style.width = `${(scrollTop / docHeight) * 100}%`;
    }, { passive: true });
  }

  /* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
     CUSTOM CURSOR (desktop only)
  â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
  if (window.matchMedia('(pointer: fine)').matches && window.innerWidth > 768) {
    const dot  = document.createElement('div');
    const ring = document.createElement('div');
    dot.className  = 'cursor-dot';
    ring.className = 'cursor-ring';
    document.body.appendChild(dot);
    document.body.appendChild(ring);

    let mouseX = -100, mouseY = -100;
    let ringX  = -100, ringY  = -100;
    let raf;

    document.addEventListener('mousemove', (e) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
      dot.style.left = mouseX + 'px';
      dot.style.top  = mouseY + 'px';
    }, { passive: true });

    function animateCursor() {
      ringX += (mouseX - ringX) * 0.14;
      ringY += (mouseY - ringY) * 0.14;
      ring.style.left = ringX + 'px';
      ring.style.top  = ringY + 'px';
      raf = requestAnimationFrame(animateCursor);
    }
    raf = requestAnimationFrame(animateCursor);

    // Hover states
    const hoverTargets = 'a, button, .btn, .card, .course-card, .cert-card, .testimonial-card, .pricing-card, .social-link, .contact-info-item';
    document.addEventListener('mouseover', (e) => {
      if (e.target.closest(hoverTargets)) ring.classList.add('hovering');
    });
    document.addEventListener('mouseout', (e) => {
      if (e.target.closest(hoverTargets)) ring.classList.remove('hovering');
    });

    // Hide on leave
    document.addEventListener('mouseleave', () => { dot.style.opacity = '0'; ring.style.opacity = '0'; });
    document.addEventListener('mouseenter', () => { dot.style.opacity = '1'; ring.style.opacity = '1'; });
  }

  /* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
     AMBIENT GLOW FOLLOWER
  â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
  if (window.matchMedia('(pointer: fine)').matches) {
    const glow = document.createElement('div');
    glow.style.cssText = `
      position:fixed;pointer-events:none;z-index:0;
      width:500px;height:500px;border-radius:50%;
      background:radial-gradient(circle,rgba(14,76,146,0.045) 0%,transparent 70%);
      transform:translate(-50%,-50%);
      transition:left 0.9s cubic-bezier(0.16,1,0.3,1),top 0.9s cubic-bezier(0.16,1,0.3,1);
      left:-999px;top:-999px;
    `;
    document.body.appendChild(glow);
    document.addEventListener('mousemove', (e) => {
      glow.style.left = e.clientX + 'px';
      glow.style.top  = e.clientY + 'px';
    }, { passive: true });
  }

  /* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
     NAVBAR SCROLL + ACTIVE STATE
  â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
  const navbar = document.querySelector('.navbar');
  if (navbar) {
    const onScroll = () => navbar.classList.toggle('scrolled', window.scrollY > 50);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  // Mark active link from URL
  (function () {
    const links = document.querySelectorAll('.nav-links a, .mobile-menu a');
    const page = window.location.pathname.split('/').pop() || 'index.html';
    links.forEach(link => {
      const href = link.getAttribute('href');
      if (href === page || (page === '' && href === 'index.html')) {
        link.classList.add('active');
      }
    });
  })();

  /* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
     MOBILE MENU
  â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
  const hamburger = document.querySelector('.hamburger');
  const mobileMenu = document.querySelector('.mobile-menu');
  const mobileClose = document.querySelector('.mobile-menu-close');

  const toggleMenu = (state) => {
    const open = state ?? !mobileMenu.classList.contains('open');
    hamburger?.classList.toggle('open', open);
    mobileMenu?.classList.toggle('open', open);
    document.body.style.overflow = open ? 'hidden' : '';
  };

  hamburger?.addEventListener('click', () => toggleMenu());
  mobileClose?.addEventListener('click', () => toggleMenu(false));
  mobileMenu?.querySelectorAll('a').forEach(a => a.addEventListener('click', () => toggleMenu(false)));

  /* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
     SCROLL REVEAL â€” IntersectionObserver
  â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
  const revealClasses = ['.fade-up', '.fade-in', '.slide-right', '.slide-left', '.scale-up', '.reveal-line'];
  const revealEls = document.querySelectorAll(revealClasses.join(', '));

  if (revealEls.length) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.08, rootMargin: '0px 0px -30px 0px' });
    revealEls.forEach(el => observer.observe(el));
  }

  /* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
     STAGGER CHILDREN
  â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
  document.querySelectorAll('.stagger-children').forEach(parent => {
    Array.from(parent.children).forEach((child, i) => {
      child.style.transitionDelay = `${i * 0.09}s`;
    });
  });

  /* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
     STAT COUNTER â€” Spring Easing
  â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
  function animateCounter(el) {
    const raw = el.dataset.target;
    if (!raw) return;
    const target = parseFloat(raw);
    const suffix = el.dataset.suffix || '';
    const prefix = el.dataset.prefix || '';
    const isFloat = String(target).includes('.');
    const duration = 1800;
    const startTime = performance.now();

    function easeOutExpo(t) {
      return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
    }

    function tick(now) {
      const elapsed = now - startTime;
      const t = Math.min(elapsed / duration, 1);
      const eased = easeOutExpo(t);
      const current = isFloat
        ? (target * eased).toFixed(1)
        : Math.round(target * eased);
      el.textContent = prefix + current + suffix;
      if (t < 1) requestAnimationFrame(tick);
      else el.textContent = prefix + (isFloat ? target.toFixed(1) : target) + suffix;
    }
    requestAnimationFrame(tick);
  }

  const statEls = document.querySelectorAll('.stat-value[data-target]');
  if (statEls.length) {
    const statObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          animateCounter(entry.target);
          statObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.6 });
    statEls.forEach(el => statObserver.observe(el));
  }

  /* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
     CARD SPOTLIGHT EFFECT
     (mouse-following light on cards)
  â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
  document.querySelectorAll('.card, .course-card, .cert-card, .testimonial-card, .pricing-card').forEach(card => {
    card.addEventListener('mousemove', (e) => {
      const rect = card.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      card.style.setProperty('--mouse-x', `${x}%`);
      card.style.setProperty('--mouse-y', `${y}%`);
    });
  });

  /* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
     MAGNETIC BUTTONS
  â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
  document.querySelectorAll('.btn-primary, .btn-nav').forEach(btn => {
    btn.addEventListener('mousemove', (e) => {
      const rect = btn.getBoundingClientRect();
      const x = (e.clientX - rect.left - rect.width  / 2) * 0.3;
      const y = (e.clientY - rect.top  - rect.height / 2) * 0.3;
      btn.style.transform = `translate(${x}px, ${y}px)`;
    });
    btn.addEventListener('mouseleave', () => {
      btn.style.transform = '';
      btn.style.transition = 'transform 0.5s cubic-bezier(0.34,1.56,0.64,1)';
      setTimeout(() => { btn.style.transition = ''; }, 500);
    });
  });

  /* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
     HERO PARALLAX
  â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
  const heroOrbs = document.querySelectorAll('.hero-orb');
  const heroGrid = document.querySelector('.hero-grid');
  if (heroOrbs.length || heroGrid) {
    let lastScroll = 0;
    window.addEventListener('scroll', () => {
      const y = window.scrollY;
      if (y === lastScroll) return;
      lastScroll = y;
      heroOrbs.forEach((orb, i) => {
        const speed = 0.15 + i * 0.08;
        orb.style.transform = `translateY(${y * speed}px)`;
      });
      if (heroGrid) {
        heroGrid.style.transform = `translateY(${y * 0.07}px)`;
      }
    }, { passive: true });
  }

  /* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
     TYPED TEXT EFFECT
  â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
  const typedEl = document.querySelector('.typed-text');
  if (typedEl) {
    const words = (typedEl.dataset.words || '').split('|').filter(Boolean);
    if (!words.length) return;
    let wordIdx = 0, charIdx = 0, deleting = false;

    function type() {
      const word = words[wordIdx];
      typedEl.textContent = word.slice(0, charIdx);
      if (!deleting && charIdx < word.length) {
        charIdx++;
        setTimeout(type, 80 + Math.random() * 40);
      } else if (!deleting && charIdx === word.length) {
        deleting = true;
        setTimeout(type, 2400);
      } else if (deleting && charIdx > 0) {
        charIdx--;
        setTimeout(type, 40);
      } else {
        deleting = false;
        wordIdx = (wordIdx + 1) % words.length;
        setTimeout(type, 400);
      }
    }
    setTimeout(type, 800);
  }

  /* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
     CONTACT FORM SUBMISSION
  â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
  const contactForm = document.querySelector('#contact-form');
  if (contactForm) {
    contactForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const btn = contactForm.querySelector('[type="submit"]');
      const orig = btn.innerHTML;
      btn.innerHTML = '<span style="opacity:0.7;">Sending...</span>';
      btn.disabled = true;
      btn.style.cursor = 'not-allowed';

      setTimeout(() => {
        btn.innerHTML = '✓ Message Sent';
        btn.style.background = 'linear-gradient(135deg,#0E4C92,#04326D)';
        btn.style.boxShadow = '0 0 32px rgba(14,76,146,0.35)';
        contactForm.reset();
        setTimeout(() => {
          btn.innerHTML = orig;
          btn.disabled = false;
          btn.style.cursor = '';
          btn.style.background = '';
          btn.style.boxShadow = '';
        }, 4500);
      }, 1400);
    });
  }

  /* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
     FAQ ACCORDION
  â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
  document.querySelectorAll('.faq-question').forEach(btn => {
    btn.addEventListener('click', () => {
      const item = btn.closest('.faq-item');
      const icon = btn.querySelector('.faq-icon');
      const isOpen = item.classList.contains('open');

      // Close all
      document.querySelectorAll('.faq-item.open').forEach(i => {
        i.classList.remove('open');
        const ico = i.querySelector('.faq-icon');
        if (ico) ico.textContent = '+';
      });

      // Open clicked
      if (!isOpen) {
        item.classList.add('open');
        if (icon) icon.textContent = 'âˆ’';
      }
    });
  });

  /* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
     PRICING TOGGLE
  â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
  const pricingToggle = document.querySelector('#pricing-toggle');
  if (pricingToggle) {
    const labelMonthly = document.querySelector('#label-monthly');
    const labelAnnual  = document.querySelector('#pricing-label');

    pricingToggle.addEventListener('change', () => {
      const annual = pricingToggle.checked;
      labelMonthly?.classList.toggle('active', !annual);
      labelAnnual?.classList.toggle('active', annual);

      document.querySelectorAll('[data-monthly]').forEach(el => {
        el.textContent = annual ? el.dataset.annual : el.dataset.monthly;
      });
    });
  }

  /* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
     SECTION-IN-VIEW ACTIVE NAV (hash pages)
  â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
  const pageSections = document.querySelectorAll('section[id]');
  if (pageSections.length) {
    const sectionObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          document.querySelectorAll('.nav-links a').forEach(a => {
            a.classList.toggle('active', a.getAttribute('href') === `#${entry.target.id}`);
          });
        }
      });
    }, { rootMargin: '-40% 0px -40% 0px' });
    pageSections.forEach(s => sectionObserver.observe(s));
  }

  /* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
     RATING BARS â€” ANIMATED FILL ON SCROLL
  â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
  const ratingBars = document.querySelectorAll('.rating-bar-fill');
  if (ratingBars.length) {
    const barObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const fills = entry.target.querySelectorAll('.rating-bar-fill');
          fills.forEach((bar, i) => {
            const w = bar.style.width;
            bar.style.width = '0%';
            setTimeout(() => {
              bar.style.transition = `width 1.2s cubic-bezier(0.16,1,0.3,1) ${i * 0.1}s`;
              bar.style.width = w;
            }, 100);
          });
          barObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.4 });

    const ratingWrap = document.querySelector('.rating-bar-wrap');
    if (ratingWrap) barObserver.observe(ratingWrap);
  }

  /* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
     SMOOTH HOVER TILT (3D) for Cards
  â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
  document.querySelectorAll('.card-3d').forEach(card => {
    card.addEventListener('mousemove', (e) => {
      const rect = card.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width  - 0.5;
      const y = (e.clientY - rect.top)  / rect.height - 0.5;
      card.style.transform = `perspective(700px) rotateX(${-y * 7}deg) rotateY(${x * 7}deg) translateY(-6px)`;
      card.style.transition = 'transform 0.1s';
    });
    card.addEventListener('mouseleave', () => {
      card.style.transition = 'transform 0.6s cubic-bezier(0.34,1.56,0.64,1)';
      card.style.transform = '';
    });
  });

  /* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
     NUMBER SCRAMBLE on hover (stat values)
  â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
  document.querySelectorAll('.stat-value').forEach(el => {
    const final = el.textContent;
    el.closest('.stat-item')?.addEventListener('mouseenter', () => {
      if (el._scrambling) return;
      el._scrambling = true;
      const chars = '0123456789';
      let steps = 0;
      const maxSteps = 8;
      const interval = setInterval(() => {
        if (steps >= maxSteps) {
          el.textContent = final;
          el._scrambling = false;
          clearInterval(interval);
          return;
        }
        const noise = final.replace(/\d/g, () => chars[Math.floor(Math.random() * chars.length)]);
        el.textContent = noise;
        steps++;
      }, 50);
    });
  });

  /* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
     TEXT UNDERLINE REVEAL ON SCROLL
  â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
  const underlineEls = document.querySelectorAll('.text-underline');
  if (underlineEls.length) {
    const ulObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          ulObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.5 });
    underlineEls.forEach(el => ulObserver.observe(el));
  }

  /* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
     SMOOTH ANCHOR SCROLL (for same-page links)
  â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
  document.querySelectorAll('a[href^="#"]').forEach(a => {
    a.addEventListener('click', (e) => {
      const target = document.querySelector(a.getAttribute('href'));
      if (target) {
        e.preventDefault();
        const offset = (document.querySelector('.navbar')?.offsetHeight || 72) + 24;
        const top = target.getBoundingClientRect().top + window.scrollY - offset;
        window.scrollTo({ top, behavior: 'smooth' });
      }
    });
  });

  /* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
     PAGE ENTRANCE ANIMATION
  â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
  const videoFilterButtons = document.querySelectorAll('.library-filters [data-filter]');
  const videoCards = document.querySelectorAll('.lesson-card[data-category]');
  videoFilterButtons.forEach(button => {
    button.addEventListener('click', () => {
      const category = button.dataset.filter;
      videoFilterButtons.forEach(item => item.classList.toggle('active', item === button));
      videoCards.forEach(card => {
        card.hidden = category !== 'all' && card.dataset.category !== category;
      });
    });
  });

  document.body.style.opacity = '0';
  document.body.style.transition = 'opacity 0.5s ease';
  window.addEventListener('load', () => {
    requestAnimationFrame(() => {
      document.body.style.opacity = '1';
    });
  });
  // Fallback
  setTimeout(() => { document.body.style.opacity = '1'; }, 300);

})();


/* Englishine Courses page filters */
(() => {
  const browser = document.querySelector('#programme-browser');
  if (!browser) return;

  const mainButtons = [...browser.querySelectorAll('[data-course-filter]')];
  const panels = [...browser.querySelectorAll('[data-subfilter-panel]')];
  const cards = [...browser.querySelectorAll('.course-stage-card[data-category]')];
  const emptyState = browser.querySelector('#courses-empty-state');
  let activeCategory = 'all';

  const updateEmptyState = () => {
    const visibleCount = cards.filter(card => !card.hidden).length;
    if (emptyState) emptyState.hidden = visibleCount !== 0;
  };

  const showCategory = category => {
    activeCategory = category;
    mainButtons.forEach(button => {
      const selected = button.dataset.courseFilter === category;
      button.classList.toggle('active', selected);
      button.setAttribute('aria-pressed', String(selected));
    });

    panels.forEach(panel => {
      const selected = panel.dataset.subfilterPanel === category;
      panel.hidden = !selected;
      panel.querySelectorAll('[data-subfilter]').forEach((button, index) => {
        button.classList.toggle('active', selected && index === 0);
      });
    });

    cards.forEach(card => {
      card.hidden = category !== 'all' && card.dataset.category !== category;
    });
    updateEmptyState();
  };

  mainButtons.forEach(button => {
    button.addEventListener('click', () => showCategory(button.dataset.courseFilter));
  });

  panels.forEach(panel => {
    const attribute = panel.dataset.filterAttribute;
    const buttons = [...panel.querySelectorAll('[data-subfilter]')];
    buttons.forEach(button => {
      button.addEventListener('click', () => {
        const value = button.dataset.subfilter;
        buttons.forEach(item => item.classList.toggle('active', item === button));
        cards.forEach(card => {
          if (card.dataset.category !== activeCategory) {
            card.hidden = true;
            return;
          }
          const values = (card.dataset[attribute] || '').split(' ');
          card.hidden = value !== 'all' && !values.includes(value);
        });
        updateEmptyState();
      });
    });
  });

  document.querySelectorAll('[data-guidance-filter], [data-footer-filter]').forEach(link => {
    link.addEventListener('click', () => {
      const category = link.dataset.guidanceFilter || link.dataset.footerFilter;
      showCategory(category);
    });
  });
})();