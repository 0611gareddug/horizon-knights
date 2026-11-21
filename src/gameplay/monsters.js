// 초원 몬스터 6종 + 엘리트 접두어 + 부술 수 있는 물건
import { Text } from 'pixi.js';
import { Enemy, moveActor } from './combat.js';

const rand = (a, b) => a + Math.random() * (b - a);

export const AFFIXES = {
  fast: '빠른',
  giant: '거대한',
  burning: '불타는',
  frozen: '얼어붙은',
  shocked: '감전된',
  split: '분열하는',
  vamp: '흡혈하는',
  shield: '보호막',
  teleport: '순간이동',
  vengeful: '복수하는',
};
const AFFIX_COLOR = 0xffb84a;

export class Monster extends Enemy {
  constructor(c, kind, x, y, opts = {}) {
    super(c, kind, x, y);
    this.elite = !!opts.elite;
    this.mini = !!opts.mini;
    this.face = 1;
    this.state = 'idle';
    this.stT = 0;
    this.cd = rand(0.4, 1.2);
    this.animT = Math.random() * 2;
    this.spawnT = 0.45;
    this.aggro = false;
    this.affixes = [];
    this.affixT = {};
    this.shield = 0;
    this.speedBoost = 1;
    this.barY = 20;
    this.chunkColor = 0x82c34a;
  }

  setStats(hp, atk, speed, r) {
    this.maxHp = this.hp = hp;
    this.atk = atk;
    this.speed = speed;
    this.r = r;
    if (this.mini) {
      this.maxHp = this.hp = Math.round(hp * 0.35);
      this.body.scale.set(0.75);
      this.r *= 0.75;
    }
  }

  makeElite(affixes) {
    this.elite = true;
    this.affixes = affixes;
    this.maxHp = this.hp = this.maxHp * 4;
    this.atk = Math.round(this.atk * 1.3);
    let scale = 1.3;
    if (affixes.includes('giant')) {
      scale = 1.6;
      this.maxHp = this.hp = Math.round(this.maxHp * 1.5);
      this.noKnock = true;
    }
    if (affixes.includes('fast')) this.speedBoost = 1.4;
    this.baseScale = scale;
    this.body.scale.set(scale);
    this.r *= 1.2;
    this.barY = Math.round(this.barY * scale);
    const name = affixes.map((a) => AFFIXES[a]).join(' ') + ' ' + this.displayName;
    this.label = new Text({
      text: name,
      style: { fontFamily: 'Galmuri11', fontSize: 11, fill: AFFIX_COLOR, stroke: { color: 0x16141e, width: 3 } },
      resolution: (this.c.g.scale || 2) * 2,
    });
    this.label.anchor.set(0.5, 1);
    this.label.scale.set(0.5);
    this.view.addChild(this.label);
  }

  get spd() {
    return this.speed * this.speedMul * this.speedBoost * (this.st.slow > 0 ? 1 : 1);
  }

  dist(p) {
    return Math.hypot(p.x - this.x, p.y - this.y);
  }

  moveToward(tx, ty, mul, dt) {
    const dx = tx - this.x;
    const dy = ty - this.y;
    const d = Math.hypot(dx, dy) || 1;
    // 섬 밖으로 걸어가지 않음
    const nx = this.x + (dx / d) * 0.6;
    const ny = this.y + (dy / d) * 0.6;
    if (this.c.t.groundAt(nx, ny) === -Infinity) return false;
    moveActor(this.c.t, this, (dx / d) * this.spd * mul * dt, (dy / d) * this.spd * mul * dt);
    if (Math.abs(dx) > 0.05) this.face = dx > 0 ? 1 : -1;
    this.moving = true;
    return true;
  }

  // 원하는 거리를 유지
  keepAt(p, want, dt) {
    const d = this.dist(p);
    if (d < want - 1) this.moveToward(this.x - (p.x - this.x), this.y - (p.y - this.y), 0.9, dt);
    else if (d > want + 1.5) this.moveToward(p.x, p.y, 1, dt);
    this.face = p.x > this.x ? 1 : -1;
  }

