// 전투 시스템: 적, 투사체, 범위 효과, 데미지 숫자, 상태이상, 원소 반응
import { Container, Sprite, Graphics } from 'pixi.js';
import { sx as SX, sy as SY, TILE, LEVEL } from '../core/view.js';

const ELEM_COLOR = { fire: 0xff8a3d, ice: 0x7ad0ff, lightning: 0xd59cff, none: 0xffffff, hurt: 0xff5a5a };
export { ELEM_COLOR };

// ---------------- 지형 위 이동 (적 공용) ----------------
function blocked(t, x, y, z, r) {
  for (let a = 0; a < 8; a++) {
    const i = Math.floor(x + Math.cos((a * Math.PI) / 4) * r);
    const j = Math.floor(y + Math.sin((a * Math.PI) / 4) * r * 0.7);
    if (t.isSolid(i, j)) return true;
    const g = t.topAt(i, j);
    if (!Number.isNaN(g) && g > z + 0.55) return true;
  }
  return false;
}

function moveActor(t, a, dx, dy) {
  if (!blocked(t, a.x + dx, a.y, a.z, a.r)) a.x += dx;
  else a.kvx = 0;
  if (!blocked(t, a.x, a.y + dy, a.z, a.r)) a.y += dy;
  else a.kvy = 0;
}

// ---------------- 적 ----------------
class Enemy {
  constructor(combat, kind, x, y) {
    this.c = combat;
    this.kind = kind;
    this.x = x;
    this.y = y;
    this.z = combat.t.groundAt(x, y);
    this.vz = 0;
    this.kvx = 0;
    this.kvy = 0;
    this.alive = true;
    this.flash = 0;
    this.st = { burn: 0, burnT: 0, slow: 0, frozen: 0, shocked: 0, stun: 0, mark: 0, sc: 0 };
    this.lastHit = 0;
    this.view = new Container();
    this.shadow = new Sprite(combat.atlas.tex('shadow_m'));
    this.shadow.anchor.set(0.5);
    this.body = new Sprite();
    this.hpBg = new Sprite(combat.atlas.tex('px_1'));
    this.hpBg.tint = 0x16141e;
    this.hpFill = new Sprite(combat.atlas.tex('px_1'));
    this.hpFill.tint = 0xe0524b;
    this.view.addChild(this.shadow, this.body, this.hpBg, this.hpFill);
  }

  get dmgTakenMul() {
    return 1 + (this.st.mark > 0 ? 0.25 : 0) + (this.st.sc > 0 ? 0.4 : 0);
  }

  get speedMul() {
    if (this.st.frozen > 0 || this.st.stun > 0) return 0;
    return this.st.slow > 0 ? 0.6 : 1;
  }

  updateStatus(dt) {
    const s = this.st;
    for (const k of ['slow', 'frozen', 'shocked', 'stun', 'mark', 'sc']) s[k] = Math.max(0, s[k] - dt);
    if (s.burn > 0) {
      s.burn -= dt;
      s.burnT -= dt;
      if (s.burnT <= 0) {
        s.burnT = 0.5;
        this.c.damage(this, this.burnDmg || 2, { element: 'fire', noKnock: true, quiet: true });
      }
    }
    this.flash = Math.max(0, this.flash - dt);
  }

  physics(dt) {
    const t = this.c.t;
    moveActor(t, this, this.kvx * dt, this.kvy * dt);
    this.kvx *= Math.max(0, 1 - dt * 7);
    this.kvy *= Math.max(0, 1 - dt * 7);
    const g = t.groundAt(this.x, this.y);
    if (g >= this.z - 0.01 && g <= this.z + 0.55) {
      this.z += (g - this.z) * Math.min(1, dt * 20);
      if (this.vz < 0) this.vz = 0;
    } else {
      this.vz -= 30 * dt;
      this.z += this.vz * dt;
      if (this.z < g) {
        this.z = g;
        this.vz = 0;
      }
    }
    // 섬 밖으로 떨어지면 사망
    if (g === -Infinity && this.z < -4) this.die(true);
  }

