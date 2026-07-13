const Animations = (() => {

  // ── Auth page 3D reveal sequence ──────────────────────────────────────────
  function runAuthReveal() {
    const logo = document.querySelector('.logoArea');
    const card = document.querySelector('.authCard');
    const orbs = document.querySelectorAll('.authOrb');

    orbs.forEach((orb, i) => {
      orb.style.opacity = '0';
      orb.style.transform = 'scale(0.4)';
      setTimeout(() => {
        orb.style.transition = `opacity 1.2s ease, transform 1.4s cubic-bezier(0.22,1,0.36,1)`;
        orb.style.opacity = '';
        orb.style.transform = '';
      }, i * 120);
    });

    if (logo) {
      logo.style.opacity = '0';
      logo.style.transform = 'translateY(-28px) scale(0.90)';
      setTimeout(() => {
        logo.style.transition = 'opacity 0.75s cubic-bezier(0.22,1,0.36,1), transform 0.75s cubic-bezier(0.22,1,0.36,1)';
        logo.style.opacity = '1';
        logo.style.transform = 'translateY(0) scale(1)';
      }, 100);
    }

    if (card) {
      card.style.opacity = '0';
      card.style.transform = 'perspective(800px) translateY(44px) rotateX(10deg) scale(0.95)';
      card.style.transformOrigin = 'center bottom';
      setTimeout(() => {
        card.style.transition = 'opacity 0.68s cubic-bezier(0.22,1,0.36,1), transform 0.68s cubic-bezier(0.22,1,0.36,1)';
        card.style.opacity = '1';
        card.style.transform = 'perspective(800px) translateY(0) rotateX(0deg) scale(1)';
      }, 250);
    }
  }

  // ── Screen reveal (called after switching screens) ────────────────────────
  function revealScreen(el) {
    if (!el) return;
    el.style.opacity = '0';
    el.style.transform = 'translateY(16px) scale(0.985)';
    el.style.transition = 'none';
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        el.style.transition = 'opacity 0.38s cubic-bezier(0.22,1,0.36,1), transform 0.38s cubic-bezier(0.22,1,0.36,1)';
        el.style.opacity = '1';
        el.style.transform = 'translateY(0) scale(1)';
      });
    });
  }

  // ── Timer open reveal ─────────────────────────────────────────────────────
  function revealTimer() {
    const timer = document.getElementById('timerPage');
    if (!timer) return;
    timer.style.opacity = '0';
    timer.style.transform = 'scale(0.97) translateY(20px)';
    timer.style.transition = 'none';
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        timer.style.transition = 'opacity 0.42s cubic-bezier(0.22,1,0.36,1), transform 0.42s cubic-bezier(0.22,1,0.36,1)';
        timer.style.opacity = '1';
        timer.style.transform = 'scale(1) translateY(0)';
      });
    });
  }

  // ── App entry after login ─────────────────────────────────────────────────
  function revealMainApp() {
    const mainApp = document.getElementById('mainApp');
    if (!mainApp) return;
    mainApp.style.opacity = '0';
    mainApp.style.transform = 'scale(0.97)';
    mainApp.style.transition = 'none';
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        mainApp.style.transition = 'opacity 0.55s cubic-bezier(0.22,1,0.36,1), transform 0.55s cubic-bezier(0.22,1,0.36,1)';
        mainApp.style.opacity = '1';
        mainApp.style.transform = 'scale(1)';
      });
    });
  }

  // ── Stagger cards inside a screen ─────────────────────────────────────────
  function staggerCards(container) {
    if (!container) return;
    const items = container.querySelectorAll(
      '.glassCard, .accordionCard, .upgradeItem, .archiveCard, .battleRoomCard, .previewItem, .battleStats div, .livePlayer, .profileItem'
    );
    items.forEach((el, i) => {
      el.style.opacity = '0';
      el.style.transform = 'translateY(20px) scale(0.97)';
      el.style.transition = 'none';
      setTimeout(() => {
        el.style.transition = 'opacity 0.38s ease, transform 0.38s cubic-bezier(0.22,1,0.36,1)';
        el.style.opacity = '1';
        el.style.transform = 'translateY(0) scale(1)';
      }, i * 60 + 40);
    });
  }

  // ── Reward modal pop-in ───────────────────────────────────────────────────
  function revealModal(el) {
    if (!el) return;
    el.style.opacity = '0';
    el.style.transform = 'translateY(32px) scale(0.94)';
    el.style.transition = 'none';
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        el.style.transition = 'opacity 0.42s cubic-bezier(0.22,1,0.36,1), transform 0.42s cubic-bezier(0.22,1,0.36,1)';
        el.style.opacity = '1';
        el.style.transform = 'translateY(0) scale(1)';
      });
    });
  }

  // ── Ripple on interactive elements ───────────────────────────────────
  function addRipple(e) {
    const btn = e.currentTarget;
    const existing = btn.querySelector('.ripple-wave');
    if (existing) existing.remove();

    const rect = btn.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height) * 1.2;
    const x = (e.clientX || rect.left + rect.width / 2) - rect.left - size / 2;
    const y = (e.clientY || rect.top + rect.height / 2) - rect.top - size / 2;

    const ripple = document.createElement('span');
    ripple.className = 'ripple-wave';
    ripple.style.cssText = `width:${size}px;height:${size}px;left:${x}px;top:${y}px`;
    btn.appendChild(ripple);
    ripple.addEventListener('animationend', () => ripple.remove());
  }

  function bindRipples() {
    document.querySelectorAll('.primaryBtn,.focusBtn,.dangerBtn,.archiveBtn,.backBtn,.timeGrid button')
      .forEach(btn => {
        btn.classList.add('ripple-host');
        btn.removeEventListener('click', addRipple);
        btn.addEventListener('click', addRipple);
      });
  }

  return { runAuthReveal, revealScreen, revealTimer, revealMainApp, staggerCards, revealModal, bindRipples };
})();

window.Animations = Animations;

// ── Init ──────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  if (window.Animations) {
    Animations.runAuthReveal();
    Animations.bindRipples();
  }
});

// Rebind ripples whenever new content is shown
const _origBindRipples = () => {
  if (window.Animations) Animations.bindRipples();
};
document.addEventListener('click', _origBindRipples, { once: false, passive: true, capture: true });
setTimeout(_origBindRipples, 800);