  hitPlayer(p, dmg, kx, ky) {
    if (!p.alive) return;
    const got = p.hurt(dmg, kx, ky);
    if (!got) return;
    if (this.affixes.includes('frozen')) p.slowT = 1.5;
    if (this.affixes.includes('vamp')) {
      this.hp = Math.min(this.maxHp, this.hp + got * 0.3);
      this.c.fx.burst(this.x, this.y, this.z + 0.6, { count: 5, speed: 1, color: 0xff5a6a });
    }
  }

  update(dt, p) {
    this.updateStatus(dt);
    this.animT += dt;
    this.moving = false;
    if (this.spawnT > 0) {
      this.spawnT -= dt;
      this.untargetable = this.spawnT > 0.15;
      this.physics(dt);
      return;
    }
    this.untargetable = false;
    this.cd -= dt * this.speedBoost;
    if (this.dist(p) < 9 && p.alive) this.aggro = true;
    if (this.st.stun > 0 || this.st.frozen > 0) {
      this.physics(dt);
      return;
    }
    this.affixTick(dt, p);
    this.ai(dt, p);
    this.physics(dt);
  }

  affixTick(dt, p) {
    const A = this.affixes;
    if (!A.length) return;
    const T = this.affixT;
    const tick = (k, every) => {
      T[k] = (T[k] ?? rand(0, every)) - dt;
      if (T[k] <= 0) {
        T[k] = every;
        return true;
      }
      return false;
    };
    if (A.includes('burning') && tick('burn', 0.7)) this.c.hostileArea(this.x, this.y, this.z, 0.6, 2.6, 0.5, 4, 0xff8a3d);
    if (A.includes('shocked') && tick('shock', 3.6) && this.aggro) this.c.explodeAt(this.x, this.y, this.z, 1.8, 0.6, 10, 0, 0xd59cff);
    if (A.includes('shield') && tick('shield', 6))
      for (const o of this.c.inCircle(this.x, this.y, 4)) {
        if (o === this || o.kind === 'breakable') continue;
        o.shield = Math.max(o.shield || 0, o.maxHp * 0.2);
        this.c.ringFx(o.x, o.y, o.z, 0.5, 0x9df0ff, 0.4);
      }
    if (A.includes('teleport') && tick('tp', 5) && this.aggro && this.dist(p) > 3) {
      this.c.fx.burst(this.x, this.y, this.z + 0.5, { count: 10, speed: 2, color: 0xb48cff });
      const a = Math.random() * Math.PI * 2;
      const nx = p.x + Math.cos(a) * 1.8;
      const ny = p.y + Math.sin(a) * 1.8;
      if (this.c.t.groundAt(nx, ny) !== -Infinity && !this.c.t.isSolid(Math.floor(nx), Math.floor(ny))) {
        this.x = nx;
        this.y = ny;
        this.z = this.c.t.groundAt(nx, ny);
      }
      this.c.fx.burst(this.x, this.y, this.z + 0.5, { count: 10, speed: 2, color: 0xb48cff });
    }
  }

  die(fell) {
    if (!this.alive) return;
    super.die(fell);
    if (fell) return;
    if (this.affixes.includes('vengeful')) this.c.explodeAt(this.x, this.y, this.z, 2.2, 0.8, 20, 0, 0xff5a4a);
    if (this.affixes.includes('split') && !this.mini)
      for (let k = 0; k < 2; k++) {
        const m = this.c.g.stage?.spawnMonster(this.kind, this.x + (k ? 0.4 : -0.4), this.y, { mini: true, instant: true });
        if (m) m.aggro = true;
      }
  }

  render(wr) {
    super.render(wr);
    const sc = (this.baseScale || (this.mini ? 0.75 : 1)) * (this.flash > 0 ? 1.08 : 1);
    this.body.scale.set(sc * this.face, sc);
    if (this.spawnT > 0) this.body.alpha = 1 - this.spawnT / 0.45;
    if (this.shield > 0) this.body.tint = 0xbff4ff;
    if (this.label) this.label.y = -this.barY - 3;
  }
}

