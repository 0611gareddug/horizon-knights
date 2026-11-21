// 플레이어: 이동, 구르기, 높이(계단/낙하), 섬 밖 추락
import { Sprite, Container } from 'pixi.js';
import { screenDirToWorld, worldDirToScreen, dir8FromScreen, toScreenX, toScreenY } from '../core/iso.js';
import { DIR8_TO_SPRITE, ANIMS } from '../art/character.js';

const SPEED = 4.2; // 칸/초
const ACCEL = 38;
const RADIUS = 0.28;
const STEP_UP = 0.55; // 이만큼까지는 걸어서 올라감
const GRAVITY = 34;
const ROLL_TIME = 0.36;
const ROLL_DIST = 3;
const ROLL_IFRAME = 0.3;
const ROLL_CD = 1.2;
const FALL_RESPAWN = 7; // 안전 높이보다 이만큼 떨어지면 복귀

export class Player {
  constructor(atlas, terrain, prefix = 'hero') {
    this.atlas = atlas;
    this.t = terrain;
    this.prefix = prefix;
    this.x = terrain.spawn.x;
    this.y = terrain.spawn.y;
    this.z = terrain.groundAt(this.x, this.y);
    this.vx = 0;
    this.vy = 0;
    this.vz = 0;
    this.px = this.x;
    this.py = this.y;
    this.pz = this.z;
    this.grounded = true;
    this.dir8 = 1;
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
    this.events = []; // 'land', 'fall', 'roll' 등 (효과 연출용)

    this.view = new Container();
    this.shadow = new Sprite(atlas.tex('shadow_m'));
    this.shadow.anchor.set(0.5);
    this.body = new Sprite(atlas.tex(`${prefix}_idle_DR_0`));
    this.body.anchor.set(12 / 24, 29 / 32);
    this.view.addChild(this.shadow, this.body);
  }

  blockedAt(x, y) {
    // 원 둘레 8점 + 중심 검사
    const t = this.t;
    for (let a = 0; a < 9; a++) {
      const ox = a === 8 ? 0 : Math.cos((a * Math.PI) / 4) * RADIUS;
      const oy = a === 8 ? 0 : Math.sin((a * Math.PI) / 4) * RADIUS;
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

    const [mx, my] = input.moveVector();
    const mag = Math.min(1, Math.hypot(mx, my));
    let [wx, wy] = mag > 0 ? screenDirToWorld(mx, my) : [0, 0];

    // 구르기 시작
    if (input.consume('roll') && this.rollCd <= 0 && this.rollT <= 0 && this.grounded) {
      let dx = wx;
      let dy = wy;
      if (mag === 0) {
        // 멈춰 있으면 바라보는 방향으로
        const a = (this.dir8 * Math.PI) / 4;
        [dx, dy] = screenDirToWorld(Math.cos(a), Math.sin(a));
      }
      this.rollDx = dx;
      this.rollDy = dy;
      this.rollT = ROLL_TIME;
      this.rollCd = ROLL_CD;
      this.iframe = ROLL_IFRAME;
      this.animT = 0;
      this.events.push('roll');
    }

    if (this.rollT > 0) {
      this.rollT -= dt;
      const sp = ROLL_DIST / ROLL_TIME;
      this.vx = this.rollDx * sp;
      this.vy = this.rollDy * sp;
    } else {
      const tx = wx * SPEED * mag;
      const ty = wy * SPEED * mag;
      const k = Math.min(1, ACCEL * dt);
      this.vx += (tx - this.vx) * k;
      this.vy += (ty - this.vy) * k;
      if (mag === 0 && Math.hypot(this.vx, this.vy) < 0.05) {
        this.vx = 0;
        this.vy = 0;
      }
    }

    // 축별 이동 (벽을 따라 미끄러지게)
    const nx = this.x + this.vx * dt;
    if (!this.blockedAt(nx, this.y)) this.x = nx;
    else this.vx = 0;
    const ny = this.y + this.vy * dt;
    if (!this.blockedAt(this.x, ny)) this.y = ny;
    else this.vy = 0;

    // 높이
    const g = this.t.groundAt(this.x, this.y);
    if (g >= this.z - 0.001 && g <= this.z + STEP_UP) {
      // 계단 오르기: 부드럽게 붙임
      this.z += (g - this.z) * Math.min(1, dt * 22);
      if (Math.abs(g - this.z) < 0.01) this.z = g;
      if (!this.grounded && this.vz < -6) this.events.push('land');
      this.vz = 0;
      this.grounded = true;
    } else if (g < this.z) {
      // 떨어짐
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

    // 안전 위치 기록 (가장자리가 아닌 곳)
    this.safeTimer -= dt;
    if (this.grounded && this.safeTimer <= 0 && this.rollT <= 0) {
      this.safeTimer = 0.25;
      const i = Math.floor(this.x);
      const j = Math.floor(this.y);
      let edge = false;
      for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) if (this.t.isVoid(i + a, j + b)) edge = true;
      if (!edge) this.safe = { x: this.x, y: this.y, z: this.z };
    }

    // 추락
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

    // 방향과 애니메이션
    const speed = Math.hypot(this.vx, this.vy);
    if (speed > 0.3) {
      const [sx, sy] = worldDirToScreen(this.vx, this.vy);
      this.dir8 = dir8FromScreen(sx, sy);
    }
    let anim = 'idle';
    if (this.rollT > 0) anim = 'roll';
    else if (speed > 0.6) anim = 'walk';
    if (anim !== this.anim) {
      this.anim = anim;
      this.animT = 0;
    }
    this.animT += dt;
    // 체력 천천히 회복 (시험 구역 전용)
    this.hp = Math.min(this.maxHp, this.hp + dt * 2);
  }

  // 보간된 위치로 스프라이트 갱신
  render(alpha, worldRenderer) {
    const x = this.px + (this.x - this.px) * alpha;
    const y = this.py + (this.y - this.py) * alpha;
    const z = this.pz + (this.z - this.pz) * alpha;
    const fps = this.anim === 'walk' ? 11 : this.anim === 'roll' ? ANIMS.roll / ROLL_TIME : 3;
    const n = ANIMS[this.anim];
    const frame = this.anim === 'roll' ? Math.min(n - 1, Math.floor(this.animT * fps)) : Math.floor(this.animT * fps) % n;
    const dirName = DIR8_TO_SPRITE[this.dir8];
    this.body.texture = this.atlas.tex(`${this.prefix}_${this.anim}_${dirName}_${frame}`);
    // 무적 깜빡임 (구르기 제외)
    this.body.alpha = this.iframe > 0 && this.rollT <= 0 ? (Math.floor(this.iframe * 20) % 2 ? 0.35 : 1) : 1;

    const sx = Math.round(toScreenX(x, y));
    const sy = Math.round(toScreenY(x, y, z));
    this.body.x = 0;
    this.body.y = 0;
    this.view.x = sx;
    this.view.y = sy;
    // 그림자는 바닥에
    const g = this.t.groundAt(x, y);
    if (g === -Infinity) this.shadow.visible = false;
    else {
      this.shadow.visible = true;
      const h = Math.max(0, z - g);
      this.shadow.y = Math.round(h * 16);
      this.shadow.scale.set(Math.max(0.4, 1 - h * 0.15));
    }
    worldRenderer.placeEntity(this.view, x, y);
    return { sx, sy, x, y, z };
  }
}
