/* 遊びの仕掛け: 実績システム / 隠しコマンド(8bitモード) / hello()
   どのデザインでも使えるよう、見た目は CSS 変数(--ach-*)で各ページ側から変えられる */
(function () {
  'use strict';

  var ACHIEVEMENTS = [
    { id: 'welcome', title: 'はじめまして', desc: 'このサイトを訪れた', hint: '' },
    { id: 'cvd-sim', title: '別の目で見る', desc: 'P型かD型の見え方に切り替えた', hint: 'ヘッダーの「見え方」' },
    { id: 'cvd-correct', title: '見え方を整える', desc: '補正フィルタを使った', hint: 'ヘッダーの「見え方」' },
    { id: 'title-play', title: 'タイトルを崩せ', desc: 'タイトル文字のブロック崩しを始めた', hint: '名前の下のボタン' },
    { id: 'title-clear', title: '名前、全部崩しました', desc: 'タイトルのブロックをすべて壊した', hint: '最後まで崩しきる' },
    { id: 'title-items', title: 'アイテムコレクター', desc: 'タイトルのブロック崩しで5種類のアイテムを全部取った', hint: 'タイトルで落ちてくるカプセル' },
    { id: 'read-story', title: '制作の裏側', desc: '制作記事を1本読んだ', hint: '作品の Story' },
    { id: 'read-all', title: '全巻読破', desc: '制作記事を4本すべて読んだ', hint: '作品の Story を全部' },
    { id: 'highscore', title: 'ハイスコア保持者', desc: 'Breakout で遊んだことがある', hint: 'Breakout を遊ぶ' },
    { id: 'konami', title: '↑↑↓↓←→←→BA', desc: '8bitモードを見つけた', hint: '昔ながらのあのコマンド' },
    { id: 'debug', title: 'デバッグモード', desc: 'F3 でデバッグ表示を開いた', hint: 'ゲームでおなじみのファンクションキー' },
    { id: 'print', title: '攻略本', desc: '印刷用レジュメ（攻略本モード）を開いた', hint: '連絡先の画面' },
    { id: 'console', title: '裏口から失礼します', desc: '開発者ツールで hello() を実行した', hint: '開発者ツールのコンソール' },
    { id: 'lost', title: '迷子', desc: '存在しないページにたどり着いた', hint: 'ないページを開く' },
    { id: 'bottom', title: 'エンドロールまで', desc: 'ページの一番下まで読んだ', hint: '最後までスクロール' }
  ];
  var KEY = 'ach-v1';
  var STORY_KEY = 'stories-read-v1';
  var STORIES = ['breakout', 'photo-tagger', 'senryu-bot', 'character-counter'];

  function load(key) {
    try { return JSON.parse(localStorage.getItem(key) || '[]'); } catch (e) { return []; }
  }
  function save(key, v) {
    try { localStorage.setItem(key, JSON.stringify(v)); } catch (e) {}
  }

  var unlocked = load(KEY);
  var toastBox = null;

  function find(id) {
    for (var i = 0; i < ACHIEVEMENTS.length; i++) if (ACHIEVEMENTS[i].id === id) return ACHIEVEMENTS[i];
    return null;
  }

  function ensureToastBox() {
    if (toastBox) return toastBox;
    toastBox = document.createElement('div');
    toastBox.className = 'ach-toasts';
    toastBox.setAttribute('role', 'status');
    toastBox.setAttribute('aria-live', 'polite');
    document.body.appendChild(toastBox);
    return toastBox;
  }

  function toast(label, title, desc) {
    var box = ensureToastBox();
    var t = document.createElement('div');
    t.className = 'ach-toast';
    var l = document.createElement('span');
    l.className = 'ach-toast-label';
    l.textContent = label;
    var h = document.createElement('strong');
    h.textContent = title;
    var d = document.createElement('span');
    d.className = 'ach-toast-desc';
    d.textContent = desc;
    t.appendChild(l); t.appendChild(h); t.appendChild(d);
    box.appendChild(t);
    setTimeout(function () { t.classList.add('out'); }, 3800);
    setTimeout(function () { t.remove(); }, 4300);
  }

  function unlock(id) {
    var a = find(id);
    if (!a || unlocked.indexOf(id) !== -1) return false;
    unlocked.push(id);
    save(KEY, unlocked);
    toast('実績解除 ' + unlocked.length + '/' + ACHIEVEMENTS.length, a.title, a.desc);
    render();
    return true;
  }

  /* [data-ach-count] に「3/12」、[data-ach-list] に一覧を描く */
  function render() {
    var counts = document.querySelectorAll('[data-ach-count]');
    for (var i = 0; i < counts.length; i++) counts[i].textContent = unlocked.length + '/' + ACHIEVEMENTS.length;
    var bars = document.querySelectorAll('[data-ach-bar]');
    for (var j = 0; j < bars.length; j++) bars[j].style.width = Math.round(unlocked.length / ACHIEVEMENTS.length * 100) + '%';
    var lists = document.querySelectorAll('[data-ach-list]');
    for (var k = 0; k < lists.length; k++) {
      var ul = lists[k];
      while (ul.firstChild) ul.removeChild(ul.firstChild);
      ACHIEVEMENTS.forEach(function (a) {
        var got = unlocked.indexOf(a.id) !== -1;
        var li = document.createElement('li');
        li.className = got ? 'ach-item got' : 'ach-item';
        var mark = document.createElement('span');
        mark.className = 'ach-mark';
        mark.textContent = got ? '★' : '☆';
        mark.setAttribute('aria-hidden', 'true');
        var body = document.createElement('span');
        var tt = document.createElement('strong');
        tt.textContent = got ? a.title : '？？？';
        var dd = document.createElement('span');
        dd.className = 'ach-item-desc';
        dd.textContent = got ? a.desc : (a.hint ? 'ヒント: ' + a.hint : '');
        var sr = document.createElement('span');
        sr.className = 'sr-only';
        sr.textContent = got ? '（達成済み）' : '（未達成）';
        body.appendChild(tt); body.appendChild(sr); body.appendChild(dd);
        li.appendChild(mark); li.appendChild(body);
        ul.appendChild(li);
      });
    }
  }

  /* ---------- 8bit モード（↑↑↓↓←→←→BA） ---------- */
  var SEQ = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];
  var pos = 0;
  function onKey(e) {
    var tag = (e.target && e.target.tagName) || '';
    if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target && e.target.isContentEditable)) return;
    var k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (k === SEQ[pos]) {
      pos++;
      if (pos === SEQ.length) { pos = 0; toggle8bit(); }
    } else {
      pos = k === SEQ[0] ? 1 : 0;
    }
  }
  function toggle8bit() {
    var root = document.documentElement;
    if (!document.getElementById('font-8bit')) {
      var link = document.createElement('link');
      link.id = 'font-8bit';
      link.rel = 'stylesheet';
      link.href = 'https://fonts.googleapis.com/css2?family=DotGothic16&display=swap';
      document.head.appendChild(link);
    }
    var on = root.classList.toggle('mode-8bit');
    if (!unlock('konami')) toast(on ? '8BIT MODE' : 'NORMAL MODE', on ? '8bitモード ON' : '元に戻しました', 'もう一度コマンドを入力すると切り替わります');
  }

  /* ---------- まわりから届く合図 ---------- */
  function listen() {
    document.addEventListener('site:cvd', function (e) {
      if (e.detail === 'protan' || e.detail === 'deutan') unlock('cvd-sim');
      if (e.detail === 'correct') unlock('cvd-correct');
    });
    document.addEventListener('site:title-play', function () { unlock('title-play'); });
    document.addEventListener('site:title-clear', function () { unlock('title-clear'); });
    document.addEventListener('site:title-allitems', function () { unlock('title-items'); });
    document.addEventListener('keydown', onKey);

    window.hello = function () {
      unlock('console');
      return 'こんにちは、井上です。見つけてくれてありがとうございます。';
    };

    /* 制作記事ページ */
    var m = location.pathname.match(/\/works\/([a-z-]+)\.html$/);
    if (m && STORIES.indexOf(m[1]) !== -1) {
      var read = load(STORY_KEY);
      if (read.indexOf(m[1]) === -1) { read.push(m[1]); save(STORY_KEY, read); }
      unlock('read-story');
      if (STORIES.every(function (s) { return read.indexOf(s) !== -1; })) unlock('read-all');
    }

    if (document.documentElement.hasAttribute('data-page-404')) unlock('lost');

    var hs = 0;
    try { hs = parseInt(localStorage.getItem('breakout_hs'), 10) || 0; } catch (e) {}
    if (hs > 0) unlock('highscore');

    /* 一番下まで読んだか */
    var end = document.querySelector('[data-ach-end]') || document.querySelector('footer');
    if (end && 'IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (entries) {
        if (entries[0].isIntersecting) { unlock('bottom'); io.disconnect(); }
      });
      io.observe(end);
    }

    /* 攻略本モード（印刷用レジュメ） */
    window.addEventListener('beforeprint', function () { unlock('print'); });
    var printers = document.querySelectorAll('[data-print]');
    for (var i = 0; i < printers.length; i++) {
      printers[i].addEventListener('click', function () { unlock('print'); window.print(); });
    }

    setTimeout(function () { unlock('welcome'); }, 1200);
  }

  window.Ach = { unlock: unlock, list: ACHIEVEMENTS, count: function () { return unlocked.length; } };

  function init() { render(); listen(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
