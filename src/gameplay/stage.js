// 섬 진행 관리: 구역 잠금과 웨이브, 체크포인트/목숨, 함정과 장치, 비밀 방, 골드, 보스, 결과
import { Sprite } from 'pixi.js';
import { sx as SX, sy as SY } from '../core/view.js';
import { MONSTER_TYPES, AFFIXES, Breakable } from './monsters.js';
import { KingBoar } from './boss.js';

const $ = (id) => document.getElementById(id);

const WAVES = [
  [['dog', 'dog', 'dog', 'thrower'], ['dog', 'dog', 'shield']],
  [['thrower', 'thrower', 'shield', 'dog'], ['boar', 'dog', 'dog', 'shaman']],
  [['boar', 'boar', 'bomber', 'thrower'], ['ELITE', 'dog', 'dog', 'shaman']],
  [['shield', 'shield', 'shaman', 'bomber', 'bomber'], ['ELITE', 'boar', 'thrower', 'thrower']],
];
const ELITE_BASE = ['dog', 'shield', 'boar', 'thrower'];

export class Stage {
  constructor(game) {
    this.g = game;
    this.t = game.terrain;
    this.lives = 3;
    this.gold = 0;
    this.deaths = 0;
    this.kills = 0;
    this.time = 0;
    this.secretFound = false;
    this.finished = false;
    this.active = null;
    this.cleared = new Set();
    this.coins = [];
    this.checkpoint = { ...this.t.spawn };
    this.prompt = null;
    this.boss = null;
    game.player.respawnPoint = this.checkpoint;
    game.player.holdDead = false;

    // 장치/물건 그림
    this.objs = this.t.objects.map((o) => ({ ...o, timer: o.phase ?? o.offset ?? 0, up: false, open: o.type === 'gate' && o.role === 'in', s: null }));
    for (const o of this.objs) {
      o.s = new Sprite(game.atlas.tex(this.texFor(o)));
      const floor = o.type === 'spike' || o.type === 'plate';
      const top = this.t.topAt(o.i, o.j);
      o.top = Number.isNaN(top) ? 0 : top;
      if (floor) {
        o.s.x = SX(o.i);
        o.s.y = SY(o.j, o.top);
        o.s.zIndex = o.j;
      } else {
        const m = game.atlas.anchor(this.texFor(o));
        o.s.anchor.set(m.ax / m.w, m.ay / m.h);
        o.s.x = SX(o.i + 0.5);
        o.s.y = SY(o.j + 0.85, o.top);
      }
      game.world.placeEntity(o.s, o.i + 0.5, floor ? o.j : o.j + 0.85);
      this.setSolid(o);
    }
    // 부술 수 있는 물건
    for (const b of this.t.breakables) game.combat.enemies.push(new Breakable(game.combat, b.x, b.y, b.tex));
    this.updateHud();
    $('stage-hud').classList.remove('hidden');
  }

  destroy() {
    for (const o of this.objs) o.s.parent?.removeChild(o.s);
    for (const c of this.coins) c.s.parent?.removeChild(c.s);
    $('stage-hud').classList.add('hidden');
    $('bossbar').classList.add('hidden');
    $('prompt').classList.add('hidden');
    $('tb-interact')?.classList.add('hidden');
    this.g.player.respawnPoint = null;
    this.g.player.holdDead = false;
  }

  texFor(o) {
    switch (o.type) {
      case 'gate':
      case 'door':
        return o.open ? 'gate_1' : 'gate_0';
      case 'spike':
        return o.up ? 'spike_1' : 'spike_0';
      case 'plate':
        return o.pressed ? 'plate_1' : 'plate_0';
      case 'hswitch':
        return o.lit ? 'hswitch_1' : 'hswitch_0';
      case 'chest':
        return o.open ? 'chest_1' : 'chest_0';
      case 'campfire':
        return 'fire_tile';
      case 'shard':
        return 'shard';
      default:
        return o.type;
    }
  }

  refresh(o) {
    o.s.texture = this.g.atlas.tex(this.texFor(o));
    this.setSolid(o);
  }