// ---------------- 들개: 빠르게 다가와 물기 ----------------
export class Dog extends Monster {
  constructor(c, x, y, o) {
    super(c, 'dog', x, y, o);
    this.displayName = '들개';
    this.setStats(34, 7, 3.1, 0.3);
    this.barY = 14;
    this.chunkColor = 0x9c7c5a;
  }
  frameName() {
    const p = this.elite ? 'dogE' : 'dog';
    if (this.state === 'wind' || this.state === 'lunge') return `${p}_4`;
    return `${p}_${this.moving ? Math.floor(this.animT * 10) % 4 : 0}`;
  }
  ai(dt, p) {
    if (this.state === 'wind') {
      this.stT -= dt;
      if (this.stT <= 0) {
        this.state = 'lunge';
        this.stT = 0.2;
        this.hitDone = false;
      }
      return;
    }
    if (this.state === 'lunge') {
      this.stT -= dt;
      moveActor(this.c.t, this, this.lx * 9 * dt, this.ly * 9 * dt);
      if (!this.hitDone && this.dist(p) < this.r + 0.4) {
        this.hitDone = true;
        this.hitPlayer(p, this.atk, this.lx, this.ly);
      }
      if (this.stT <= 0) {
        this.state = 'rest';
        this.stT = 0.6;
      }
      return;
    }
    if (this.state === 'rest') {
      this.stT -= dt;
      if (this.stT <= 0) this.state = 'idle';
      return;
    }
    if (!this.aggro) return;
    const d = this.dist(p);
    if (d < 1.3 && this.cd <= 0) {
      this.state = 'wind';
      this.stT = 0.35 / this.speedBoost;
      this.cd = 1.1;
      this.lx = (p.x - this.x) / d;
      this.ly = (p.y - this.y) / d;
      this.face = this.lx > 0 ? 1 : -1;
      return;
    }
    // 살짝 옆으로 돌아 들어가며 접근 (무리 사냥)
    const side = (this.id ?? (this.id = Math.random())) > 0.5 ? 1 : -1;
    const ox = -(p.y - this.y) / (d || 1);
    const oy = (p.x - this.x) / (d || 1);
    const k = d > 2.5 ? 0.8 : 0;
    this.moveToward(p.x + ox * side * k, p.y + oy * side * k, 1, dt);
  }
}

// ---------------- 고블린 공통 ----------------
class Goblin extends Monster {
  constructor(c, sub, x, y, o) {
    super(c, sub, x, y, o);
    this.sub = sub;
    this.barY = 19;
    this.chunkColor = 0x82c34a;
  }
  frameName() {
    const p = this.elite ? 'gobE' : 'gob';
    const atk = this.state === 'wind' || this.state === 'act';
    const f = atk ? 2 + (Math.floor(this.animT * 8) % 2) : this.moving ? Math.floor(this.animT * 6) % 2 : 0;
    return `${p}_${this.sub}_${f}`;
  }
}

// 투석병: 거리를 두고 돌을 던짐 (떨어질 곳 미리 표시)
export class Thrower extends Goblin {
  constructor(c, x, y, o) {
    super(c, 'thrower', x, y, o);
    this.displayName = '고블린 투석병';
    this.setStats(30, 9, 2.2, 0.3);
  }
  ai(dt, p) {
    if (this.state === 'wind') {
      this.stT -= dt;
      if (this.stT <= 0) {
        this.state = 'idle';
        const tx = p.x + p.vx * 0.5;
        const ty = p.y + p.vy * 0.5;
        this.c.lob(this.x, this.y, this.z, tx, ty, 0.85, this.atk, 0.8, (dmg, kx, ky) => this.hitPlayer(p, dmg, kx, ky));
        this.c.g.sfx.shoot();
      }
      return;
    }
    if (!this.aggro) return;
    this.keepAt(p, 4.5, dt);
    if (this.cd <= 0 && this.dist(p) < 8) {
      this.state = 'wind';
      this.stT = 0.5;
      this.cd = 2.4;
    }
  }
}