  render(wr) {
    const a = this.c.atlas;
    this.body.texture = a.tex(this.frameName());
    const m = a.anchor(this.frameName());
    this.body.anchor.set(m.ax / m.w, m.ay / m.h);
    this.body.tint = this.st.frozen > 0 ? 0x9fdcff : this.st.shocked > 0 ? 0xe2c4ff : this.st.burn > 0 ? 0xffc29a : 0xffffff;
    if (this.flash > 0) this.body.tint = 0xffffff;
    this.view.x = Math.round(SX(this.x));
    this.view.y = Math.round(SY(this.y, this.z) - (this.hop || 0) * LEVEL);
    const g = this.c.t.groundAt(this.x, this.y);
    this.shadow.visible = g !== -Infinity;
    this.shadow.y = Math.round(((this.hop || 0) + Math.max(0, this.z - g)) * LEVEL) - 1;
    // 흰 번쩍임: 밝게 + 살짝 커짐
    this.body.scale.set(this.flash > 0 ? 1.08 : 1);
    this.body.alpha = 1;
    const show = this.hp < this.maxHp && this.kind !== 'dummy';
    this.hpBg.visible = this.hpFill.visible = show;
    if (show) {
      const w = 14;
      this.hpBg.x = -w / 2 - 1;
      this.hpBg.y = -this.barY - 1;
      this.hpBg.width = w + 2;
      this.hpBg.height = 4;
      this.hpFill.x = -w / 2;
      this.hpFill.y = -this.barY;
      this.hpFill.width = Math.max(0, (this.hp / this.maxHp) * w);
      this.hpFill.height = 2;
    }
    wr.placeEntity(this.view, this.x, this.y);
  }

  die(fell = false) {
    if (!this.alive) return;
    this.alive = false;
    this.view.parent?.removeChild(this.view);
    if (!fell) this.c.fx.burst(this.x, this.y, this.z + 0.3, { count: 16, speed: 3.2, up: 3, color: this.chunkColor, size: 2, life: 0.6 });
    this.c.onEnemyDeath(this, fell);
  }
}

class Slime extends Enemy {
  constructor(combat, x, y, red = false) {
    super(combat, 'slime', x, y);
    this.red = red;
    this.maxHp = this.hp = red ? 90 : 45;
    this.atk = red ? 14 : 9;
    this.r = red ? 0.36 : 0.3;
    this.speed = red ? 1.5 : 1.9;
    this.state = 'idle';
    this.t = Math.random();
    this.hop = 0;
    this.barY = 16;
    this.chunkColor = red ? 0xe85c4f : 0x6fd36a;
    this.wander = [0, 0];
    this.body.scale.set(red ? 1.15 : 1);
  }

  frameName() {
    const n = this.red ? 'red' : 'green';
    let f = 0;
    if (this.state === 'windup') f = 2;
    else if (this.state === 'lunge') f = 3;
    else if (this.hop > 0.05) f = 3;
    else if (this.state === 'move') f = Math.floor(this.t * 6) % 2;
    return `slime_${n}_${f}`;
  }

  update(dt, player) {
    this.updateStatus(dt);
    const sm = this.speedMul;
    this.t += dt;
    const dx = player.x - this.x;
    const dy = player.y - this.y;
    const d = Math.hypot(dx, dy) || 1;
    const sees = player.alive && d < 7.5 && Math.abs(player.z - this.z) < 1.2;
    if (this.state === 'windup') {
      this.wt -= dt * (sm > 0 ? 1 : 0);
      if (this.wt <= 0) {
        this.state = 'lunge';
        this.lt = 0.2;
        this.hitDone = false;
      }
    } else if (this.state === 'lunge') {
      this.lt -= dt;
      moveActor(this.c.t, this, this.ldx * 11 * dt, this.ldy * 11 * dt);
      this.hop = Math.sin((1 - this.lt / 0.2) * Math.PI) * 0.5;
      if (!this.hitDone && Math.hypot(player.x - this.x, player.y - this.y) < this.r + 0.35) {
        this.hitDone = true;
        player.hurt(this.atk, this.ldx, this.ldy);
      }
      if (this.lt <= 0) {
        this.state = 'rest';
        this.rt = 0.9;
        this.hop = 0;
      }
    } else if (this.state === 'rest') {
      this.rt -= dt;
      if (this.rt <= 0) this.state = 'idle';
    } else if (sees && d < 1.6 && sm > 0) {
      this.state = 'windup';
      this.wt = 0.55;
      this.ldx = dx / d;
      this.ldy = dy / d;
      this.c.telegraph(this.x + this.ldx * 1.1, this.y + this.ldy * 1.1, this.z, 0.75, 0.55);
    } else {
      // 깡충깡충 이동
      let mx = 0;
      let my = 0;
      if (sees) {
        mx = dx / d;
        my = dy / d;
      } else {
        if (Math.random() < dt * 0.4) {
          const a = Math.random() * Math.PI * 2;
          this.wander = Math.random() < 0.4 ? [0, 0] : [Math.cos(a) * 0.5, Math.sin(a) * 0.5];
        }
        [mx, my] = this.wander;
        // 가장자리로 가지 않게
        if (this.c.t.groundAt(this.x + mx * 1.2, this.y + my * 1.2) === -Infinity) this.wander = [0, 0];
      }
      const ph = (this.t * 2.2) % 1;
      this.hop = Math.hypot(mx, my) > 0.01 ? Math.sin(ph * Math.PI) * 0.35 : 0;
      this.state = Math.hypot(mx, my) > 0.01 ? 'move' : 'idle';
      const k = (this.hop > 0.05 ? 1 : 0.15) * this.speed * sm;
      moveActor(this.c.t, this, mx * k * dt, my * k * dt);
    }
    this.physics(dt);
  }
}

