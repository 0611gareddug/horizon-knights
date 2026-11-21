// 보스: 바위등 멧돼지왕 (초원의 폭군)
// 1페이즈: 돌진(벽에 박으면 기절), 앞발 구르기 충격파
// 2페이즈(70%): 등의 바위가 깨지며 연속 3회 돌진
// 3페이즈(35%): 분노 — 돌진하며 바위 파편을 흩뿌리고, 내려찍으면 돌이 쏟아짐
import { Monster } from './monsters.js';
import { moveActor } from './combat.js';

export class KingBoar extends Monster {
  constructor(c, x, y) {
    super(c, 'king', x, y);
    this.displayName = '바위등 멧돼지왕';
    this.setStats(1100, 20, 1.9, 0.85);
    this.heavy = true;
    this.noKnock = true;
    this.boss = true;
    this.barY = 54;
    this.phase = 1;
    this.chunkColor = 0x9aa0ac;
    this.spawnT = 0;
    this.cd = 1.2;
    this.charges = 0;
  }

  frameName() {
    if (this.state === 'dizzy') return 'king_dizzy';
    const p = this.phase === 1 ? 'king' : this.phase === 2 ? 'kingB' : 'kingR';
    if (this.state === 'charge' || this.state === 'wind' || this.state === 'roar') return `${p}_4`;
    if (this.state === 'stompWind') return `${p}_${Math.floor(this.animT * 12) % 2 ? 1 : 3}`;
    return `${p}_${this.moving ? Math.floor(this.animT * 7) % 4 : 0}`;
  }

  get dmgTakenMul() {
    // 기절 중에는 더 아프게 맞음 (공략 타이밍)
    return super.dmgTakenMul * (this.state === 'dizzy' ? 1.5 : 1);
  }

  onHurt() {
    const r = this.hp / this.maxHp;
    if (this.phase === 1 && r <= 0.7) this.enterPhase(2);
    else if (this.phase === 2 && r <= 0.35) this.enterPhase(3);
  }

  enterPhase(n) {
    this.phase = n;
    this.state = 'roar';
    this.stT = 1.4;
    this.invuln = true;
    this.kvx = this.kvy = 0;
    const g = this.c.g;
    g.shake(8);
    g.sfx.rumble();
    g.vibrate?.(80);
    this.c.fx.burst(this.x, this.y, this.z + 2, { count: 30, speed: 4, up: 4, color: 0x9aa0ac, size: 2, life: 0.8 });
    g.toastWorld(this.x, this.y, this.z + 1.5, n === 2 ? '등의 바위가 깨졌다!' : '분노했다!', n === 2 ? 0xe2e6ee : 0xff5a4a);
    g.stage?.onBossPhase?.(n);
  }

  aimCharge(p) {
    const d = this.dist(p) || 1;
    this.cx = (p.x - this.x) / d;
    this.cy = (p.y - this.y) / d;
    this.face = this.cx > 0 ? 1 : -1;
    this.state = 'wind';
    this.stT = this.phase === 1 ? 0.85 : 0.6;
    this.c.lineTelegraph(this.x, this.y, this.z, this.cx, this.cy, 16, 1.8, this.stT);
    this.c.g.sfx.tone(120, 0.3, 'sawtooth', 0.05, 1.6);
  }

  ai(dt, p) {
    const c = this.c;
    if (this.state === 'roar') {
      this.stT -= dt;
      if (this.stT <= 0) {
        this.invuln = false;
        this.state = 'idle';
        this.cd = 0.4;
      }
      return;
    }
    if (this.state === 'wind') {
      this.stT -= dt;
      if (this.stT <= 0) {
        this.state = 'charge';
        this.stT = 1.6;
        this.hitDone = false;
        this.shardT = 0;
      }
      return;
    }
    if (this.state === 'charge') {
      this.stT -= dt;
      const sp = this.phase === 3 ? 12 : 11;
      const ox = this.x;
      const oy = this.y;
      moveActor(c.t, this, this.cx * sp * dt, this.cy * sp * dt);
      if (Math.random() < 0.7) c.fx.burst(this.x, this.y, this.z, { count: 1, speed: 1.5, up: 1.2, color: 0xe9dcc0 });
      if (!this.hitDone && this.dist(p) < this.r + 0.45) {
        this.hitDone = true;
        this.hitPlayer(p, this.atk, this.cx, this.cy);
      }
      if (this.phase === 3) {
        this.shardT -= dt;
        if (this.shardT <= 0) {
          this.shardT = 0.22;
          for (const s of [-1, 1])
            c.shoot({ x: this.x, y: this.y, z: this.z + 0.6, dx: -this.cy * s, dy: this.cx * s, speed: 6, range: 4.5, tex: 'rock_proj', rot: false, hostile: true, dmg: 9, radius: 0.25 });
        }
      }
      const moved = Math.hypot(this.x - ox, this.y - oy);
      const edge = c.t.groundAt(this.x + this.cx * 1.2, this.y + this.cy * 1.2) === -Infinity;
      if (moved < sp * dt * 0.3 || edge) {
        // 벽에 박음 -> 기절
        this.state = 'dizzy';
        this.stT = this.phase === 3 ? 1.6 : 2.2;
        this.charges = 0;
        c.g.shake(7);
        c.g.sfx.boom();
        c.fx.burst(this.x + this.cx, this.y + this.cy, this.z + 0.8, { count: 18, speed: 3.5, up: 3, color: 0xcfd3db, size: 2 });
        c.g.toastWorld(this.x, this.y, this.z + 2, '기절!', 0xffe08a);
      } else if (this.stT <= 0) {
        this.charges--;
        if (this.charges > 0) this.aimCharge(p);
        else {
          this.state = 'rest';
          this.stT = 0.7;
        }
      }
      return;
    }
    if (this.state === 'stompWind') {
      this.stT -= dt;
      if (this.stT <= 0) {
        this.state = 'rest';
        this.stT = 0.6;
        c.boom(this.x, this.y, this.z, 3.2, 16, 0, (dmg, kx, ky) => this.hitPlayer(p, dmg, kx, ky), 0xcfb27a);
        if (this.phase === 3)
          for (let k = 0; k < 4; k++) {
            const tx = p.x + (Math.random() - 0.5) * 4;
            const ty = p.y + (Math.random() - 0.5) * 4;
            c.lob(this.x, this.y, this.z + 1.5, tx, ty, 0.9 + k * 0.12, 10, 0.8, (dmg, kx, ky) => this.hitPlayer(p, dmg, kx, ky));
          }
      }
      return;
    }
    if (this.state === 'dizzy' || this.state === 'rest') {
      this.stT -= dt;
      if (this.stT <= 0) this.state = 'idle';
      return;
    }
    // 다음 패턴 고르기
    const d = this.dist(p);
    if (this.cd <= 0) {
      this.cd = this.phase === 1 ? 1.4 : 1.0;
      if (d < 3.4 && Math.random() < 0.6) {
        this.state = 'stompWind';
        this.stT = 0.75;
        c.telegraph(this.x, this.y, this.z, 3.2, 0.75, 0xffb84a);
      } else {
        this.charges = this.phase === 1 ? 1 : 3;
        this.aimCharge(p);
      }
      return;
    }
    this.moveToward(p.x, p.y, 0.7, dt);
  }
}