  setSolid(o) {
    const t = this.t;
    if (t.isVoid(o.i, o.j)) return;
    let solid = false;
    if (o.type === 'gate' || o.type === 'door') solid = !o.open;
    else if (o.type === 'rockwall') solid = !o.gone;
    else if (['launcher', 'chest', 'hswitch', 'campfire'].includes(o.type)) solid = true;
    if (o.type === 'spike' || o.type === 'plate' || o.type === 'shard') return;
    t.solid[t.idx(o.i, o.j)] = solid ? 1 : 0;
  }

  // ---------------- 몬스터 ----------------
  spawnMonster(type, x, y, opts = {}) {
    const C = MONSTER_TYPES[type];
    if (!C) return null;
    const m = new C(this.g.combat, x, y, opts);
    if (opts.elite) m.makeElite(opts.affixes);
    if (opts.instant) m.spawnT = 0.1;
    m.zone = this.active?.index;
    this.g.combat.enemies.push(m);
    this.g.fx.burst(x, y, m.z + 0.3, { count: 12, speed: 2.2, up: 2, color: 0xe9dcc0 });
    return m;
  }

  spawnWave(z, list) {
    const p = this.g.player;
    const t = this.t;
    const late = z.index >= 2;
    for (const raw of list) {
      let type = raw;
      let opts = {};
      if (raw === 'ELITE') {
        type = ELITE_BASE[Math.floor(Math.random() * ELITE_BASE.length)];
        const keys = Object.keys(AFFIXES).sort(() => Math.random() - 0.5);
        opts = { elite: true, affixes: keys.slice(0, z.index >= 3 ? 2 : 1) };
      }
      // 빈 칸 찾기 (플레이어와 떨어진 곳)
      for (let n = 0; n < 120; n++) {
        const i = z.x0 + 2 + Math.floor(Math.random() * (z.x1 - z.x0 - 3));
        const j = 6 + Math.floor(Math.random() * 14);
        if (t.isVoid(i, j) || t.isSolid(i, j)) continue;
        if (Math.hypot(i + 0.5 - p.x, j + 0.5 - p.y) < (late ? 4.5 : 5.5)) continue;
        // 투석병은 언덕 위를 좋아함
        if (z.high && type === 'thrower' && t.topAt(i, j) < 1 && n < 60) continue;
        if (!z.high && t.topAt(i, j) !== 0) continue;
        this.g.combat.telegraph(i + 0.5, j + 0.5, t.topAt(i, j), 0.6, 0.5, 0xffffff);
        this.g.combat.after(0.5, () => this.spawnMonster(type, i + 0.5, j + 0.5, opts));
        break;
      }
    }
  }

  zoneEnemies(z) {
    return this.g.combat.enemies.filter((e) => e.alive && e.zone === z.index && e.kind !== 'breakable');
  }

  // ---------------- 구역 ----------------
  enterZone(z) {
    this.active = z;
    z.wave = 0;
    z.pending = 0.6;
    for (const o of this.objs)
      if (o.type === 'gate' && o.zone === z.index) {
        o.open = false;
        this.refresh(o);
      }
    this.checkpoint = { ...z.entry, z: 0 };
    this.g.player.respawnPoint = this.checkpoint;
    this.g.sfx.tone(180, 0.25, 'square', 0.05, 0.6);
    this.g.shake(2);
    this.updateHud();
    if (z.boss) this.startBoss(z);
    else this.g.toast(`구역 ${z.index + 1}/4 · ${z.name}`);
  }

  clearZone(z) {
    this.cleared.add(z.index);
    this.active = null;
    for (const o of this.objs)
      if (o.type === 'gate' && o.zone === z.index) {
        o.open = true;
        this.refresh(o);
        this.g.fx.burst(o.i + 0.5, o.j + 0.5, o.top + 0.5, { count: 8, speed: 2, color: 0xa06a44 });
      }
    this.g.sfx.ok();
    this.g.toast(z.boss ? '아레나의 문이 열렸다' : '구역 정리! 다음 다리가 열렸어요');
    this.updateHud();
  }

