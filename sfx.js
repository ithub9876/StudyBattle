const SFX = (() => {
  let ctx = null;
  let enabled = true;

  function getCtx() {
    if (!ctx) {
      try {
        ctx = new (window.AudioContext || window.webkitAudioContext)();
      } catch(e) { return null; }
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function play(fn) {
    if (!enabled) return;
    const ac = getCtx();
    if (!ac) return;
    try { fn(ac); } catch(e) {}
  }

  function tap() {
    play(ac => {
      const o = ac.createOscillator();
      const g = ac.createGain();
      o.connect(g); g.connect(ac.destination);
      o.type = 'sine';
      o.frequency.setValueAtTime(540, ac.currentTime);
      o.frequency.exponentialRampToValueAtTime(320, ac.currentTime + 0.07);
      g.gain.setValueAtTime(0.07, ac.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.09);
      o.start(ac.currentTime);
      o.stop(ac.currentTime + 0.09);
    });
  }

  function nav() {
    play(ac => {
      const o = ac.createOscillator();
      const g = ac.createGain();
      o.connect(g); g.connect(ac.destination);
      o.type = 'sine';
      o.frequency.setValueAtTime(360, ac.currentTime);
      o.frequency.exponentialRampToValueAtTime(560, ac.currentTime + 0.13);
      g.gain.setValueAtTime(0.05, ac.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.15);
      o.start(ac.currentTime);
      o.stop(ac.currentTime + 0.15);
    });
  }

  function success() {
    play(ac => {
      [[523, 0], [659, 0.14], [784, 0.28]].forEach(([freq, delay]) => {
        const o = ac.createOscillator();
        const g = ac.createGain();
        o.connect(g); g.connect(ac.destination);
        o.type = 'sine';
        o.frequency.value = freq;
        const t = ac.currentTime + delay;
        g.gain.setValueAtTime(0.001, t);
        g.gain.linearRampToValueAtTime(0.09, t + 0.04);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.38);
        o.start(t);
        o.stop(t + 0.38);
      });
    });
  }

  function error() {
    play(ac => {
      const o = ac.createOscillator();
      const g = ac.createGain();
      o.connect(g); g.connect(ac.destination);
      o.type = 'triangle';
      o.frequency.value = 180;
      g.gain.setValueAtTime(0.06, ac.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.22);
      o.start(ac.currentTime);
      o.stop(ac.currentTime + 0.22);
    });
  }

  function timerStart() {
    play(ac => {
      [[440, 0], [554, 0.16]].forEach(([freq, delay]) => {
        const o = ac.createOscillator();
        const g = ac.createGain();
        o.connect(g); g.connect(ac.destination);
        o.type = 'sine';
        o.frequency.value = freq;
        const t = ac.currentTime + delay;
        g.gain.setValueAtTime(0.001, t);
        g.gain.linearRampToValueAtTime(0.08, t + 0.05);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.32);
        o.start(t);
        o.stop(t + 0.32);
      });
    });
  }

  function timerEnd() {
    play(ac => {
      [[523, 0], [659, 0.18], [784, 0.36], [1047, 0.54]].forEach(([freq, delay]) => {
        const o = ac.createOscillator();
        const g = ac.createGain();
        o.connect(g); g.connect(ac.destination);
        o.type = 'sine';
        o.frequency.value = freq;
        const t = ac.currentTime + delay;
        g.gain.setValueAtTime(0.001, t);
        g.gain.linearRampToValueAtTime(0.11, t + 0.05);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.48);
        o.start(t);
        o.stop(t + 0.48);
      });
    });
  }

  function toggle() {
    enabled = !enabled;
    return enabled;
  }

  function isEnabled() { return enabled; }

  document.addEventListener('click', function(e) {
    const btn = e.target.closest('button, .navBtn, .dockItem, .lineMenuItem');
    if (!btn) return;
    if (btn.classList.contains('navBtn') || btn.classList.contains('dockItem')) {
      nav();
    } else {
      tap();
    }
  }, { passive: true });

  return { tap, nav, success, error, timerStart, timerEnd, toggle, isEnabled };
})();

window.SFX = SFX;
