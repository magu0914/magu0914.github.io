/* サイト共通: 色覚フィルタ切替 / 見え方比較スライダー / ハイスコア表示 / コンソールのあいさつ */
(function () {
  'use strict';

  /* ---------- 色覚フィルタ ----------
     Machado et al. (2009) の重度（severity 1.0）シミュレーション行列。
     行列は線形RGB前提なので color-interpolation-filters="linearRGB" を明示する。
     補正は Daltonize を1つの行列に畳み込んだもの: C = I + W(I - M),
     W = [[0,0,0],[0.7,1,0],[0.7,0,1]]（P型の M で計算） */
  var FILTERS = {
    protan: '0.152286 1.052583 -0.204868 0 0  0.114503 0.786281 0.099216 0 0  -0.003882 -0.048116 1.051998 0 0  0 0 0 1 0',
    deutan: '0.367322 0.860646 -0.227968 0 0  0.280085 0.672501 0.047413 0 0  -0.011820 0.042940 0.968881 0 0  0 0 0 1 0',
    correct: '1 0 0 0 0  0.478897 0.476911 0.044192 0 0  0.597282 -0.688692 1.091410 0 0  0 0 0 1 0'
  };
  var MODES = [
    { id: 'none', label: '通常', note: '' },
    { id: 'protan', label: 'P型', note: 'P型（1型）色覚の見え方をシミュレーション中 — Machado et al. (2009)' },
    { id: 'deutan', label: 'D型', note: 'D型（2型）色覚の見え方をシミュレーション中 — Machado et al. (2009)' },
    { id: 'correct', label: '補正', note: 'P型向けの Daltonize 補正を適用中 — 修士研究で使っている変換です' }
  ];
  var KEY = 'cvd-mode';

  function injectDefs() {
    var NS = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('class', 'cvd-defs');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    var defs = document.createElementNS(NS, 'defs');
    Object.keys(FILTERS).forEach(function (id) {
      var f = document.createElementNS(NS, 'filter');
      f.setAttribute('id', 'cvd-' + id);
      f.setAttribute('color-interpolation-filters', 'linearRGB');
      var m = document.createElementNS(NS, 'feColorMatrix');
      m.setAttribute('type', 'matrix');
      m.setAttribute('values', FILTERS[id]);
      f.appendChild(m);
      defs.appendChild(f);
    });
    svg.appendChild(defs);
    document.body.insertBefore(svg, document.body.firstChild);
  }

  function readMode() {
    try { return localStorage.getItem(KEY) || 'none'; } catch (e) { return 'none'; }
  }
  function saveMode(m) {
    try { localStorage.setItem(KEY, m); } catch (e) {}
  }

  function setupToggle() {
    var host = document.querySelector('[data-cvd-toggle]');
    if (!host) return;
    var group = document.createElement('div');
    group.className = 'cvd-toggle';
    group.setAttribute('role', 'group');
    group.setAttribute('aria-label', '色の見え方を切り替え');
    var label = document.createElement('span');
    label.className = 'cvd-label';
    label.textContent = '見え方';
    group.appendChild(label);

    var note = document.createElement('p');
    note.className = 'cvd-note';
    note.setAttribute('aria-live', 'polite');

    var buttons = MODES.map(function (m) {
      var b = document.createElement('button');
      b.type = 'button';
      b.textContent = m.label;
      b.dataset.mode = m.id;
      b.addEventListener('click', function () { apply(m.id, true); });
      group.appendChild(b);
      return b;
    });

    host.appendChild(group);
    host.appendChild(note);

    function apply(id, persist) {
      var mode = MODES.filter(function (m) { return m.id === id; })[0] || MODES[0];
      if (mode.id === 'none') document.documentElement.removeAttribute('data-cvd');
      else document.documentElement.setAttribute('data-cvd', mode.id);
      buttons.forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.mode === mode.id)); });
      note.textContent = mode.note;
      if (persist) saveMode(mode.id);
    }
    apply(readMode(), false);
  }

  /* ---------- 見え方比較スライダー（Breakout の配色） ---------- */
  var ROW_COLORS = ['#FF7AB6', '#D177FF', '#9D8DFF', '#5DA9FF', '#4ECDC4'];
  var CAPSULES = [['W', '#4ECDC4'], ['P', '#FFD93D'], ['M', '#95E07A'], ['S', '#5DA9FF'], ['L', '#FF7AB6']];

  function buildBoard() {
    var board = document.createElement('div');
    board.className = 'bo-board';
    ROW_COLORS.forEach(function (c) {
      var row = document.createElement('div');
      row.className = 'bo-row';
      for (var i = 0; i < 8; i++) {
        var b = document.createElement('span');
        b.className = 'bo-block';
        b.style.background = c;
        row.appendChild(b);
      }
      board.appendChild(row);
    });
    var caps = document.createElement('div');
    caps.className = 'bo-caps';
    CAPSULES.forEach(function (p) {
      var c = document.createElement('span');
      c.className = 'bo-cap';
      c.style.background = p[1];
      c.textContent = p[0];
      caps.appendChild(c);
    });
    board.appendChild(caps);
    var paddle = document.createElement('span');
    paddle.className = 'bo-paddle';
    board.appendChild(paddle);
    return board;
  }

  function setupCompare() {
    var fig = document.querySelector('[data-cvd-compare]');
    if (!fig) return;
    var stage = fig.querySelector('.cmp');
    var base = stage.querySelector('.cmp-base');
    var sim = stage.querySelector('.cmp-sim');
    base.appendChild(buildBoard());
    sim.appendChild(buildBoard());
    var range = fig.querySelector('input[type=range]');
    function update() { stage.style.setProperty('--pos', range.value + '%'); }
    range.addEventListener('input', update);
    update();
    fig.hidden = false;
  }

  /* ---------- Breakout のハイスコア（同じオリジンなので読める） ---------- */
  function setupHighScore() {
    var el = document.querySelector('[data-breakout-hs]');
    if (!el) return;
    var hs = 0;
    try { hs = parseInt(localStorage.getItem('breakout_hs'), 10) || 0; } catch (e) {}
    if (hs <= 0) return;
    el.querySelector('[data-hs-value]').textContent = hs.toLocaleString('ja-JP');
    el.hidden = false;
  }

  /* ---------- 開発者ツールを開いた人へ ---------- */
  function greet() {
    if (!window.console || !console.log) return;
    console.log(
      '%cInoue Hinata%c\nここまで覗いてくださってありがとうございます。\nこのサイトのソース: https://github.com/magu0914/magu0914.github.io\nタイトル下の「▶ Play the title」も押してみてください。',
      'font: italic 28px "Playfair Display", serif; color: #4a6a8c;',
      'font: 12px monospace; color: #555;'
    );
  }

  function init() {
    injectDefs();
    setupToggle();
    setupCompare();
    setupHighScore();
    greet();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