// 나무방패: 앞에서 오는 공격은 크게 막음 (뒤나 옆, 강한 공격에 약함)
export class ShieldGob extends Goblin {
  constructor(c, x, y, o) {
    super(c, 'shield', x, y, o);
    this.displayName = '나무방패 고블린';
    this.setStats(80, 10, 1.4, 0.34);
    this.heavy = true;
    this.fx = 1;
    this.fy = 0;
  }
  modDamage(dmg, opts) {
    const kx = opts.kx || 0;
    const ky = opts.ky || 0;
    const l = Math.hypot(kx, ky);
    const heavy = (opts.knock ?? 3) >= 7 || opts.element;
    if (l > 0.01 && !heavy && (kx * this.fx + ky * this.fy) / l < -0.3) {
      this.c.fx.burst(this.x, this.y, this.z + 0.6, { count: 5, speed: 2, color: 0xffe08a });
      this.c.g.toastWorld(this.x, this.y, this.z, '막힘', 0xffe08a);
      return dmg * 0.2;
    }
    return dmg;
  }
  ai(dt, p) {
    const d = this.dist(p);
    if (d > 0.01 && this.state !== 'act') {
      this.fx = (p.x - this.x) / d;
      this.fy = (p.y - this.y) / d;
    }
    if (this.state === 'wind') {
      this.stT -= dt;
      if (this.stT <= 0) {
        this.state = 'act';
        this.stT = 0.25;
        if (d < 1.5) this.hitPlayer(p, this.atk, this.fx, this.fy);
        this.c.slashFx(this.x, this.y, this.z, Math.atan2(this.fy, this.fx), false, false, 0xffe08a);
      }
      return;
    }
    if (this.state === 'act') {
      this.stT -= dt;
      if (this.stT <= 0) this.state = 'idle';
      return;
    }
    if (!this.aggro) return;
    if (d < 1.3 && this.cd <= 0) {
      this.state = 'wind';
      this.stT = 0.55;
      this.cd = 1.6;
      return;
    }
    this.moveToward(p.x, p.y, 1, dt);
  }
}

// 주술사: 멀리서 다친 동료를 치유
export class Shaman extends Goblin {
  constructor(c, x, y, o) {
    super(c, 'shaman', x, y, o);
    this.displayName = '고블린 주술사';
    this.setStats(38, 5, 2.0, 0.3);
  }
  ai(dt, p) {
    if (this.state === 'wind') {
      this.stT -= dt;
      if (this.stT <= 0) {
        this.state = 'idle';
        const t = this.healTarget;
        if (t && t.alive) {
          const h = Math.round(t.maxHp * 0.25);
          t.hp = Math.min(t.maxHp, t.hp + h);
          this.c.beam(this.x, this.y, this.z, t.x, t.y, t.z, 0x9dff8a);
          this.c.number(t.x, t.y, t.z, h, false, 'heal');
        }
      }
      return;
    }
    if (!this.aggro) return;
    this.keepAt(p, 5.5, dt);
    if (this.cd <= 0) {
      let best = null;
      let ratio = 0.92;
      for (const o of this.c.enemies) {
        if (!o.alive || o === this || o.kind === 'breakable' || o.kind === 'dummy') continue;
        if (Math.hypot(o.x - this.x, o.y - this.y) > 8) continue;
        const rr = o.hp / o.maxHp;
        if (rr < ratio) {
          ratio = rr;
          best = o;
        }
      }
      if (best) {
        this.healTarget = best;
        this.state = 'wind';
        this.stT = 0.6;
        this.cd = 4;
      }
    }
  }
}

// 화약 고블린: 달려와서 심지에 불을 붙이고 폭발 (주변 적도 피해)
export class Bomber extends Goblin {
  constructor(c, x, y, o) {
    super(c, 'bomber', x, y, o);
    this.displayName = '화약 고블린';
    this.setStats(22, 18, 3.4, 0.3);
  }
  ai(dt, p) {
    if (this.state === 'wind') {
      this.stT -= dt;
      this.flash = Math.floor(this.stT * 10) % 2 ? 0.05 : 0;
      if (this.stT <= 0) {
        this.state = 'act';
        this.c.boom(this.x, this.y, this.z, 1.8, this.atk, 30, (dmg, kx, ky) => this.hitPlayer(p, dmg, kx, ky));
        this.hp = 0;
        this.die();
      }
      return;
    }
    if (!this.aggro) return;
    if (this.dist(p) < 1.3) {
      this.state = 'wind';
      this.stT = 0.9;
      this.c.telegraph(this.x, this.y, this.z, 1.8, 0.9, 0xff5a4a);
      return;
    }
    this.moveToward(p.x, p.y, 1, dt);
  }
}