  async startBoss(z) {
    const g = this.g;
    const t = this.t;
    const bx = z.cx;
    const by = 12.5;
    const king = new KingBoar(g.combat, bx + 3, by);
    king.zone = z.index;
    king.face = -1;
    king.invuln = true;
    king.state = 'rest';
    king.stT = 99;
    g.combat.enemies.push(king);
    this.boss = king;
    await g.cut(async (d) => {
      await d.camTo(bx + 3, by, 1.0);
      g.sfx.rumble();
      d.shake(6);
      await d.wait(0.4);
      $('bossintro').classList.remove('hidden');
      $('bossintro').classList.add('show');
      await d.wait(2.0);
      $('bossintro').classList.remove('show');
      $('bossintro').classList.add('hidden');
      d.camFollow();
    });
    king.invuln = false;
    king.stT = 0.6;
    $('bossbar').classList.remove('hidden');
    $('boss-name').textContent = '바위등 멧돼지왕';
    void t;
  }

  onBossPhase() {
    this.g.flashScreen(0.3);
  }

  onEnemyDeath(e, fell) {
    if (e.kind === 'breakable') {
      this.dropCoins(e.x, e.y, e.z, 1 + Math.floor(Math.random() * 3));
      return;
    }
    this.kills++;
    if (!fell) this.dropCoins(e.x, e.y, e.z, e.boss ? 40 : e.elite ? 12 : 2 + Math.floor(Math.random() * 3));
    if (fell) this.g.toastWorld(e.x, e.y, e.z, '추락!', 0xffe08a);
    if (e.boss) this.bossDown(e);
  }

  bossDown(e) {
    const g = this.g;
    $('bossbar').classList.add('hidden');
    g.slowmo(1.2, 0.25);
    g.flashScreen(0.6);
    g.shake(10);
    g.sfx.boom();
    g.fx.burst(e.x, e.y, e.z + 1, { count: 50, speed: 6, up: 6, color: 0x8d5a3c, size: 2, life: 1 });
    g.fx.burst(e.x, e.y, e.z + 2, { count: 30, speed: 5, up: 5, color: 0x9aa0ac, size: 2, life: 1 });
    // 천공석 파편
    const o = { type: 'shard', i: Math.floor(e.x), j: Math.floor(e.y), s: null, top: e.z, bob: 0 };
    o.s = new Sprite(g.atlas.tex('shard'));
    const m = g.atlas.anchor('shard');
    o.s.anchor.set(m.ax / m.w, m.ay / m.h);
    o.x = e.x;
    o.y = e.y;
    g.world.placeEntity(o.s, o.x, o.y);
    this.objs.push(o);
    this.shardObj = o;
    g.toastWorld(e.x, e.y, e.z + 2, '천공석 파편이 떨어졌다!', 0x9df0ff);
  }

  // ---------------- 골드 ----------------
  dropCoins(x, y, z, n) {
    for (let k = 0; k < n; k++) {
      const s = new Sprite(this.g.atlas.tex('coin_0'));
      s.anchor.set(0.5, 1);
      const a = Math.random() * Math.PI * 2;
      const sp = 1 + Math.random() * 2;
      this.coins.push({ s, x, y, z: z + 0.3, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, vz: 3 + Math.random() * 2, age: 0, value: 1 });
    }
  }

