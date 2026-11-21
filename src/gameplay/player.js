// 플레이어: 이동, 구르기, 높이(계단/낙하), 섬 밖 추락 — 탑다운
import { Sprite, Container } from 'pixi.js';
import { sx as SX, sy as SY, LEVEL, facingName } from '../core/view.js';
import { CHAR_ANIMS as ANIMS, CHAR_W, CHAR_H, CHAR_AX, CHAR_AY } from '../art/character.js';

let SPEED = 4.4; // 칸/초 (직업에 따라 바뀜)
const ACCEL = 38;
const RADIUS = 0.28;
const STEP_UP = 0.55;
const GRAVITY = 34;
const ROLL_TIME = 0.34;
const ROLL_DIST = 3;
const ROLL_IFRAME = 0.3;
const ROLL_CD = 1.2;
const FALL_RESPAWN = 7;

export class Player {
  constructor(atlas, terrain, prefix = 'hero') {
    this.atlas = atlas;
    this.t = terrain;
    this.prefix = prefix;
    this.x = terrain.spawn.x;
    this.y = terrain.spawn.y;
    this.z = terrain.groundAt(this.x, this.y);
    this.vx = this.vy = this.vz = 0;
    this.px = this.x;
    this.py = this.y;
    this.pz = this.z;
    this.grounded = true;
    this.fx = 0; // 바라보는 방향
    this.fy = 1;
    this.anim = 'idle';
    this.animT = 0;
    this.rollT = 0;
    this.rollCd = 0;
    this.rollDx = 0;
    this.rollDy = 0;
    this.iframe = 0;
    this.hp = 100;
    this.maxHp = 100;
    this.safe = { x: this.x, y: this.y, z: this.z };
    this.safeTimer = 0;
    this.events = [];
    this.alive = true;
    this.lockT = 0;
    this.moveMul = 1;
    this.dashT = 0;
    this.dashVx = 0;
    this.dashVy = 0;
    this.atk = 12;
    this.def = 10;
    this.critChance = 0.1;
    this.ult = 0;
    this.buffs = [];
    this.potions = 3;
    this.potionCd = 0;
    this.healLeft = 0;
    this.deadT = 0;
    this.hurtCd = 0;

    this.view = new Container();
    this.shadow = new Sprite(atlas.tex('shadow_m'));
    this.shadow.anchor.set(0.5);
    this.body = new Sprite(atlas.tex(`${prefix}_idle_D_0`));
    this.body.anchor.set(CHAR_AX / CHAR_W, CHAR_AY / CHAR_H);
    this.view.addChild(this.shadow, this.body);
  }

  applyClass(def) {
    this.maxHp = this.hp = def.hp;
    this.atk = def.atk;
    this.def = def.def;
    SPEED = def.speed;
  }

  faceTo(dx, dy) {
    if (Math.hypot(dx, dy) > 0.01) {
      this.fx = dx;
      this.fy = dy;
    }
  }

  // 공격할 때 살짝 앞으로
  lunge(dx, dy, power) {
    this.vx += dx * power * 2.2;
    this.vy += dy * power * 2.2;
  }

  dash(dx, dy, dist, time, keepFacing = false) {
    this.dashT = time;
    this.dashVx = (dx * dist) / time;
    this.dashVy = (dy * dist) / time;
    this.iframe = Math.max(this.iframe, time);
    if (!keepFacing) this.faceTo(dx, dy);
  }

  blink(dx, dy, dist) {
    // 막히지 않는 가장 먼 곳으로
    let best = 0;
    for (let d = 0.25; d <= dist; d += 0.25) {
      const x = this.x + dx * d;
      const y = this.y + dy * d;
      const g = this.t.groundAt(x, y);
      if (g === -Infinity || this.blockedAt(x, y) || Math.abs(g - this.z) > 0.6) continue;
      best = d;
    }
    this.x = this.px = this.x + dx * best;
    this.y = this.py = this.y + dy * best;
    this.z = this.pz = this.t.groundAt(this.x, this.y);
    this.iframe = Math.max(this.iframe, 0.2);
  }

  addBuff(type, time, value) {
    this.buffs = this.buffs.filter((b) => b.type !== type);
    this.buffs.push({ type, time, value });
  }

