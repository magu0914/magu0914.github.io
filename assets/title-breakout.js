/* タイトル文字をブロックにして崩せるようにする。ボタンを押したときだけ動く */
(function () {
  'use strict';

  var mast = document.querySelector('.masthead');
  var title = mast && mast.querySelector('h1.title');
  var btn = document.getElementById('title-play');
  if (!mast || !title || !btn) return;
  btn.hidden = false;

  var game = null;
  btn.addEventListener('click', function () {
    if (game) game.stop();
    else game = new TitleGame();
  });

  function cssVar(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }

  /* h1 の文字を1文字ずつ同じ位置に描き、グリッドでサンプリングしてブロックにする */
  function buildBlocks(W, H, origin) {
    var off = document.createElement('canvas');
    off.width = W; off.height = H;
    var ctx = off.getContext('2d', { willReadFrequently: true });
    var fontPx = parseFloat(getComputedStyle(title).fontSize);
    var cell = Math.max(5, Math.round(fontPx / 15));

    var walker = document.createTreeWalker(title, NodeFilter.SHOW_TEXT);
    var range = document.createRange();
    var node;
    while ((node = walker.nextNode())) {
      var cs = getComputedStyle(node.parentElement);
      ctx.font = cs.fontStyle + ' ' + cs.fontWeight + ' ' + cs.fontSize + ' ' + cs.fontFamily;
      /* 色はサンプリングで見分けるための目印。描画色は後で決める */
      ctx.fillStyle = node.parentElement.classList.contains('ital') ? '#0000ff' : '#ff0000';
      ctx.textBaseline = 'alphabetic';
      for (var i = 0; i < node.length; i++) {
        var ch = node.data[i];
        if (!ch.trim()) continue;
        range.setStart(node, i);
        range.setEnd(node, i + 1);
        var r = range.getBoundingClientRect();
        if (!r.width) continue;
        var m = ctx.measureText(ch);
        var asc = m.fontBoundingBoxAscent || m.actualBoundingBoxAscent;
        var desc = m.fontBoundingBoxDescent || m.actualBoundingBoxDescent;
        var y = r.top - origin.top + (r.height - (asc + desc)) / 2 + asc;
        ctx.fillText(ch, r.left - origin.left, y);
      }
    }

    var data = ctx.getImageData(0, 0, W, H).data;
    var ink = cssVar('--ink') || '#2a2a2a';
    var accent = cssVar('--accent') || '#6b8caf';
    var blocks = [];
    var map = {};
    for (var gy = 0; gy * cell < H; gy++) {
      for (var gx = 0; gx * cell < W; gx++) {
        var px = Math.min(W - 1, gx * cell + (cell >> 1));
        var py = Math.min(H - 1, gy * cell + (cell >> 1));
        var k = (py * W + px) * 4;
        if (data[k + 3] < 128) continue;
        var b = { gx: gx, gy: gy, x: gx * cell, y: gy * cell, color: data[k + 2] > data[k] ? accent : ink, alive: true, fade: 0 };
        blocks.push(b);
        map[gx + ',' + gy] = b;
      }
    }
    return { blocks: blocks, map: map, cell: cell };
  }

  function TitleGame() {
    var self = this;
    /* 先にレイアウトを切り替えてから測る（終了ボタンを上の帯に移す） */
    mast.classList.add('playing');
    var rect = mast.getBoundingClientRect();
    var W = Math.round(rect.width);
    var H = Math.round(rect.height);
    var dpr = window.devicePixelRatio || 1;

    var built = buildBlocks(W, H, rect);
    this.blocks = built.blocks;
    this.map = built.map;
    this.cell = built.cell;
    this.left = this.blocks.length;
    this.score = 0;
    this.miss = 0;
    this.W = W; this.H = H;

    var canvas = document.createElement('canvas');
    canvas.className = 'title-game';
    canvas.width = W * dpr; canvas.height = H * dpr;
    canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
    canvas.tabIndex = 0;
    canvas.setAttribute('role', 'application');
    canvas.setAttribute('aria-label', 'タイトル文字のブロック崩し。左右の矢印キーかマウスでパドルを動かし、スペースキーかクリックで発射、Escキーで終了します。');
    mast.appendChild(canvas);
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.ctx.scale(dpr, dpr);

    title.style.visibility = 'hidden';
    btn.textContent = '■ 終了する (Esc)';
    btn.setAttribute('aria-pressed', 'true');

    this.paddle = { w: Math.max(72, Math.min(160, W * 0.14)), h: 8, x: W / 2, y: H - 22 };
    this.r = Math.max(4, Math.round(this.cell * 0.55));
    this.speed = Math.max(260, Math.min(520, W * 0.55));
    this.keys = {};
    this.resetBall();

    this.onKey = function (e) {
      if (e.key === 'Escape') { e.preventDefault(); self.stop(); return; }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); self.keys[e.key] = e.type === 'keydown'; }
      if ((e.key === ' ' || e.key === 'Enter') && e.type === 'keydown') { e.preventDefault(); self.launch(); }
    };
    this.onPointer = function (e) {
      var r = canvas.getBoundingClientRect();
      self.paddle.x = Math.max(self.paddle.w / 2, Math.min(W - self.paddle.w / 2, e.clientX - r.left));
    };
    this.onDown = function (e) { self.onPointer(e); self.launch(); };
    this.onResize = function () { self.stop(); };

    canvas.addEventListener('keydown', this.onKey);
    canvas.addEventListener('keyup', this.onKey);
    canvas.addEventListener('pointermove', this.onPointer);
    canvas.addEventListener('pointerdown', this.onDown);
    window.addEventListener('resize', this.onResize);
    btn.addEventListener('keydown', this.onKey);

    canvas.focus({ preventScroll: true });
    this.last = performance.now();
    this.raf = requestAnimationFrame(function loop(t) {
      if (!self.canvas) return;
      var dt = Math.min(0.033, (t - self.last) / 1000);
      self.last = t;
      self.update(dt);
      self.draw();
      self.raf = requestAnimationFrame(loop);
    });
  }

  TitleGame.prototype.resetBall = function () {
    this.ball = { x: this.paddle.x, y: this.paddle.y - this.r - 1, vx: 0, vy: 0, stuck: true };
  };

  TitleGame.prototype.launch = function () {
    if (!this.ball.stuck || this.cleared) return;
    var a = (-Math.PI / 2) + (Math.random() - 0.5) * 0.8;
    this.ball.vx = Math.cos(a) * this.speed;
    this.ball.vy = Math.sin(a) * this.speed;
    this.ball.stuck = false;
  };

  TitleGame.prototype.update = function (dt) {
    var p = this.paddle;
    var move = 0;
    if (this.keys.ArrowLeft) move -= 1;
    if (this.keys.ArrowRight) move += 1;
    p.x = Math.max(p.w / 2, Math.min(this.W - p.w / 2, p.x + move * 560 * dt));

    for (var i = 0; i < this.blocks.length; i++) {
      if (!this.blocks[i].alive && this.blocks[i].fade > 0) this.blocks[i].fade -= dt;
    }

    var b = this.ball;
    if (b.stuck) { b.x = p.x; b.y = p.y - this.r - 1; return; }

    /* 1ステップでブロック半分以上進まないよう分割 */
    var steps = Math.ceil((this.speed * dt) / (this.cell * 0.5));
    var sdt = dt / steps;
    for (var s = 0; s < steps; s++) {
      var px = b.x, py = b.y;
      b.x += b.vx * sdt;
      b.y += b.vy * sdt;

      if (b.x < this.r) { b.x = this.r; b.vx = Math.abs(b.vx); }
      if (b.x > this.W - this.r) { b.x = this.W - this.r; b.vx = -Math.abs(b.vx); }
      if (b.y < this.r) { b.y = this.r; b.vy = Math.abs(b.vy); }

      if (b.vy > 0 && b.y + this.r >= p.y && b.y - this.r <= p.y + p.h &&
          b.x >= p.x - p.w / 2 - this.r && b.x <= p.x + p.w / 2 + this.r) {
        /* 当たった位置で跳ね返る角度を変える */
        var off = Math.max(-1, Math.min(1, (b.x - p.x) / (p.w / 2)));
        var ang = -Math.PI / 2 + off * 1.05;
        b.vx = Math.cos(ang) * this.speed;
        b.vy = Math.sin(ang) * this.speed;
        b.y = p.y - this.r - 0.5;
      }

      if (b.y - this.r > this.H) {
        this.miss++;
        this.resetBall();
        return;
      }

      if (this.hitBlock(b, px, py)) break;
    }
  };

  TitleGame.prototype.hitBlock = function (b, px, py) {
    var c = this.cell;
    var x0 = Math.floor((b.x - this.r) / c), x1 = Math.floor((b.x + this.r) / c);
    var y0 = Math.floor((b.y - this.r) / c), y1 = Math.floor((b.y + this.r) / c);
    for (var gy = y0; gy <= y1; gy++) {
      for (var gx = x0; gx <= x1; gx++) {
        var blk = this.map[gx + ',' + gy];
        if (!blk || !blk.alive) continue;
        blk.alive = false;
        blk.fade = 0.25;
        this.left--;
        this.score += 10;
        /* 直前の位置がブロックの横範囲の外なら横から当たったとみなす */
        var fromSide = px + this.r <= blk.x || px - this.r >= blk.x + c;
        if (fromSide) b.vx = -b.vx; else b.vy = -b.vy;
        b.x = px; b.y = py;
        if (this.left <= 0) this.clear();
        return true;
      }
    }
    return false;
  };

  TitleGame.prototype.clear = function () {
    var self = this;
    this.cleared = true;
    this.ball.stuck = true;
    setTimeout(function () { if (self.canvas) self.stop(); }, 2400);
  };

  TitleGame.prototype.draw = function () {
    var ctx = this.ctx, c = this.cell;
    ctx.clearRect(0, 0, this.W, this.H);
    for (var i = 0; i < this.blocks.length; i++) {
      var blk = this.blocks[i];
      if (!blk.alive && blk.fade <= 0) continue;
      ctx.globalAlpha = blk.alive ? 1 : Math.max(0, blk.fade / 0.25);
      ctx.fillStyle = blk.color;
      ctx.fillRect(blk.x + 0.5, blk.y + 0.5, c - 1, c - 1);
    }
    ctx.globalAlpha = 1;

    var ink = cssVar('--ink') || '#2a2a2a';
    var p = this.paddle;
    ctx.fillStyle = ink;
    ctx.fillRect(p.x - p.w / 2, p.y, p.w, p.h);

    ctx.fillStyle = cssVar('--accent-ink') || '#4a6a8c';
    ctx.beginPath();
    ctx.arc(this.ball.x, this.ball.y, this.r, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = ink;
    ctx.font = '12px "JetBrains Mono", monospace';
    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';
    ctx.fillText('SCORE ' + this.score + '  MISS ' + this.miss + '  LEFT ' + this.left, 12, 14);

    if (this.ball.stuck || this.cleared) {
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.font = this.cleared ? 'italic 32px "Playfair Display", serif' : '12px "JetBrains Mono", monospace';
      ctx.fillText(this.cleared ? 'Thanks for playing.' : 'クリック / Space で発射 ・ Esc で終了', this.W / 2, p.y - 18);
    }
  };

  TitleGame.prototype.stop = function () {
    cancelAnimationFrame(this.raf);
    window.removeEventListener('resize', this.onResize);
    btn.removeEventListener('keydown', this.onKey);
    if (this.canvas) this.canvas.remove();
    this.canvas = null;
    title.style.visibility = '';
    mast.classList.remove('playing');
    btn.textContent = '▶ Play the title';
    btn.setAttribute('aria-pressed', 'false');
    btn.focus({ preventScroll: true });
    game = null;
  };
})();