  updateCoins(dt) {
    const p = this.g.player;
    for (const c of this.coins) {
      c.age += dt;
      const d = Math.hypot(p.x - c.x, p.y - c.y);
      if (c.age > 0.45 && d < 0.35 && p.alive) {
        c.got = true;
        this.gold += c.value;
        this.g.sfx.tone(1100 + Math.random() * 200, 0.05, 'square', 0.03);
      } else if (c.age > 0.45 && d < 2.2 && p.alive) {
        // 자동 줍기: 플레이어에게 끌려감
        const k = 9 / Math.max(0.3, d);
        c.x += ((p.x - c.x) / d) * Math.min(d, k * dt);
        c.y += ((p.y - c.y) / d) * Math.min(d, k * dt);
        c.z += (p.z + 0.4 - c.z) * Math.min(1, dt * 8);
      } else {
        c.vz -= 18 * dt;
        c.x += c.vx * dt;
        c.y += c.vy * dt;
        c.vx *= 1 - dt * 2.5;
        c.vy *= 1 - dt * 2.5;
        const g = this.t.groundAt(c.x, c.y);
        c.z += c.vz * dt;
        if (g !== -Infinity && c.z < g) {
          c.z = g;
          c.vz = Math.abs(c.vz) > 2 ? -c.vz * 0.4 : 0;
        }
        if (g === -Infinity && c.z < -4) c.got = true;
      }
      c.s.texture = this.g.atlas.tex(`coin_${Math.floor(Math.abs(c.age * 10 + c.x)) % 4}`);
      c.s.x = Math.round(SX(c.x));
      c.s.y = Math.round(SY(c.y, c.z));
      this.g.world.placeEntity(c.s, c.x, c.y);
    }
    for (const c of this.coins) if (c.got) c.s.parent?.removeChild(c.s);
    const before = this.coins.length;
    this.coins = this.coins.filter((c) => !c.got);
    if (before !== this.coins.length) this.updateHud();
  }

  // ---------------- 함정과 장치 ----------------
  updateObjects(dt) {
    const g = this.g;
    const p = g.player;
    const pi = Math.floor(p.x);
    const pj = Math.floor(p.y);
    let near = null;
    let nearD = 1.4;
    for (const o of this.objs) {
      if (o.type === 'spike') {
        o.timer = (o.timer + dt) % 2.4;
        const up = o.timer >= 1.6;
        const warn = o.timer >= 1.3 && o.timer < 1.6;
        o.s.x = SX(o.i) + (warn ? (Math.random() < 0.5 ? -1 : 1) : 0);
        if (up !== o.up) {
          o.up = up;
          this.refresh(o);
          if (up) {
            o.hitDone = false;
            if (Math.hypot(o.i - pi, o.j - pj) < 6) g.sfx.tone(520, 0.05, 'square', 0.02);
          }
        }
        if (o.up && !o.hitDone) {
          if (pi === o.i && pj === o.j && p.grounded) {
            o.hitDone = !!p.hurt(10, 0, 0);
          }
          for (const e of g.combat.inCircle(o.i + 0.5, o.j + 0.5, 0.2)) if (e.kind !== 'breakable') g.combat.damage(e, 8, { noKnock: true, crit: false });
        }
      } else if (o.type === 'launcher') {
        o.timer += dt;
        const glint = o.timer > o.every - 0.35;
        o.s.tint = glint ? 0xffb0a0 : 0xffffff;
        if (o.timer >= o.every) {
          o.timer = 0;
          g.combat.shoot({ x: o.i + 0.5 + o.dx * 0.6, y: o.j + 0.5 + o.dy * 0.8, z: o.top + 0.6, dx: o.dx, dy: o.dy, speed: 8.5, range: 13, tex: 'arrow', hostile: true, dmg: 9, radius: 0.22 });
          if (Math.abs(o.i - pi) < 12) g.sfx.shoot();
        }
      } else if (o.type === 'plate') {
        const on = pi === o.i && pj === o.j;
        if (on && !o.pressed) {
          o.pressed = true;
          this.refresh(o);
          g.sfx.ok();
          for (const d of this.objs)
            if (d.type === 'door' && !d.open) {
              d.open = true;
              this.refresh(d);
              g.fx.burst(d.i + 0.5, d.j + 0.5, d.top + 0.5, { count: 8, speed: 2, color: 0xa06a44 });
            }
          g.toast('철컥! 울타리 문이 열렸어요');
          g.shake(2);
        }
      } else if (o.type === 'campfire') {
        o.s.scale.set(1, 0.9 + Math.sin(performance.now() / 90 + o.i) * 0.1);
      } else if (o.type === 'shard') {
        o.bob += dt;
        o.s.x = SX(o.x);
        o.s.y = SY(o.y, o.top) - 6 - Math.sin(o.bob * 3) * 3;
        if (Math.random() < 0.3) g.fx.burst(o.x, o.y, o.top + 1, { count: 1, speed: 0.8, up: 1.5, color: 0x9df0ff, gravity: 1 });
        if (!this.finished && Math.hypot(p.x - o.x, p.y - o.y) < 0.8) this.finish();
      }
      // 조사 가능한 물건
      const canUse = (o.type === 'hswitch' && !o.lit) || (o.type === 'chest' && !o.open && (!o.secret || this.secretOpened));
      if (canUse) {
        const d = Math.hypot(p.x - (o.i + 0.5), p.y - (o.j + 0.5));
        if (d < nearD) {
          nearD = d;
          near = o;
        }
      }
    }
    this.prompt = near;
    const pr = $('prompt');
    const tb = $('tb-interact');
    if (near && g.state === 'play') {
      const [cx, cy] = g.worldToCss(near.i + 0.5, near.j + 0.5, near.top + 1.8);
      pr.style.left = `${cx}px`;
      pr.style.top = `${cy}px`;
      pr.textContent = g.input.isTouch ? (near.type === 'chest' ? '열기' : '조사하기') : `G  ${near.type === 'chest' ? '열기' : '조사하기'}`;
      pr.classList.remove('hidden');
      tb?.classList.remove('hidden');
    } else {
      pr.classList.add('hidden');
      tb?.classList.add('hidden');
    }
    if (near && g.input.consume('interact')) this.use(near);
    g.input.consume('interact');
  }