  get guard() {
    return this.buffs.filter((b) => b.type === 'guard').reduce((m, b) => m * (1 - b.value), 1);
  }

  gainUlt(v) {
    this.ult = Math.min(100, this.ult + v);
  }

  usePotion() {
    if (!this.alive || this.potions <= 0 || this.potionCd > 0 || this.hp >= this.maxHp) return false;
    this.potions--;
    this.potionCd = 15;
    this.healLeft = this.maxHp * 0.4;
    this.events.push('potion');
    return true;
  }

  hurt(amount, kx = 0, ky = 0) {
    if (!this.alive || this.iframe > 0 || this.rollT > 0 || this.hurtCd > 0) return;
    const reduce = 1 - this.def / (this.def + 30);
    const dmg = Math.max(1, Math.round(amount * reduce * this.guard));
    this.hp -= dmg;
    this.hurtCd = 0.5;
    this.iframe = 0.5;
    this.vx += kx * 6;
    this.vy += ky * 6;
    this.gainUlt(dmg * 0.6);
    this.events.push({ type: 'hurt', dmg });
    if (this.hp <= 0) {
      this.hp = 0;
      this.alive = false;
      this.deadT = 1.6;
      this.events.push('dead');
    }
  }

  blockedAt(x, y) {
    const t = this.t;
    for (let a = 0; a < 9; a++) {
      const ox = a === 8 ? 0 : Math.cos((a * Math.PI) / 4) * RADIUS;
      const oy = a === 8 ? 0 : Math.sin((a * Math.PI) / 4) * RADIUS * 0.7;
      const i = Math.floor(x + ox);
      const j = Math.floor(y + oy);
      if (t.isSolid(i, j)) return true;
      const g = t.topAt(i, j);
      if (!Number.isNaN(g) && g > this.z + STEP_UP) return true;
    }
    return false;
  }

  update(dt, input) {
    this.px = this.x;
    this.py = this.y;
    this.pz = this.z;
    this.rollCd = Math.max(0, this.rollCd - dt);
    this.iframe = Math.max(0, this.iframe - dt);
    this.hurtCd = Math.max(0, this.hurtCd - dt);
    this.lockT = Math.max(0, this.lockT - dt);
    this.potionCd = Math.max(0, this.potionCd - dt);
    for (const b of this.buffs) b.time -= dt;
    this.buffs = this.buffs.filter((b) => b.time > 0);
    if (this.healLeft > 0) {
      const h = Math.min(this.healLeft, ((this.maxHp * 0.4) / 2) * dt);
      this.healLeft -= h;
      this.hp = Math.min(this.maxHp, this.hp + h);
    }
    if (!this.alive) {
      this.deadT -= dt;
      this.vx = this.vy = 0;
      if (this.deadT <= 0) {
        this.alive = true;
        this.hp = this.maxHp;
        this.x = this.px = this.t.spawn.x;
        this.y = this.py = this.t.spawn.y;
        this.z = this.pz = this.t.groundAt(this.x, this.y);
        this.iframe = 1.5;
        this.potions = 3;
        this.events.push('respawn');
      }
      return;
    }

    let [mx, my] = input.moveVector();
    if (this.lockT > 0 || this.dashT > 0) mx = my = 0;
    const mag = Math.min(1, Math.hypot(mx, my)) * this.moveMul;
    const wx = mag > 0 ? mx / Math.hypot(mx, my) : 0;
    const wy = mag > 0 ? my / Math.hypot(mx, my) : 0;
    if (mag > 0.1 && this.moveMul >= 1) {
      this.fx = wx;
      this.fy = wy;
    }

    if (input.consume('roll') && this.rollCd <= 0 && this.rollT <= 0 && this.dashT <= 0 && this.lockT <= 0 && this.grounded) {
      this.rollDx = this.fx;
      this.rollDy = this.fy;
      this.rollT = ROLL_TIME;
      this.rollCd = ROLL_CD;
      this.iframe = ROLL_IFRAME;
      this.animT = 0;
      this.events.push('roll');
    }

    if (input.consume('potion')) this.usePotion() || this.events.push('potionFail');
    if (this.dashT > 0) {
      this.dashT -= dt;
      this.vx = this.dashVx;
      this.vy = this.dashVy;
    } else if (this.rollT > 0) {
      this.rollT -= dt;
      const sp = ROLL_DIST / ROLL_TIME;
      this.vx = this.rollDx * sp;
      this.vy = this.rollDy * sp;
    } else {
      const k = Math.min(1, ACCEL * dt);
      this.vx += (wx * SPEED * mag - this.vx) * k;
      this.vy += (wy * SPEED * mag - this.vy) * k;
      if (mag === 0 && Math.hypot(this.vx, this.vy) < 0.05) this.vx = this.vy = 0;
    }

    const nx = this.x + this.vx * dt;
    if (!this.blockedAt(nx, this.y)) this.x = nx;
    else this.vx = 0;
    const ny = this.y + this.vy * dt;
    if (!this.blockedAt(this.x, ny)) this.y = ny;
    else this.vy = 0;

    const g = this.t.groundAt(this.x, this.y);
    if (g >= this.z - 0.001 && g <= this.z + STEP_UP) {
      this.z += (g - this.z) * Math.min(1, dt * 22);
      if (Math.abs(g - this.z) < 0.01) this.z = g;
      if (!this.grounded && this.vz < -6) this.events.push('land');
      this.vz = 0;
      this.grounded = true;
    } else if (g < this.z) {
      this.vz -= GRAVITY * dt;
      this.z += this.vz * dt;
      this.grounded = false;
      if (this.z <= g) {
        if (this.vz < -6) this.events.push('land');
        this.z = g;
        this.vz = 0;
        this.grounded = true;
      }
    }

    this.safeTimer -= dt;
    if (this.grounded && this.safeTimer <= 0 && this.rollT <= 0) {
      this.safeTimer = 0.25;
      const i = Math.floor(this.x);
      const j = Math.floor(this.y);
      let edge = false;
      for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) if (this.t.isVoid(i + a, j + b)) edge = true;
      if (!edge) this.safe = { x: this.x, y: this.y, z: this.z };
    }