// 뿔멧돼지: 일직선 돌진 (벽에 부딪히면 기절)
export class Boar extends Monster {
  constructor(c, x, y, o) {
    super(c, 'boar', x, y, o);
    this.displayName = '뿔멧돼지';
    this.setStats(70, 13, 1.8, 0.4);
    this.heavy = true;
    this.barY = 18;
    this.chunkColor = 0x8d5a3c;
  }
  frameName() {
    const p = this.elite ? 'boarE' : 'boar';
    if (this.state === 'dizzy') return 'boar_dizzy';
    if (this.state === 'charge' || this.state === 'wind') return `${p}_4`;
    return `${p}_${this.moving ? Math.floor(this.animT * 8) % 4 : 0}`;
  }
  ai(dt, p) {
    if (this.state === 'wind') {
      this.stT -= dt;
      this.x += (Math.random() - 0.5) * 0.02;
      if (this.stT <= 0) {
        this.state = 'charge';
        this.stT = 0.7;
        this.hitDone = false;
      }
      return;
    }
    if (this.state === 'charge') {
      this.stT -= dt;
      const ox = this.x;
      const oy = this.y;
      const sp = 9.5 * this.speedBoost;
      this.kvx = this.cx * sp;
      this.kvy = this.cy * sp;
      moveActor(this.c.t, this, this.cx * sp * dt, this.cy * sp * dt);
      if (Math.random() < 0.5) this.c.fx.burst(this.x, this.y, this.z, { count: 1, speed: 1, up: 1, color: 0xe9dcc0 });
      if (!this.hitDone && this.dist(p) < this.r + 0.4) {
        this.hitDone = true;
        this.hitPlayer(p, this.atk, this.cx, this.cy);
      }
      const moved = Math.hypot(this.x - ox, this.y - oy);
      const edge = this.c.t.groundAt(this.x + this.cx * 0.8, this.y + this.cy * 0.8) === -Infinity;
      if (moved < sp * dt * 0.3 || edge) {
        this.kvx = this.kvy = 0;
        this.state = edge ? 'rest' : 'dizzy';
        this.stT = edge ? 0.5 : 1.4;
        if (!edge) {
          this.c.g.shake(2);
          this.c.fx.burst(this.x + this.cx * 0.4, this.y + this.cy * 0.4, this.z + 0.4, { count: 8, speed: 2.5, color: 0xcfd3db });
          this.st.stun = 1.4;
        }
      } else if (this.stT <= 0) {
        this.kvx = this.kvy = 0;
        this.state = 'rest';
        this.stT = 0.6;
      }
      return;
    }
    if (this.state === 'dizzy' || this.state === 'rest') {
      this.stT -= dt;
      if (this.stT <= 0) this.state = 'idle';
      return;
    }
    if (!this.aggro) return;
    const d = this.dist(p);
    if (d < 6.5 && this.cd <= 0) {
      this.cx = (p.x - this.x) / d;
      this.cy = (p.y - this.y) / d;
      this.face = this.cx > 0 ? 1 : -1;
      this.state = 'wind';
      this.stT = 0.7 / this.speedBoost;
      this.cd = 2.6;
      this.c.lineTelegraph(this.x, this.y, this.z, this.cx, this.cy, 6.6, 0.9, 0.7);
      return;
    }
    this.moveToward(p.x, p.y, 1, dt);
  }
}

// ---------------- 항아리, 상자 (한 대 치면 부서짐) ----------------
export class Breakable extends Enemy {
  constructor(c, x, y, tex) {
    super(c, 'breakable', x, y);
    this.tex = tex;
    this.maxHp = this.hp = 1;
    this.r = 0.35;
    this.static = true;
    this.noKnock = true;
    this.barY = 0;
    this.chunkColor = tex === 'pot' ? 0xc07a52 : 0xa06a44;
    this.i = Math.floor(x);
    this.j = Math.floor(y);
    c.t.solid[c.t.idx(this.i, this.j)] = 1;
  }
  frameName() {
    return this.tex;
  }
  update(dt) {
    this.updateStatus(dt);
  }
  die(fell) {
    if (this.alive) this.c.t.solid[this.c.t.idx(this.i, this.j)] = 0;
    super.die(fell);
  }
}

export const MONSTER_TYPES = { dog: Dog, thrower: Thrower, shield: ShieldGob, shaman: Shaman, bomber: Bomber, boar: Boar };