  use(o) {
    const g = this.g;
    if (o.type === 'hswitch') {
      o.lit = true;
      this.refresh(o);
      this.secretOpened = true;
      g.sfx.ok();
      g.shake(4);
      for (const w of this.objs)
        if (w.type === 'rockwall' && w.secret) {
          w.gone = true;
          w.s.visible = false;
          this.setSolid(w);
          g.fx.burst(w.i + 0.5, w.j + 0.5, w.top + 0.5, { count: 16, speed: 3, up: 3, color: 0x9aa0ac, size: 2 });
        }
      g.toast('어디선가 바위가 무너지는 소리가… 비밀 통로가 열렸어요!');
    } else if (o.type === 'chest') {
      o.open = true;
      this.refresh(o);
      this.secretFound = true;
      this.dropCoins(o.i + 0.5, o.j + 1.2, o.top, 25);
      g.player.potions = Math.min(5, g.player.potions + 1);
      g.sfx.ok();
      g.fx.burst(o.i + 0.5, o.j + 0.5, o.top + 0.8, { count: 20, speed: 2.5, up: 4, color: 0xffd84a, gravity: 4 });
      g.toast('비밀 보물상자! 골드 듬뿍 + 물약 1개');
      this.updateHud();
    }
  }

  // ---------------- 매 프레임 ----------------
  update(dt) {
    const g = this.g;
    const p = g.player;
    if (!this.finished) this.time += dt;
    // 구역 진입
    if (!this.active)
      for (const z of this.t.zones) {
        if (this.cleared.has(z.index)) continue;
        if (z.gateX === undefined) z.gateX = Math.max(z.x0, ...this.objs.filter((o) => o.type === 'gate' && o.zone === z.index && o.role === 'in').map((o) => o.i));
        const inside = z.boss ? p.x > z.gateX + 1.7 : p.x > z.x0 + 1.3 && p.x < z.x1 - 0.8;
        if (inside && p.alive) {
          this.enterZone(z);
          break;
        }
      }
    const z = this.active;
    if (z && !z.boss) {
      if (z.pending > 0) {
        z.pending -= dt;
        if (z.pending <= 0) {
          this.spawnWave(z, this.wavesFor(z)[z.wave]);
          z.wave++;
          z.waitT = 1.2;
        }
      } else {
        z.waitT -= dt;
        const alive = this.zoneEnemies(z).length;
        const waves = this.wavesFor(z);
        if (z.waitT <= 0 && z.wave < waves.length && alive <= 1) {
          this.spawnWave(z, waves[z.wave]);
          z.wave++;
          z.waitT = 1.2;
        } else if (z.waitT <= 0 && z.wave >= waves.length && alive === 0) this.clearZone(z);
      }
    } else if (z && z.boss && this.boss) {
      const b = this.boss;
      $('boss-fill').style.width = `${Math.max(0, (b.hp / b.maxHp) * 100)}%`;
      if (!b.alive && !this.cleared.has(z.index)) this.clearZone(z);
    }
    this.updateObjects(dt);
    this.updateCoins(dt);
  }