    if (this.z < this.safe.z - FALL_RESPAWN) {
      this.x = this.px = this.safe.x;
      this.y = this.py = this.safe.y;
      this.z = this.pz = this.safe.z;
      this.vx = this.vy = this.vz = 0;
      this.rollT = 0;
      this.grounded = true;
      this.iframe = 1.0;
      this.hp = Math.max(1, this.hp - Math.round(this.maxHp * 0.2));
      this.events.push('fall');
    }

    const speed = Math.hypot(this.vx, this.vy);
    let anim = 'idle';
    if (this.rollT > 0) anim = 'roll';
    else if (speed > 0.6) anim = 'walk';
    if (anim !== this.anim) {
      this.anim = anim;
      this.animT = 0;
    }
    this.animT += dt;
  }

  render(alpha, worldRenderer) {
    const x = this.px + (this.x - this.px) * alpha;
    const y = this.py + (this.y - this.py) * alpha;
    const z = this.pz + (this.z - this.pz) * alpha;
    const fps = this.anim === 'walk' ? 9 : this.anim === 'roll' ? ANIMS.roll / ROLL_TIME : 2.5;
    const n = ANIMS[this.anim];
    const frame = this.anim === 'roll' ? Math.min(n - 1, Math.floor(this.animT * fps)) : Math.floor(this.animT * fps) % n;
    const dirName = facingName(this.fx, this.fy);
    this.body.texture = this.atlas.tex(`${this.prefix}_${this.anim}_${dirName}_${frame}`);
    this.view.visible = this.alive || this.deadT > 1.3;
    this.body.alpha = this.iframe > 0 && this.rollT <= 0 && this.dashT <= 0 ? (Math.floor(this.iframe * 20) % 2 ? 0.35 : 1) : 1;
    this.body.tint = this.hurtCd > 0.38 ? 0xff7a7a : 0xffffff;

    const px = Math.round(SX(x));
    const py = Math.round(SY(y, z));
    this.view.x = px;
    this.view.y = py;
    const g = this.t.groundAt(x, y);
    if (g === -Infinity) this.shadow.visible = false;
    else {
      this.shadow.visible = true;
      const h = Math.max(0, z - g);
      this.shadow.y = Math.round(h * LEVEL) - 1;
      this.shadow.scale.set(Math.max(0.4, 1 - h * 0.15));
    }
    worldRenderer.placeEntity(this.view, x, y);
    return { sx: px, sy: py, x, y, z };
  }
}
