/* F3 で出るデバッグ表示。ゲームのデバッグ画面のつもりで、このページ自体の状態を出す。
   開いている間だけ計測し、閉じたら何もしない。URL に ?debug を付けても開く */
(function () {
  'use strict';

  var panel = null, body = null, raf = 0, timer = 0;
  var frames = 0, lastFpsT = 0, fps = 0, worst = 0, lastFrameT = 0;

  function navTiming() {
    var nav = performance.getEntriesByType && performance.getEntriesByType('navigation')[0];
    if (!nav) return '-';
    return Math.round(nav.domContentLoadedEventEnd) + 'ms / ' + Math.round(nav.loadEventEnd) + 'ms';
  }

  function row(k, v) {
    var tr = document.createElement('tr');
    var th = document.createElement('th');
    var td = document.createElement('td');
    th.textContent = k;
    td.textContent = v;
    tr.appendChild(th); tr.appendChild(td);
    return tr;
  }

  function render() {
    var root = document.documentElement;
    var scrollMax = Math.max(1, root.scrollHeight - innerHeight);
    var rows = [
      ['FPS', fps + '  (worst ' + worst.toFixed(1) + 'ms)'],
      ['DOMContentLoaded / load', navTiming()],
      ['DOM nodes', String(document.getElementsByTagName('*').length)],
      ['Viewport', innerWidth + '×' + innerHeight + ' @' + (window.devicePixelRatio || 1) + 'x'],
      ['Scroll', Math.round(scrollY / scrollMax * 100) + '%'],
      ['見え方', root.getAttribute('data-cvd') || 'none'],
      ['8bit', root.classList.contains('mode-8bit') ? 'ON' : 'OFF'],
      ['reduced-motion', matchMedia('(prefers-reduced-motion: reduce)').matches ? 'reduce' : 'no-preference'],
      ['実績', window.Ach ? (window.Ach.count() + '/' + window.Ach.list.length) : '-']
    ];
    if (performance.memory) rows.push(['JS heap', (performance.memory.usedJSHeapSize / 1048576).toFixed(1) + ' MB']);
    var g = window.TitleBreakout && window.TitleBreakout.stats();
    if (g) {
      rows.push(['Title game', 'blocks ' + g.left + '/' + g.total + '  balls ' + g.balls + '  items ' + g.items + (g.spurt ? '  SPURT' : '')]);
      rows.push(['Title time', g.time.toFixed(1) + 's']);
    }
    while (body.firstChild) body.removeChild(body.firstChild);
    rows.forEach(function (r) { body.appendChild(row(r[0], r[1])); });
  }

  function loop(t) {
    frames++;
    if (lastFrameT) worst = Math.max(worst, t - lastFrameT);
    lastFrameT = t;
    if (t - lastFpsT >= 500) {
      fps = Math.round(frames * 1000 / (t - lastFpsT));
      frames = 0; lastFpsT = t;
    }
    raf = requestAnimationFrame(loop);
  }

  function build() {
    panel = document.createElement('section');
    panel.className = 'debug-panel';
    panel.setAttribute('aria-label', 'デバッグ表示');
    var h = document.createElement('p');
    h.className = 'debug-h';
    h.textContent = 'DEBUG  (F3 で閉じる)';
    var table = document.createElement('table');
    body = document.createElement('tbody');
    table.appendChild(body);
    var boxes = document.createElement('button');
    boxes.type = 'button';
    boxes.className = 'debug-btn';
    boxes.setAttribute('aria-pressed', 'false');
    boxes.textContent = 'レイアウト枠を表示';
    boxes.addEventListener('click', function () {
      var on = document.documentElement.classList.toggle('debug-boxes');
      boxes.setAttribute('aria-pressed', String(on));
    });
    var reset = document.createElement('button');
    reset.type = 'button';
    reset.className = 'debug-btn';
    reset.textContent = '最悪フレームをリセット';
    reset.addEventListener('click', function () { worst = 0; });
    panel.appendChild(h); panel.appendChild(table); panel.appendChild(boxes); panel.appendChild(reset);
    document.body.appendChild(panel);
  }

  function open() {
    if (!panel) build();
    panel.hidden = false;
    frames = 0; worst = 0; lastFrameT = 0; lastFpsT = performance.now();
    raf = requestAnimationFrame(loop);
    render();
    timer = setInterval(render, 250);
    if (window.Ach) window.Ach.unlock('debug');
  }
  function close() {
    cancelAnimationFrame(raf);
    clearInterval(timer);
    panel.hidden = true;
    document.documentElement.classList.remove('debug-boxes');
  }
  function toggle() {
    if (panel && !panel.hidden) close(); else open();
  }

  document.addEventListener('keydown', function (e) {
    if (e.key === 'F3') { e.preventDefault(); toggle(); }
  });
  window.debugToggle = toggle;

  if (/[?&]debug\b/.test(location.search)) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', open);
    else open();
  }
})();
