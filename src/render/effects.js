// 먼지, 파편 같은 작은 입자 효과 (객체 재사용으로 끊김 방지)
import { Sprite } from 'pixi.js';
import { toScreenX, toScreenY } from '../core/iso.js';

export class Particles {
  constructor(atlas, worldRenderer, max = 160) {
    this.wr = worldRenderer;
    this.pool = [];
    this.live = [];
    this.tex = atlas.tex('px_1');
    this.tex2 = atlas.tex('px_2');
    this.max = max;
    this.density = 1;
  }

  get() {
    if (this.live.length >= this.max) return null;
    const p = this.pool.pop() || { s: new Sprite(this.tex) };
    p.s.visible = true;
    this.live.push(p);
    return p;
  }

  // 월드 좌표에서 입자 퍼뜨리기
  burst(x, y, z, { count = 8, color = 0xd9c7a0, speed = 2, up = 2, life = 0.45, size = 2, gravity = 10 } = {}) {
    const n = Math.max(1, Math.round(count * this.density));
    for (let i = 0; i < n; i++) {
      const p = this.get();
      if (!p) return;
      const a = Math.random() * Math.PI * 2;
      const sp = speed * (0.4 + Math.random() * 0.6);
      p.x = x;
      p.y = y;
      p.z = z + 0.05;
      p.vx = Math.cos(a) * sp;
      p.vy = Math.sin(a) * sp;
      p.vz = up * (0.5 + Math.random() * 0.7);
      p.g = gravity;
      p.life = p.max = life * (0.7 + Math.random() * 0.5);
      p.s.texture = size > 1 ? this.tex2 : this.tex;
      p.s.tint = color;
      p.s.alpha = 1;
    }
  }

  update(dt) {
    for (let i = this.live.length - 1; i >= 0; i--) {
      const p = this.live[i];
      p.life -= dt;
      if (p.life <= 0) {
        p.s.visible = false;
        p.s.parent?.removeChild(p.s);
        this.live[i] = this.live[this.live.length - 1];
        this.live.pop();
        this.pool.push(p);
        continue;
      }
      p.vx *= 1 - dt * 3;
      p.vy *= 1 - dt * 3;
      p.vz -= p.g * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z = Math.max(p.z + p.vz * dt, p.z - 2);
      p.s.x = Math.round(toScreenX(p.x, p.y));
      p.s.y = Math.round(toScreenY(p.x, p.y, p.z));
      p.s.alpha = Math.min(1, (p.life / p.max) * 2);
      this.wr.placeEntity(p.s, p.x, p.y);
    }
  }
}
