// 하늘 배경: 그라데이션 + 시차 스크롤 구름
import { Container, Sprite, Texture, CanvasSource } from 'pixi.js';

function gradientTexture(stops) {
  const c = document.createElement('canvas');
  c.width = 1;
  c.height = 256;
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, 256);
  for (const [p, col] of stops) g.addColorStop(p, col);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 1, 256);
  return new Texture({ source: new CanvasSource({ resource: c, scaleMode: 'linear' }) });
}

export class Sky {
  constructor(atlas) {
    this.root = new Container();
    this.grad = new Sprite(
      gradientTexture([
        [0, '#3f78cf'],
        [0.55, '#7fb2ec'],
        [1, '#cfe9ff'],
      ]),
    );
    this.root.addChild(this.grad);

    // 먼 구름, 가까운 구름
    this.clouds = [];
    for (let i = 0; i < 14; i++) {
      const s = new Sprite(atlas.tex(`cloud_${i % 6}`));
      const far = i < 8;
      s.par = far ? 0.06 + Math.random() * 0.05 : 0.16 + Math.random() * 0.08;
      s.speed = far ? 2 + Math.random() * 2 : 5 + Math.random() * 4;
      s.alpha = far ? 0.75 : 0.95;
      s.baseX = Math.random() * 1200;
      s.baseY = far ? Math.random() * 0.45 : 0.25 + Math.random() * 0.4;
      s.drift = 0;
      this.clouds.push(s);
      this.root.addChild(s);
    }
    this.clouds.sort((a, b) => a.par - b.par);
    for (const s of this.clouds) this.root.addChild(s);

    // 아래 구름 바다 (2겹)
    this.seas = [];
    for (const [name, par, yFrac, alpha] of [
      ['cloudsea_1', 0.1, 0.78, 0.85],
      ['cloudsea_0', 0.22, 0.86, 1],
    ]) {
      const layer = new Container();
      layer.par = par;
      layer.yFrac = yFrac;
      layer.alpha = alpha;
      layer.tw = atlas.tex(name).width;
      for (let k = 0; k < 8; k++) layer.addChild(new Sprite(atlas.tex(name)));
      this.seas.push(layer);
      this.root.addChild(layer);
    }
    this.time = 0;
  }

  update(dt, camX, camY, viewW, viewH) {
    this.time += dt;
    this.grad.width = viewW;
    this.grad.height = viewH;
    const span = viewW + 200;
    for (const s of this.clouds) {
      s.drift += s.speed * dt;
      let x = s.baseX - s.drift - camX * s.par;
      x = ((x % span) + span) % span - 100;
      s.x = Math.round(x);
      s.y = Math.round(s.baseY * viewH - camY * s.par * 0.5);
    }
    for (const l of this.seas) {
      const tw = l.tw;
      const off = (((-camX * l.par - this.time * 3 * l.par * 10) % tw) + tw) % tw;
      const need = Math.ceil(viewW / tw) + 2;
      l.children.forEach((s, k) => {
        s.visible = k < need;
        s.x = Math.round(off - tw + k * tw);
      });
      l.y = Math.round(l.yFrac * viewH - camY * l.par * 0.4);
    }
  }
}
