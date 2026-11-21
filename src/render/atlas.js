// 코드로 그린 픽셀 그림들을 큰 텍스처 몇 장(아틀라스)에 모은다.
// 텍스처 수가 적을수록 GPU가 한 번에 묶어 그릴 수 있어 빠르다.
import { Texture, CanvasSource, Rectangle } from 'pixi.js';

const PAGE = 2048;
const PAD = 1;

export class Atlas {
  constructor() {
    this.items = []; // { name, pc, anchorX, anchorY }
    this.textures = new Map();
    this.meta = new Map();
  }

  add(name, pc, anchorX = 0, anchorY = 0) {
    this.items.push({ name, pc, anchorX, anchorY });
  }

  build() {
    // 높이순 정렬 후 선반(shelf) 방식으로 배치
    const items = [...this.items].sort((a, b) => b.pc.h - a.pc.h || b.pc.w - a.pc.w);
    const pages = [];
    let page = null;
    const newPage = () => {
      const canvas = document.createElement('canvas');
      canvas.width = PAGE;
      canvas.height = PAGE;
      page = { canvas, ctx: canvas.getContext('2d'), x: PAD, y: PAD, rowH: 0, used: 0, placed: [] };
      pages.push(page);
    };
    newPage();
    for (const it of items) {
      const { w, h } = it.pc;
      if (page.x + w + PAD > PAGE) {
        page.x = PAD;
        page.y += page.rowH + PAD;
        page.rowH = 0;
      }
      if (page.y + h + PAD > PAGE) newPage();
      page.placed.push({ it, x: page.x, y: page.y });
      page.x += w + PAD;
      page.rowH = Math.max(page.rowH, h);
      page.used = page.y + page.rowH;
    }

    for (const p of pages) {
      // 실제 사용한 높이만큼 캔버스를 줄여 메모리 절약
      const usedH = Math.min(PAGE, nextPow2(p.used + PAD));
      const canvas = document.createElement('canvas');
      canvas.width = PAGE;
      canvas.height = usedH;
      const ctx = canvas.getContext('2d');
      for (const { it, x, y } of p.placed) ctx.putImageData(it.pc.toImageData(ctx), x, y);
      const source = new CanvasSource({ resource: canvas, scaleMode: 'nearest', autoGenerateMipmaps: false });
      for (const { it, x, y } of p.placed) {
        const tex = new Texture({ source, frame: new Rectangle(x, y, it.pc.w, it.pc.h) });
        this.textures.set(it.name, tex);
        this.meta.set(it.name, { ax: it.anchorX, ay: it.anchorY, w: it.pc.w, h: it.pc.h });
      }
    }
    this.items = [];
    return this;
  }

  tex(name) {
    const t = this.textures.get(name);
    if (!t) throw new Error(`텍스처 없음: ${name}`);
    return t;
  }

  has(name) {
    return this.textures.has(name);
  }

  anchor(name) {
    return this.meta.get(name);
  }
}

function nextPow2(v) {
  let p = 1;
  while (p < v) p <<= 1;
  return p;
}
