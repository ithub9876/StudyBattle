(function () {
  'use strict';

  const BASE_SIZE = 52;
  const MAG_SIZE  = 76;
  const DISTANCE  = 160;

  // spring state per button
  const springs = [];

  function lerp(a, b, t) { return a + (b - a) * t; }

  function initDock() {
    const nav = document.querySelector('.bottomNav');
    if (!nav) return;

    const btns = Array.from(nav.querySelectorAll('.navBtn'));

    btns.forEach((btn, i) => {
      springs[i] = { current: BASE_SIZE, target: BASE_SIZE, vel: 0 };
      btn.style.transition = 'none';
      btn.style.willChange = 'width, height';
    });

    // ── desktop: mouse proximity ──────────────────────────────────────
    nav.addEventListener('mousemove', (e) => {
      btns.forEach((btn, i) => {
        const rect = btn.getBoundingClientRect();
        const cx   = rect.left + rect.width / 2;
        const dist = Math.abs(e.clientX - cx);
        const t    = Math.max(0, 1 - dist / DISTANCE);
        springs[i].target = lerp(BASE_SIZE, MAG_SIZE, t * t);
      });
    });

    nav.addEventListener('mouseleave', () => {
      springs.forEach(s => { s.target = BASE_SIZE; });
    });

    // ── mobile: tap bounce ────────────────────────────────────────────
    btns.forEach((btn, i) => {
      btn.addEventListener('touchstart', () => {
        springs[i].target = MAG_SIZE * 0.88;
        setTimeout(() => { springs[i].target = BASE_SIZE; }, 200);
      }, { passive: true });
    });

    // ── spring loop ───────────────────────────────────────────────────
    const stiffness = 0.28;
    const damping   = 0.72;

    function tick() {
      requestAnimationFrame(tick);
      btns.forEach((btn, i) => {
        const s = springs[i];
        s.vel += (s.target - s.current) * stiffness;
        s.vel *= damping;
        s.current += s.vel;

        const sz = Math.round(s.current);
        btn.style.width  = sz + 'px';
        btn.style.height = sz + 'px';

        // icon size proportional
        const icon = btn.querySelector('i');
        if (icon) icon.style.fontSize = Math.round(sz * 0.4) + 'px';
      });
    }
    tick();
  }

  // ── blur on scroll ───────────────────────────────────────────────
  let scrollTimer;
  function onScroll() {
    const nav = document.querySelector('.bottomNav');
    if (!nav) return;
    nav.classList.add('dock-blur');
    clearTimeout(scrollTimer);
    scrollTimer = setTimeout(() => nav.classList.remove('dock-blur'), 600);
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  document.addEventListener('scroll', onScroll, { passive: true, capture: true });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initDock);
  } else {
    initDock();
  }
})();