class Dummy extends Enemy {
  constructor(combat, x, y) {
    super(combat, 'dummy', x, y);
    this.maxHp = this.hp = 9999;
    this.r = 0.3;
    this.barY = 24;
    this.chunkColor = 0xe0c27a;
    this.wob = 0;
  }
  frameName() {
    return 'dummy';
  }
  update(dt) {
    this.updateStatus(dt);
    this.kvx = this.kvy = 0;
    this.lastHit += dt;
    if (this.lastHit > 2.5) this.hp = this.maxHp;
    this.wob = Math.max(0, this.wob - dt * 4);
    this.body.rotation = Math.sin(this.wob * 20) * this.wob * 0.25;
  }
}

// ---------------- 전투 관리 ----------------
export class Combat {
  constructor(game) {
    this.g = game;
    this.atlas = game.atlas;
    this.t = game.terrain;
    this.fx = game.fx;
    this.enemies = [];
    this.projectiles = [];
    this.areas = [];
    this.numbers = [];
    this.numPool = [];
    this.timers = [];
    this.ground = new Container(); // 범위 표시
    this.top = new Container(); // 베기, 숫자
    this.gfxPool = [];
    this.stats = { dummyHits: 0, kills: 0 };
    this.respawn = true;
  }

  // 맵 전환 때 모두 정리
  clear() {
    for (const e of this.enemies) e.view.parent?.removeChild(e.view);
    for (const pr of this.projectiles) pr.s.parent?.removeChild(pr.s);
    for (const a of this.areas) {
      a.g.clear();
      a.g.parent?.removeChild(a.g);
      this.gfxPool.push(a.g);
    }
    for (const n of this.numbers) n.parent?.removeChild(n);
    this.enemies = [];
    this.projectiles = [];
    this.areas = [];
    this.numbers = [];
    this.timers = [];
  }

  spawnDummies(list) {
    for (const m of list) this.enemies.push(new Dummy(this, m.x, m.y));
  }

  spawnSlimeAt(x, y, red = false) {
    const e = new Slime(this, x, y, red);
    this.enemies.push(e);
    this.fx.burst(x, y, e.z + 0.3, { count: 10, speed: 2, up: 2, color: e.chunkColor });
    return e;
  }

  // ---------- 적 배치 ----------
  spawnInitial() {
    for (let k = 0; k < 8; k++) this.spawnSlime(k % 3 === 0);
  }

