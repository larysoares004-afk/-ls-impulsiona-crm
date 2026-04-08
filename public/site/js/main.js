/* ============================================================
   LS INTERNATIONAL — Main JavaScript
   Menu mobile, animações, scroll, formulário e interações
   ============================================================ */

(function () {
  'use strict';

  /* ── 1. HEADER SCROLL EFFECT ── */
  const header = document.getElementById('header');

  function updateHeader() {
    if (window.scrollY > 20) {
      header.classList.add('scrolled');
    } else {
      header.classList.remove('scrolled');
    }
  }

  window.addEventListener('scroll', updateHeader, { passive: true });
  updateHeader();

  /* ── 2. MOBILE MENU ── */
  const hamburger = document.querySelector('.hamburger');
  const mobileMenu = document.querySelector('.mobile-menu');
  const mobileLinks = document.querySelectorAll('.mobile-menu .nav__link');

  function closeMobileMenu() {
    hamburger.classList.remove('open');
    mobileMenu.classList.remove('open');
    document.body.style.overflow = '';
  }

  function openMobileMenu() {
    hamburger.classList.add('open');
    mobileMenu.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  if (hamburger && mobileMenu) {
    hamburger.addEventListener('click', function () {
      if (mobileMenu.classList.contains('open')) {
        closeMobileMenu();
      } else {
        openMobileMenu();
      }
    });

    // Close on link click
    mobileLinks.forEach(function (link) {
      link.addEventListener('click', closeMobileMenu);
    });

    // Close on outside click
    document.addEventListener('click', function (e) {
      if (!hamburger.contains(e.target) && !mobileMenu.contains(e.target)) {
        closeMobileMenu();
      }
    });
  }

  /* ── 3. ACTIVE NAV LINK (highlight on scroll) ── */
  const sections = document.querySelectorAll('section[id]');
  const navLinks = document.querySelectorAll('.nav__link[href^="#"]');

  function updateActiveNav() {
    let current = '';
    const scrollY = window.scrollY;

    sections.forEach(function (section) {
      const sectionTop = section.offsetTop - 100;
      if (scrollY >= sectionTop) {
        current = section.getAttribute('id');
      }
    });

    navLinks.forEach(function (link) {
      link.classList.remove('active');
      if (link.getAttribute('href') === '#' + current) {
        link.classList.add('active');
      }
    });
  }

  window.addEventListener('scroll', updateActiveNav, { passive: true });

  /* ── 4. SMOOTH SCROLL FOR ANCHOR LINKS ── */
  document.querySelectorAll('a[href^="#"]').forEach(function (anchor) {
    anchor.addEventListener('click', function (e) {
      const targetId = this.getAttribute('href');
      if (targetId === '#') return;

      const target = document.querySelector(targetId);
      if (target) {
        e.preventDefault();
        const headerHeight = 80;
        const targetPosition = target.getBoundingClientRect().top + window.scrollY - headerHeight;

        window.scrollTo({
          top: targetPosition,
          behavior: 'smooth'
        });
      }
    });
  });

  /* ── 5. SCROLL REVEAL (IntersectionObserver) ── */
  const revealElements = document.querySelectorAll('.reveal');

  const revealObserver = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          revealObserver.unobserve(entry.target);
        }
      });
    },
    {
      threshold: 0.12,
      rootMargin: '0px 0px -40px 0px'
    }
  );

  revealElements.forEach(function (el) {
    revealObserver.observe(el);
  });

  /* ── 6. PROGRESS BAR ANIMATION (fillBar) ── */
  const progressBars = document.querySelectorAll('.progress-bar__fill');

  const progressObserver = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          const bar = entry.target;
          const targetWidth = bar.dataset.width || '0%';
          bar.style.setProperty('--fill-width', targetWidth);
          bar.style.width = targetWidth;
          progressObserver.unobserve(bar);
        }
      });
    },
    { threshold: 0.5 }
  );

  progressBars.forEach(function (bar) {
    progressObserver.observe(bar);
  });

  /* ── 7. COUNTER ANIMATION (stats) ── */
  function animateCounter(el) {
    const target = parseFloat(el.dataset.target || el.textContent.replace(/[^0-9.]/g, ''));
    const suffix = el.dataset.suffix || '';
    const prefix = el.dataset.prefix || '';
    const duration = 2000;
    const start = performance.now();
    const isDecimal = String(target).includes('.');

    function update(now) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      // Ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = target * eased;
      el.textContent = prefix + (isDecimal ? current.toFixed(1) : Math.floor(current)) + suffix;

      if (progress < 1) {
        requestAnimationFrame(update);
      }
    }

    requestAnimationFrame(update);
  }

  const counterEls = document.querySelectorAll('.stat-item__value[data-target]');

  const counterObserver = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          animateCounter(entry.target);
          counterObserver.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.5 }
  );

  counterEls.forEach(function (el) {
    counterObserver.observe(el);
  });

  /* ── 8. BACK TO TOP ── */
  const backToTop = document.querySelector('.back-to-top');

  if (backToTop) {
    window.addEventListener('scroll', function () {
      if (window.scrollY > 400) {
        backToTop.classList.add('visible');
      } else {
        backToTop.classList.remove('visible');
      }
    }, { passive: true });

    backToTop.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  /* ── 9. CONTACT FORM ── */
  const contactForm = document.getElementById('contactForm');
  const toast = document.querySelector('.toast');

  if (contactForm) {
    contactForm.addEventListener('submit', function (e) {
      e.preventDefault();

      const btn = contactForm.querySelector('[type="submit"]');
      const btnText = btn.querySelector('.btn-text');

      // Coleta os dados
      var name     = (contactForm.querySelector('#name')     || {}).value || '';
      var email    = (contactForm.querySelector('#email')    || {}).value || '';
      var whatsapp = (contactForm.querySelector('#whatsapp') || {}).value || '';
      var company  = (contactForm.querySelector('#company')  || {}).value || '';
      var service  = (contactForm.querySelector('#service')  || {}).value || '';
      var message  = (contactForm.querySelector('#message')  || {}).value || '';

      // Monta a mensagem do WhatsApp
      var text = '🚀 *Novo contato pelo site LS International*\n\n'
        + '*Nome:* ' + name + '\n'
        + '*E-mail:* ' + email + '\n'
        + '*WhatsApp:* ' + whatsapp + '\n'
        + (company ? '*Empresa:* ' + company + '\n' : '')
        + (service ? '*Serviço de interesse:* ' + service + '\n' : '')
        + (message ? '\n*Mensagem:*\n' + message : '');

      var waUrl = 'https://wa.me/5511974442004?text=' + encodeURIComponent(text);

      // Loading state breve antes de redirecionar
      btn.disabled = true;
      if (btnText) btnText.textContent = 'Redirecionando...';

      setTimeout(function () {
        btn.disabled = false;
        if (btnText) btnText.textContent = 'Quero crescer meu negócio';
        contactForm.reset();
        showToast();
        window.open(waUrl, '_blank');
      }, 600);
    });
  }

  function showToast() {
    if (!toast) return;
    toast.classList.add('show');
    setTimeout(function () {
      toast.classList.remove('show');
    }, 4500);
  }

  /* ── 10. CHART BARS ANIMATION ── */
  const chartBars = document.querySelectorAll('.chart__bar');
  const heights = [45, 60, 38, 72, 55, 80, 65, 90, 75, 88, 70, 95];

  chartBars.forEach(function (bar, i) {
    const h = heights[i % heights.length];
    bar.style.height = h + '%';
    bar.style.animationDelay = (i * 0.06) + 's';
  });

  /* ── 11. TYPING EFFECT (Hero headline accent) ── */
  const typingEl = document.querySelector('.hero__typing');

  if (typingEl) {
    const words = ['resultados.', 'conversões.', 'crescimento.', 'performance.'];
    let wordIndex = 0;
    let charIndex = 0;
    let isDeleting = false;

    function type() {
      const currentWord = words[wordIndex];

      if (isDeleting) {
        typingEl.textContent = currentWord.substring(0, charIndex - 1);
        charIndex--;
      } else {
        typingEl.textContent = currentWord.substring(0, charIndex + 1);
        charIndex++;
      }

      let speed = isDeleting ? 60 : 100;

      if (!isDeleting && charIndex === currentWord.length) {
        speed = 1800;
        isDeleting = true;
      } else if (isDeleting && charIndex === 0) {
        isDeleting = false;
        wordIndex = (wordIndex + 1) % words.length;
        speed = 300;
      }

      setTimeout(type, speed);
    }

    type();
  }

  /* ── 12. PARTICLE DOTS (canvas) ── */
  const canvas = document.getElementById('particleCanvas');

  if (canvas) {
    const ctx = canvas.getContext('2d');
    let particles = [];
    let animationId;

    function resizeCanvas() {
      canvas.width = canvas.parentElement.offsetWidth;
      canvas.height = canvas.parentElement.offsetHeight;
    }

    function createParticles() {
      particles = [];
      const count = Math.floor((canvas.width * canvas.height) / 18000);
      for (let i = 0; i < count; i++) {
        particles.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          vx: (Math.random() - 0.5) * 0.4,
          vy: (Math.random() - 0.5) * 0.4,
          size: Math.random() * 1.5 + 0.5,
          opacity: Math.random() * 0.4 + 0.1
        });
      }
    }

    function drawParticles() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      particles.forEach(function (p) {
        p.x += p.vx;
        p.y += p.vy;

        if (p.x < 0) p.x = canvas.width;
        if (p.x > canvas.width) p.x = 0;
        if (p.y < 0) p.y = canvas.height;
        if (p.y > canvas.height) p.y = 0;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0, 200, 255, ' + p.opacity + ')';
        ctx.fill();
      });

      // Draw lines between close particles
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < 120) {
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = 'rgba(0, 200, 255, ' + (0.08 * (1 - dist / 120)) + ')';
            ctx.lineWidth = 0.8;
            ctx.stroke();
          }
        }
      }

      animationId = requestAnimationFrame(drawParticles);
    }

    // Init
    resizeCanvas();
    createParticles();
    drawParticles();

    // Handle resize
    let resizeTimeout;
    window.addEventListener('resize', function () {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(function () {
        cancelAnimationFrame(animationId);
        resizeCanvas();
        createParticles();
        drawParticles();
      }, 200);
    });
  }

  /* ── 13. METHODOLOGY STEPS HOVER ── */
  const steps = document.querySelectorAll('.step');

  steps.forEach(function (step) {
    step.addEventListener('mouseenter', function () {
      steps.forEach(function (s) { s.style.opacity = '0.5'; });
      this.style.opacity = '1';
    });

    step.addEventListener('mouseleave', function () {
      steps.forEach(function (s) { s.style.opacity = '1'; });
    });
  });

})();
