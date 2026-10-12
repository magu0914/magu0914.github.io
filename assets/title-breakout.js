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
    /* ブロックを大きめにして数を抑える（細かすぎると崩しきるのに時間がかかる） */
    var cell = Math.max(6, Math.round(fontPx / 9));

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
        /* CSS の text-transform を描画にも反映する */
        if (cs.textTransform === 'uppercase') ch = ch.toUpperCase();
        else if (cs.textTransform === 'lowercase') ch = ch.toLowerCase();
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

  /* ---------- アイテム ----------
     Breakout 本編と同じ配色・同じ文字ラベル。残機の無いミニゲームなので +LIFE の代わりに BOMB */
  var ITEMS = {
    WIDE:   { label: 'W', name: 'WIDE',   color: '#4ECDC4', secs: 10 },
    MULTI:  { label: 'M', name: 'MULTI',  color: '#95E07A', secs: 0 },
    PIERCE: { label: 'P', name: 'PIERCE', color: '#FFD93D', secs: 8 },
    SLOW:   { label: 'S', name: 'SLOW',   color: '#5DA9FF', secs: 8 },
    BOMB:   { label: 'B', name: 'BOMB',   color: '#FF7AB6', secs: 0 }
  };
  /* 重み付き抽選の枠。強いものほど少なく */
  var ITEM_POOL = ['WIDE', 'WIDE', 'MULTI', 'MULTI', 'MULTI', 'PIERCE', 'PIERCE', 'SLOW', 'BOMB', 'BOMB'];
  var DROP_CHANCE = 0.06;
  var MAX_FALLING = 3;
  var MAX_BALLS = 8;
  /* 残りがこの割合を切ったら LAST SPURT（常に貫通＋加速） */
  var SPURT_RATIO = 0.3;
  /* 残りがこの数以下になったら、パドルで打ち返したボールが一番近いブロックへ向かう */
  var AIM_LEFT = 30;

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
    this.total = this.blocks.length;
    this.score = 0;
    this.miss = 0;
    this.W = W; this.H = H;
    this.t = 0;
    this.items = [];
    this.pops = [];
    this.fx = { wide: 0, pierce: 0, slow: 0, bomb: 0 };
    this.caught = {};

    var canvas = document.createElement('canvas');
    canvas.className = 'title-game';
    canvas.width = W * dpr; canvas.height = H * dpr;
    canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
    canvas.tabIndex = 0;
    canvas.setAttribute('role', 'application');
    canvas.setAttribute('aria-label', 'タイトル文字のブロック崩し。左右の矢印キーかマウスでパドルを動かし、スペースキーかクリックで発射、Escキーで終了します。ブロックを壊すと W、M、P、S、B の文字が入ったアイテムが落ちてきます。');
    mast.appendChild(canvas);
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.ctx.scale(dpr, dpr);

    title.style.visibility = 'hidden';
    btn.textContent = '■ 終了する (Esc)';
    btn.setAttribute('aria-pressed', 'true');

    this.baseW = Math.max(72, Math.min(160, W * 0.14));
    this.paddle = { w: this.baseW, h: 8, x: W / 2, y: H - 22 };
    this.r = Math.max(4, Math.round(this.cell * 0.55));
    this.speed = Math.max(260, Math.min(520, W * 0.55));
    this.keys = {};
    this.resetBalls();

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
    document.dispatchEvent(new CustomEvent('site:title-play'));
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

  TitleGame.prototype.resetBalls = function () {
    this.balls = [{ x: this.paddle.x, y: this.paddle.y - this.r - 1, vx: 0, vy: 0, stuck: true }];
  };

  TitleGame.prototype.curSpeed = function () {
    return this.speed * (this.fx.slow > 0 ? 0.6 : 1) * (this.spurt ? 1.25 : 1);
  };

  TitleGame.prototype.launch = function () {
    var b = this.balls[0];
    if (!b || !b.stuck || this.cleared) return;
    /* 発射は3球を扇状に。1球だと序盤がなかなか進まないので */
    var base = (-Math.PI / 2) + (Math.random() - 0.5) * 0.4;
    var s = this.curSpeed();
    this.balls = [-0.45, 0, 0.45].map(function (da) {
      return { x: b.x, y: b.y, vx: Math.cos(base + da) * s, vy: Math.sin(base + da) * s, stuck: false };
    });
  };

  TitleGame.prototype.update = function (dt) {
    this.t += dt;
    var p = this.paddle;

    /* 効果時間 */
    var fx = this.fx;
    ['wide', 'pierce', 'slow'].forEach(function (k) { if (fx[k] > 0) fx[k] = Math.max(0, fx[k] - dt); });
    var targetW = fx.wide > 0 ? this.baseW * 1.6 : this.baseW;
    p.w += (targetW - p.w) * Math.min(1, dt * 10);

    var move = 0;
    if (this.keys.ArrowLeft) move -= 1;
    if (this.keys.ArrowRight) move += 1;
    p.x = Math.max(p.w / 2, Math.min(this.W - p.w / 2, p.x + move * 560 * dt));

    for (var i = 0; i < this.blocks.length; i++) {
      if (!this.blocks[i].alive && this.blocks[i].fade > 0) this.blocks[i].fade -= dt;
    }
    this.pops = this.pops.filter(function (q) { q.life -= dt; q.y -= 30 * dt; return q.life > 0; });

    this.updateItems(dt);

    var spd = this.curSpeed();
    var survivors = [];
    for (var n = 0; n < this.balls.length; n++) {
      var b = this.balls[n];
      if (b.stuck) { b.x = p.x; b.y = p.y - this.r - 1; survivors.push(b); continue; }
      /* SLOW の切り替えに合わせて速さをそろえる */
      var len = Math.hypot(b.vx, b.vy) || 1;
      b.vx = b.vx / len * spd; b.vy = b.vy / len * spd;
      if (this.stepBall(b, dt)) survivors.push(b);
    }
    this.balls = survivors;
    if (!this.balls.length) {
      this.miss++;
      this.resetBalls();
    }
  };

  /* ボール1つを進める。落ちたら false */
  TitleGame.prototype.stepBall = function (b, dt) {
    var p = this.paddle;
    /* 1ステップでブロック半分以上進まないよう分割 */
    var steps = Math.ceil((this.curSpeed() * dt) / (this.cell * 0.5));
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
        /* 残りわずかになったら、一番近いブロックへ向けて打ち返す（取り残しを探し回らなくて済むように） */
        var aim = this.aimAt(b);
        if (aim !== null) ang = aim;
        var spd = this.curSpeed();
        b.vx = Math.cos(ang) * spd;
        b.vy = Math.sin(ang) * spd;
        b.y = p.y - this.r - 0.5;
      }

      if (b.y - this.r > this.H) return false;
      if (this.hitBlock(b, px, py)) break;
    }
    return true;
  };

  TitleGame.prototype.breakBlock = function (blk) {
    blk.alive = false;
    blk.fade = 0.25;
    this.left--;
    this.score += 10;
    if (!this.spurt && this.left <= this.total * SPURT_RATIO) {
      this.spurt = true;
      this.pops.push({ text: 'LAST SPURT!', x: this.W / 2, y: this.H / 2, life: 1.4, color: ITEMS.PIERCE.color });
    }
    if (this.items.length < MAX_FALLING && Math.random() < DROP_CHANCE) {
      var type = ITEM_POOL[Math.floor(Math.random() * ITEM_POOL.length)];
      this.items.push({ type: type, x: blk.x + this.cell / 2, y: blk.y + this.cell / 2 });
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
        this.breakBlock(blk);
        if (this.fx.bomb > 0) { this.fx.bomb--; this.explode(gx, gy); }
        if (this.left <= 0) { this.clear(); return true; }
        /* 貫通中は跳ね返らずに進み続ける */
        if (this.fx.pierce > 0 || this.spurt) continue;
        /* 直前の位置がブロックの横範囲の外なら横から当たったとみなす */
        var fromSide = px + this.r <= blk.x || px - this.r >= blk.x + c;
        if (fromSide) b.vx = -b.vx; else b.vy = -b.vy;
        b.x = px; b.y = py;
        return true;
      }
    }
    return false;
  };

  TitleGame.prototype.aimAt = function (b) {
    if (this.left > AIM_LEFT) return null;
    var best = null, bestD = Infinity, c = this.cell;
    for (var i = 0; i < this.blocks.length; i++) {
      var blk = this.blocks[i];
      if (!blk.alive) continue;
      var dx = blk.x + c / 2 - b.x, dy = blk.y + c / 2 - b.y;
      var d = dx * dx + dy * dy;
      if (d < bestD) { bestD = d; best = { dx: dx, dy: dy }; }
    }
    if (!best) return null;
    var a = Math.atan2(best.dy, best.dx);
    /* 真横や下向きにはしない */
    return Math.max(-Math.PI + 0.25, Math.min(-0.25, a));
  };

  /* BOMB: 当たった場所のまわりをまとめて壊す */
  TitleGame.prototype.explode = function (cx, cy) {
    var R = 6;
    for (var gy = cy - R; gy <= cy + R; gy++) {
      for (var gx = cx - R; gx <= cx + R; gx++) {
        if ((gx - cx) * (gx - cx) + (gy - cy) * (gy - cy) > R * R) continue;
        var blk = this.map[gx + ',' + gy];
        if (blk && blk.alive) this.breakBlock(blk);
      }
    }
    this.pops.push({ text: 'BOOM!', x: cx * this.cell, y: cy * this.cell, life: 0.8, color: ITEMS.BOMB.color });
  };

  TitleGame.prototype.updateItems = function (dt) {
    var p = this.paddle;
    var keep = [];
    for (var i = 0; i < this.items.length; i++) {
      var it = this.items[i];
      it.y += 130 * dt;
      if (it.y + 8 >= p.y && it.y - 8 <= p.y + p.h && Math.abs(it.x - p.x) <= p.w / 2 + 14) {
        this.apply(it.type);
        continue;
      }
      if (it.y - 10 < this.H) keep.push(it);
    }
    this.items = keep;
  };

  TitleGame.prototype.apply = function (type) {
    var def = ITEMS[type];
    if (type === 'WIDE') this.fx.wide = def.secs;
    if (type === 'PIERCE') this.fx.pierce = def.secs;
    if (type === 'SLOW') this.fx.slow = def.secs;
    if (type === 'BOMB') this.fx.bomb++;
    if (type === 'MULTI') {
      var add = [];
      var self = this;
      this.balls.forEach(function (b) {
        if (b.stuck) return;
        [-0.4, 0.4].forEach(function (da) {
          if (self.balls.length + add.length >= MAX_BALLS) return;
          var a = Math.atan2(b.vy, b.vx) + da;
          var s = self.curSpeed();
          add.push({ x: b.x, y: b.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, stuck: false });
        });
      });
      this.balls = this.balls.concat(add);
    }
    this.score += 50;
    this.pops.push({ text: def.name + '!', x: this.paddle.x, y: this.paddle.y - 26, life: 0.9, color: def.color });
    this.caught[type] = true;
    if (Object.keys(this.caught).length === Object.keys(ITEMS).length) {
      document.dispatchEvent(new CustomEvent('site:title-allitems'));
    }
  };

  TitleGame.prototype.clear = function () {
    var self = this;
    this.cleared = true;
    this.items = [];
    this.balls.forEach(function (b) { b.vx = 0; b.vy = 0; b.stuck = true; });
    document.dispatchEvent(new CustomEvent('site:title-clear'));
    setTimeout(function () { if (self.canvas) self.stop(); }, 2400);
  };

  function capsule(ctx, x, y, def) {
    var w = 26, h = 14, r = 7;
    ctx.fillStyle = def.color;
    ctx.beginPath();
    ctx.moveTo(x - w / 2 + r, y - h / 2);
    ctx.arcTo(x + w / 2, y - h / 2, x + w / 2, y + h / 2, r);
    ctx.arcTo(x + w / 2, y + h / 2, x - w / 2, y + h / 2, r);
    ctx.arcTo(x - w / 2, y + h / 2, x - w / 2, y - h / 2, r);
    ctx.arcTo(x - w / 2, y - h / 2, x + w / 2, y - h / 2, r);
    ctx.fill();
    ctx.fillStyle = '#0E1116';
    ctx.font = 'bold 11px "JetBrains Mono", ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(def.label, x, y + 1);
  }

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

    for (var k = 0; k < this.items.length; k++) capsule(ctx, this.items[k].x, this.items[k].y, ITEMS[this.items[k].type]);

    var ink = cssVar('--ink') || '#2a2a2a';
    var p = this.paddle;
    ctx.fillStyle = this.fx.wide > 0 ? ITEMS.WIDE.color : ink;
    ctx.fillRect(p.x - p.w / 2, p.y, p.w, p.h);

    var ballColor = (this.fx.pierce > 0 || this.spurt) ? ITEMS.PIERCE.color : (cssVar('--accent-ink') || '#4a6a8c');
    for (var n = 0; n < this.balls.length; n++) {
      var b = this.balls[n];
      ctx.fillStyle = ballColor;
      ctx.beginPath();
      ctx.arc(b.x, b.y, this.r, 0, Math.PI * 2);
      ctx.fill();
      if (this.fx.bomb > 0) {
        ctx.strokeStyle = ITEMS.BOMB.color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(b.x, b.y, this.r + 3, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    ctx.font = 'bold 14px "JetBrains Mono", ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (var q = 0; q < this.pops.length; q++) {
      ctx.globalAlpha = Math.min(1, this.pops[q].life * 2);
      ctx.fillStyle = this.pops[q].color;
      ctx.fillText(this.pops[q].text, this.pops[q].x, this.pops[q].y);
    }
    ctx.globalAlpha = 1;

    /* HUD: 効果は名前と残り秒数の文字で出す（色だけにしない） */
    var hud = 'SCORE ' + this.score + '  MISS ' + this.miss + '  LEFT ' + this.left;
    var active = [];
    if (this.fx.wide > 0) active.push('WIDE ' + Math.ceil(this.fx.wide) + 's');
    if (this.fx.pierce > 0) active.push('PIERCE ' + Math.ceil(this.fx.pierce) + 's');
    if (this.fx.slow > 0) active.push('SLOW ' + Math.ceil(this.fx.slow) + 's');
    if (this.fx.bomb > 0) active.push('BOMB x' + this.fx.bomb);
    if (this.balls.length > 1) active.push('BALL x' + this.balls.length);
    if (this.spurt) active.push('LAST SPURT');
    ctx.fillStyle = ink;
    ctx.font = '12px "JetBrains Mono", ui-monospace, monospace';
    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';
    ctx.fillText(hud, 12, 14);
    if (active.length) ctx.fillText(active.join('  '), 12, 32);

    var first = this.balls[0];
    if ((first && first.stuck) || this.cleared) {
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.font = this.cleared ? 'italic 32px "Playfair Display", serif' : '12px "JetBrains Mono", ui-monospace, monospace';
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