  wavesFor(z) {
    const base = WAVES[Math.min(3, z.index)].map((w) => [...w]);
    if (z.type === 'camp') base[1].push('bomber');
    if (z.type === 'traps') base[0].pop();
    return base;
  }

  onPlayerDead() {
    this.deaths++;
    this.lives--;
    this.updateHud();
    if (this.lives <= 0) {
      this.g.player.holdDead = true;
      setTimeout(() => this.showResult(false), 1400);
    } else this.g.toast(`남은 목숨 ${this.lives}개 · 체크포인트에서 다시 시작해요`);
  }

  updateHud() {
    $('lives').innerHTML = '♥'.repeat(Math.max(0, this.lives)) + '<i>' + '♥'.repeat(Math.max(0, 3 - this.lives)) + '</i>';
    $('gold').textContent = this.gold;
    const z = this.active;
    $('zone-name').textContent = z ? (z.boss ? '제1장 · 초원 · 보스' : `제1장 · 초원 · 구역 ${z.index + 1}/4`) : '제1장 · 초원';
  }

  // ---------------- 클리어 ----------------
  async finish() {
    this.finished = true;
    const g = this.g;
    g.sfx.ok();
    setTimeout(() => g.sfx.ok(), 180);
    g.flashScreen(0.5);
    if (this.shardObj) this.shardObj.s.visible = false;
    g.toast('첫 번째 천공석 파편을 되찾았다!');
    g.player.holdDead = true;
    setTimeout(() => this.showResult(true), 1600);
  }

  showResult(win) {
    const g = this.g;
    const stars = win ? 1 + (this.deaths === 0 ? 1 : 0) + (this.secretFound ? 1 : 0) : 0;
    const m = Math.floor(this.time / 60);
    const s = Math.floor(this.time % 60);
    const box = $('result');
    box.querySelector('.res-title').textContent = win ? '섬 클리어!' : '섬 실패…';
    box.querySelector('.res-stars').innerHTML = win
      ? [0, 1, 2].map((k) => `<span class="${k < stars ? 'on' : ''}" style="animation-delay:${0.3 + k * 0.35}s">★</span>`).join('')
      : '<span class="fail">목숨을 모두 잃었어요</span>';
    box.querySelector('.res-list').innerHTML = `
      <div><span>걸린 시간</span><b>${m}분 ${String(s).padStart(2, '0')}초</b></div>
      <div><span>처치</span><b>${this.kills}</b></div>
      <div><span>골드</span><b>${this.gold}</b></div>
      <div><span>남은 목숨</span><b>${Math.max(0, this.lives)}</b></div>
      ${win ? `<div class="res-hint"><span>★ 클리어 · ★ 목숨 잃지 않기 · ★ 비밀 방 찾기</span></div>` : '<div class="res-hint"><span>모은 골드는 그대로 가져가요</span></div>'}`;
    g.save.gold = (g.save.gold || 0) + this.gold;
    if (win) {
      const prev = g.save.island1 || {};
      g.save.island1 = { stars: Math.max(prev.stars || 0, stars), best: Math.min(prev.best || 1e9, Math.round(this.time)) };
    }
    g.saveGame();
    g.setState('result');
    box.classList.remove('hidden');
  }
}
