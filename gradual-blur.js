(function () {
  'use strict';

  function createGradualBlur(target, opts) {
    opts = Object.assign({
      position:    'bottom',
      height:      '90px',
      divCount:    6,
      strength:    2.2,
      curve:       'ease-in',
      exponential: true,
      opacity:     1,
      zIndex:      50,
    }, opts);

    const curves = {
      linear:      p => p,
      bezier:      p => p * p * (3 - 2 * p),
      'ease-in':   p => p * p,
      'ease-out':  p => 1 - Math.pow(1 - p, 2),
    };
    const curveFn = curves[opts.curve] || curves.linear;

    const dir = { top: 'to top', bottom: 'to bottom', left: 'to left', right: 'to right' }[opts.position];
    const isVertical = opts.position === 'top' || opts.position === 'bottom';

    const wrap = document.createElement('div');
    wrap.className = 'gb-wrap';
    wrap.style.cssText = [
      'position:absolute',
      'pointer-events:none',
      'overflow:hidden',
      opts.position + ':0',
      isVertical ? 'left:0;right:0;height:' + opts.height : 'top:0;bottom:0;width:' + opts.height,
      'z-index:' + opts.zIndex,
    ].join(';');

    const inner = document.createElement('div');
    inner.style.cssText = 'position:relative;width:100%;height:100%;';

    const inc = 100 / opts.divCount;

    for (let i = 1; i <= opts.divCount; i++) {
      let progress = i / opts.divCount;
      progress = curveFn(progress);

      const blurVal = opts.exponential
        ? Math.pow(2, progress * 4) * 0.0625 * opts.strength
        : 0.0625 * (progress * opts.divCount + 1) * opts.strength;

      const p1 = +((inc * i - inc) * 10 / 10).toFixed(1);
      const p2 = +((inc * i) * 10 / 10).toFixed(1);
      const p3 = +((inc * i + inc) * 10 / 10).toFixed(1);
      const p4 = +((inc * i + inc * 2) * 10 / 10).toFixed(1);

      let gradient = `transparent ${p1}%, black ${p2}%`;
      if (p3 <= 100) gradient += `, black ${p3}%`;
      if (p4 <= 100) gradient += `, transparent ${p4}%`;

      const mask = `linear-gradient(${dir}, ${gradient})`;

      const layer = document.createElement('div');
      layer.style.cssText = [
        'position:absolute',
        'inset:0',
        '-webkit-mask-image:' + mask,
        'mask-image:' + mask,
        '-webkit-backdrop-filter:blur(' + blurVal.toFixed(3) + 'rem)',
        'backdrop-filter:blur(' + blurVal.toFixed(3) + 'rem)',
        'opacity:' + opts.opacity,
      ].join(';');
      inner.appendChild(layer);
    }

    wrap.appendChild(inner);

    if (typeof target === 'string') target = document.querySelector(target);
    if (target) {
      const pos = getComputedStyle(target).position;
      if (pos === 'static') target.style.position = 'relative';
      target.appendChild(wrap);
    }

    return wrap;
  }

  window.createGradualBlur = createGradualBlur;

  // Fixed bottom blur overlay removed — dock is a floating pill now,
  // a full-width blur strip behind it conflicts with that design.
})();
