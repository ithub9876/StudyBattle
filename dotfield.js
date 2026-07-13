(function () {
  'use strict';

  const TWO_PI = Math.PI * 2;

  const CFG = {
    dotRadius:    1.6,
    dotSpacing:   22,
    cursorRadius: 480,
    bulgeStrength:72,
    glowRadius:   180,
    sparkle:      true,
    waveAmplitude:1.2,
    baseOpacity:  0.17,
    sparkleOpacity:0.62,
    glowColor:    'rgba(255,255,255,0.22)',
    sparkleSpeed: 0.7,
  };

  function init() {
    const svgNS = 'http://www.w3.org/2000/svg';

    /* ── canvas ── */
    const canvas = document.createElement('canvas');
    canvas.id = 'dotFieldCanvas';
    canvas.style.cssText =
      'position:fixed;inset:0;width:100vw;height:100vh;' +
      'pointer-events:none;z-index:-1;';
    document.body.insertBefore(canvas, document.body.firstChild);

    /* ── SVG glow overlay ── */
    const svg = document.createElementNS(svgNS, 'svg');
    svg.style.cssText =
      'position:fixed;inset:0;width:100vw;height:100vh;' +
      'pointer-events:none;z-index:-1;overflow:visible;';

    const defs  = document.createElementNS(svgNS, 'defs');
    const rGrad = document.createElementNS(svgNS, 'radialGradient');
    rGrad.id = 'dfGlow';

    const s0 = document.createElementNS(svgNS, 'stop');
    s0.setAttribute('offset', '0%');
    s0.setAttribute('stop-color', CFG.glowColor);
    const s1 = document.createElementNS(svgNS, 'stop');
    s1.setAttribute('offset', '100%');
    s1.setAttribute('stop-color', 'transparent');
    rGrad.appendChild(s0);
    rGrad.appendChild(s1);
    defs.appendChild(rGrad);
    svg.appendChild(defs);

    const glowCircle = document.createElementNS(svgNS, 'circle');
    glowCircle.setAttribute('cx', '-9999');
    glowCircle.setAttribute('cy', '-9999');
    glowCircle.setAttribute('r',  CFG.glowRadius);
    glowCircle.setAttribute('fill', 'url(#dfGlow)');
    glowCircle.style.opacity = '0';
    svg.appendChild(glowCircle);
    document.body.insertBefore(svg, document.body.firstChild);

    /* ── state ── */
    const dpr   = Math.min(window.devicePixelRatio || 1, 2);
    const ctx   = canvas.getContext('2d', { alpha: true });
    let dots    = [];
    let w = 0, h = 0;
    let resizeTimer = null;
    let frameCount  = 0;
    let rafId       = null;
    let glowOpacity = 0;
    let engagement  = 0;
    const mouse = { x: -9999, y: -9999, prevX: -9999, prevY: -9999, speed: 0 };

    /* ── per-dot sparkle phase offsets so they don't all flicker together ── */
    let phases = [];

    function buildDots(dw, dh) {
      const step = CFG.dotRadius * 2 + CFG.dotSpacing;
      const cols = Math.floor(dw / step);
      const rows = Math.floor(dh / step);
      const padX = (dw % step) / 2;
      const padY = (dh % step) / 2;
      dots   = [];
      phases = [];
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const ax = padX + col * step + step / 2;
          const ay = padY + row * step + step / 2;
          dots.push({ ax, ay, sx: ax, sy: ay });
          phases.push(Math.random() * TWO_PI);
        }
      }
    }

    function doResize() {
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width  = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width  = w + 'px';
      canvas.style.height = h + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      buildDots(w, h);
    }

    function onResize() {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(doResize, 100);
    }

    function onMouseMove(e) {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
    }

    setInterval(function () {
      const dx = mouse.prevX - mouse.x;
      const dy = mouse.prevY - mouse.y;
      const d  = Math.sqrt(dx * dx + dy * dy);
      mouse.speed += (d - mouse.speed) * 0.5;
      if (mouse.speed < 0.001) mouse.speed = 0;
      mouse.prevX = mouse.x;
      mouse.prevY = mouse.y;
    }, 20);

    function tick() {
      frameCount++;
      const t    = frameCount * 0.018;
      const len  = dots.length;
      const cr   = CFG.cursorRadius;
      const crSq = cr * cr;
      const baseR = CFG.dotRadius;

      const targetEng = Math.min(mouse.speed / 5, 1);
      engagement += (targetEng - engagement) * 0.06;
      if (engagement < 0.001) engagement = 0;

      glowOpacity += (engagement - glowOpacity) * 0.08;
      glowCircle.setAttribute('cx', mouse.x);
      glowCircle.setAttribute('cy', mouse.y);
      glowCircle.style.opacity = glowOpacity;

      ctx.clearRect(0, 0, w, h);

      for (let i = 0; i < len; i++) {
        const d  = dots[i];
        const dx = mouse.x - d.ax;
        const dy = mouse.y - d.ay;
        const distSq = dx * dx + dy * dy;

        /* bulge spring */
        if (distSq < crSq && engagement > 0.01) {
          const dist  = Math.sqrt(distSq);
          const tVal  = 1 - dist / cr;
          const push  = tVal * tVal * CFG.bulgeStrength * engagement;
          const angle = Math.atan2(dy, dx);
          d.sx += (d.ax - Math.cos(angle) * push - d.sx) * 0.15;
          d.sy += (d.ay - Math.sin(angle) * push - d.sy) * 0.15;
        } else {
          d.sx += (d.ax - d.sx) * 0.1;
          d.sy += (d.ay - d.sy) * 0.1;
        }

        /* wave displacement */
        let drawX = d.sx + Math.cos(d.ay * 0.03 + t * 0.7) * CFG.waveAmplitude * 0.5;
        let drawY = d.sy + Math.sin(d.ax * 0.03 + t)       * CFG.waveAmplitude;

        /* sparkle: each dot has its own slow sine pulse */
        const sparkSin = (Math.sin(t * CFG.sparkleSpeed + phases[i]) + 1) * 0.5; /* 0–1 */
        const isSpark  = sparkSin > 0.88;                            /* ~12% lit at any time */
        const opacity  = isSpark
          ? CFG.baseOpacity + (CFG.sparkleOpacity - CFG.baseOpacity) * sparkSin
          : CFG.baseOpacity;
        const r = isSpark ? baseR * (1 + sparkSin * 0.7) : baseR;

        ctx.beginPath();
        ctx.arc(drawX, drawY, r, 0, TWO_PI);
        ctx.fillStyle = `rgba(255,255,255,${opacity.toFixed(3)})`;
        ctx.fill();
      }

      rafId = requestAnimationFrame(tick);
    }

    doResize();
    window.addEventListener('resize',    onResize);
    window.addEventListener('mousemove', onMouseMove, { passive: true });
    rafId = requestAnimationFrame(tick);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