  spawnSlime(red) {
    const s = this.t.spawn;
    for (let tries = 0; tries < 200; tries++) {
      const i = Math.floor(Math.random() * this.t.w);
      const j = Math.floor(Math.random() * this.t.h);
      if (this.t.isVoid(i, j) || this.t.isSolid(i, j) || this.t.topAt(i, j) !== 0) continue;
      if (Math.hypot(i - s.x, j - s.y) < 8) continue;
      let edge = false;
      for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) if (this.t.isVoid(i + a, j + b)) edge = true;
      if (edge) continue;
      this.enemies.push(new Slime(this, i + 0.5, j + 0.5, red));
      return;
    }
  }

  onEnemyDeath(e) {
    if (e.kind === 'slime') {
      this.stats.kills++;
      if (this.respawn) this.after(8, () => this.spawnSlime(e.red));
    }
  }

  after(t, fn) {
    this.timers.push({ t, fn });
  }

  // ---------- 조회 ----------
  alive() {
    return this.enemies.filter((e) => e.alive);
  }

  nearest(x, y, maxD = 99) {
    let best = null;
    let bd = maxD;
    for (const e of this.enemies) {
      if (!e.alive) continue;
      const d = Math.hypot(e.x - x, e.y - y);
      if (d < bd) {
        bd = d;
        best = e;
      }
    }
    return best;
  }

  inCircle(x, y, r) {
    return this.enemies.filter((e) => e.alive && Math.hypot(e.x - x, e.y - y) <= r + e.r);
  }

  inArc(x, y, dx, dy, r, half) {
    return this.enemies.filter((e) => {
      if (!e.alive) return false;
      const ex = e.x - x;
      const ey = e.y - y;
      const d = Math.hypot(ex, ey);
      if (d > r + e.r) return false;
      if (d < 0.35) return true;
      const a = Math.acos(Math.max(-1, Math.min(1, (ex * dx + ey * dy) / d)));
      return a <= half;
    });
  }

  // ---------- 데미지 ----------
  // opts: base(공격력 배수 결과), element, knock, kx, ky, stun, crit, noKnock, quiet
  damage(e, amount, opts = {}) {
    if (!e.alive) return 0;
    const p = this.g.player;
    let dmg = amount * e.dmgTakenMul;
    let crit = opts.crit;
    if (crit === undefined) crit = Math.random() < (p.critChance || 0.1);
    if (crit) dmg *= 1.8;
    dmg = Math.max(1, Math.round(dmg * (0.92 + Math.random() * 0.16)));
    e.hp -= dmg;
    e.lastHit = 0;
    e.flash = 0.07;
    if (e.kind === 'dummy') {
      e.wob = 1;
      if (!opts.quiet) this.stats.dummyHits++;
    }
    this.g.sfx.hit(crit);
    if (!opts.noKnock && e.kind !== 'dummy') {
      const k = opts.knock ?? 3;
      e.kvx += (opts.kx || 0) * k;
      e.kvy += (opts.ky || 0) * k;
    }
    if (opts.stun) e.st.stun = Math.max(e.st.stun, opts.stun);
    if (!opts.quiet || crit) this.number(e.x, e.y, e.z, dmg, crit, opts.element);
    else this.number(e.x, e.y, e.z, dmg, false, opts.element);
    if (!opts.quiet) this.fx.burst(e.x, e.y, e.z + 0.4, { count: crit ? 7 : 4, speed: 2.4, up: 2, color: e.chunkColor, size: 2, life: 0.35 });
    p.gainUlt(dmg * 0.18);
    if (e.hp <= 0 && e.kind !== 'dummy') {
      e.die();
      this.g.hitstop(0.06);
    }
    return dmg;
  }

  // 원소 효과 + 반응
  applyElement(e, element, base, kx = 0, ky = 0) {
    if (!e.alive || !element || element === 'none') return;
    const s = e.st;
    if (element === 'fire') {
      if (s.frozen > 0) {
        s.frozen = 0;
        this.reaction(e.x, e.y, e.z, '증기 폭발', 0xffffff);
        for (const o of this.inCircle(e.x, e.y, 1.6)) this.damage(o, base * 2, { element: 'fire', kx: o.x - e.x, ky: o.y - e.y, knock: 4 });
        return;
      }
      s.burn = 3;
      e.burnDmg = Math.max(1, base * 0.25);
    } else if (element === 'ice') {
      if (s.shocked > 0) {
        s.shocked = 0;
        s.sc = 5;
        this.reaction(e.x, e.y, e.z, '초전도', 0x7ad0ff);
      }
      s.slow = 2.5;
      e.chill = (e.chill || 0) + 1;
      if (e.chill >= 3) {
        e.chill = 0;
        s.frozen = 1.5;
      }
    } else if (element === 'lightning') {
      if (s.burn > 0) {
        s.burn = 0;
        this.reaction(e.x, e.y, e.z, '과부하', 0xd59cff);
        for (let k = 0; k < 2; k++)
          this.after(0.12 * k, () => {
            for (const o of this.inCircle(e.x, e.y, 1.3)) this.damage(o, base * 0.8, { element: 'lightning', kx: o.x - e.x, ky: o.y - e.y, knock: 5 });
            this.fx.burst(e.x, e.y, e.z + 0.3, { count: 10, speed: 3, color: 0xd59cff });
          });
      }
      s.shocked = 3;
    }
  }

  reaction(x, y, z, text, color) {
    this.g.toastWorld?.(x, y, z, text, color);
    this.fx.burst(x, y, z + 0.4, { count: 14, speed: 3.5, up: 2.5, color });
    this.g.shake(3);
  }

  // ---------- 데미지 숫자 ----------
  number(x, y, z, value, crit, element) {
    let c = this.numPool.pop();
    if (!c) {
      c = new Container();
      c.digits = [];
    }
    const str = String(value) + (crit ? '!' : '');
    while (c.digits.length < str.length) {
      const s = new Sprite();
      c.digits.push(s);
      c.addChild(s);
    }
    let xx = 0;
    const color = crit ? 0xffd84a : element && element !== 'none' ? ELEM_COLOR[element] : 0xffffff;
    c.digits.forEach((s, k) => {
      s.visible = k < str.length;
      if (!s.visible) return;
      s.texture = this.atlas.tex(`dig_${str[k]}`);
      s.x = xx;
      s.tint = color;
      xx += s.texture.width - 1;
    });
    c.pivot.set(xx / 2, 6);
    c.scale.set(crit ? 2 : 1);
    c.alpha = 1;
    c.wx = x + (Math.random() - 0.5) * 1.0;
    c.wy = y;
    c.wz = z + 1.3 + Math.random() * 0.6;
    c.vz = crit ? 3.2 : 2.4;
    c.life = 0.75;
    this.top.addChild(c);
    this.numbers.push(c);
  }

  // ---------- 투사체 ----------
  // opts: x,y,z,dx,dy,speed,range,tex,rot(bool),pierce,radius,onHit(e,proj),onEnd(proj),tint,elem
  shoot(opts) {
    const s = new Sprite(this.atlas.tex(opts.tex));
    s.anchor.set(0.5);
    if (opts.tint !== undefined) s.tint = opts.tint;
    if (opts.rot !== false) s.rotation = Math.atan2(opts.dy, opts.dx);
    const p = { ...opts, s, dist: 0, hit: new Set(), alive: true, radius: opts.radius ?? 0.3 };
    this.projectiles.push(p);
    return p;
  }

  // ---------- 범위 ----------
  // 지속 장판: { x,y,r,time,tick,onTick(enemies), color }
  area(opts) {
    const a = { ...opts, t: 0, tickT: 0, g: this.getGfx() };
    this.areas.push(a);
    return a;
  }

  telegraph(x, y, z, r, time, color = 0xff4040) {
    const a = this.area({ x, y, z, r, time, color, telegraph: true });
    return a;
  }

  getGfx() {
    const g = this.gfxPool.pop() || new Graphics();
    g.visible = true;
    this.ground.addChild(g);
    return g;
  }

  // 반달 베기 효과
  slashFx(x, y, z, angle, big = false, flip = false, tint = 0xffffff) {
    const s = new Sprite(this.atlas.tex(big ? 'slash_big' : 'slash'));
    s.anchor.set(0.5);
    s.rotation = angle;
    s.scale.set(1, flip ? -1 : 1);
    s.tint = tint;
    s.x = SX(x) + Math.cos(angle) * 6;
    s.y = SY(y, z) - 6 + Math.sin(angle) * 6;
    s.life = 0.16;
    s.max = 0.16;
    this.top.addChild(s);
    this.numbers.push(Object.assign(s, { isFx: true }));
  }

  ringFx(x, y, z, scale = 1, tint = 0xffffff, life = 0.3) {
    const s = new Sprite(this.atlas.tex('ring'));
    s.anchor.set(0.5);
    s.tint = tint;
    s.x = SX(x);
    s.y = SY(y, z);
    s.life = life;
    s.max = life;
    s.grow = scale;
    this.top.addChild(s);
    this.numbers.push(Object.assign(s, { isFx: true, isRing: true }));
  }

  // ---------- 업데이트 ----------
  update(dt) {
    const p = this.g.player;
    for (let k = this.timers.length - 1; k >= 0; k--) {
      const tm = this.timers[k];
      tm.t -= dt;
      if (tm.t <= 0) {
        this.timers.splice(k, 1);
        tm.fn();
      }
    }
    for (const e of this.enemies) if (e.alive) e.update(dt, p);
    this.enemies = this.enemies.filter((e) => e.alive);

    // 투사체
    for (const pr of this.projectiles) {
      if (!pr.alive) continue;
      const step = pr.speed * dt;
      pr.x += pr.dx * step;
      pr.y += pr.dy * step;
      pr.dist += step;
      const g = this.t.groundAt(pr.x, pr.y);
      if (g > pr.z + 0.3 || pr.dist > pr.range) {
        pr.alive = false;
        pr.onEnd?.(pr);
        continue;
      }
      for (const e of this.enemies) {
        if (!e.alive || pr.hit.has(e)) continue;
        if (Math.hypot(e.x - pr.x, e.y - pr.y) < e.r + pr.radius) {
          pr.hit.add(e);
          pr.onHit?.(e, pr);
          if (!pr.pierce) {
            pr.alive = false;
            pr.onEnd?.(pr);
            break;
          }
        }
      }
    }
    for (const pr of this.projectiles) {
      if (!pr.alive) {
        pr.s.parent?.removeChild(pr.s);
        continue;
      }
    }
    this.projectiles = this.projectiles.filter((x) => x.alive);

    // 범위
    for (const a of this.areas) {
      a.t += dt;
      if (a.onTick && !a.telegraph) {
        a.tickT -= dt;
        if (a.tickT <= 0) {
          a.tickT = a.tick || 0.5;
          a.onTick(this.inCircle(a.x, a.y, a.r), a);
        }
      }
      if (a.follow) {
        a.x = a.follow.x;
        a.y = a.follow.y;
        a.z = a.follow.z;
      }
    }
    for (const a of this.areas)
      if (a.t >= a.time) {
        a.g.clear();
        a.g.visible = false;
        a.g.parent?.removeChild(a.g);
        this.gfxPool.push(a.g);
        a.done?.(a);
      }
    this.areas = this.areas.filter((a) => a.t < a.time);

    // 숫자, 효과
    for (const n of this.numbers) {
      n.life -= dt;
      if (n.isFx) {
        const k = Math.max(0, n.life / n.max);
        n.alpha = k;
        if (n.isRing) n.scale.set(n.grow * (1.2 - k));
        continue;
      }
      n.vz -= 7 * dt;
      n.wz += n.vz * dt;
      n.alpha = Math.min(1, n.life * 4);
    }
    for (const n of this.numbers)
      if (n.life <= 0) {
        n.parent?.removeChild(n);
        if (!n.isFx) this.numPool.push(n);
      }
    this.numbers = this.numbers.filter((n) => n.life > 0);
  }

  render(wr) {
    for (const e of this.enemies) e.render(wr);
    for (const pr of this.projectiles) {
      pr.s.x = Math.round(SX(pr.x));
      pr.s.y = Math.round(SY(pr.y, pr.z) - 6);
      wr.placeEntity(pr.s, pr.x, pr.y);
    }
    for (const a of this.areas) {
      const g = a.g;
      g.clear();
      const k = a.telegraph ? Math.min(1, a.t / a.time) : 1;
      const cx = SX(a.x);
      const cy = SY(a.y, a.z || 0);
      const rr = a.r * TILE;
      const fade = a.telegraph ? 1 : Math.min(1, (a.time - a.t) * 3, a.t * 6);
      g.ellipse(cx, cy, rr, rr * 0.85).fill({ color: a.color, alpha: (a.telegraph ? 0.18 : 0.22) * fade });
      if (a.telegraph) g.ellipse(cx, cy, rr * k, rr * 0.85 * k).fill({ color: a.color, alpha: 0.28 });
      g.ellipse(cx, cy, rr, rr * 0.85).stroke({ color: a.color, alpha: 0.7 * fade, width: 1 });
    }
    for (const n of this.numbers) {
      if (n.isFx) continue;
      n.x = Math.round(SX(n.wx));
      n.y = Math.round(SY(n.wy, n.wz));
    }
  }
}
