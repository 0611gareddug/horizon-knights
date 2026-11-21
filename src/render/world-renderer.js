// 탑다운 지형 렌더러
// 행(y)마다 컨테이너 하나: [바닥/벽 ... , 캐릭터 레이어]. 아래 행일수록 앞(나중에 그림).
import { Container, Sprite } from 'pixi.js';
import { TILE, LEVEL, sx as SX, sy as SY } from '../core/view.js';
import { MAT_NAMES } from '../world/terrain.js';
import { VARIANTS } from '../art/tiles.js';

const PAD = 6;

export class WorldRenderer {
  constructor(atlas, terrain) {
    this.atlas = atlas;
    this.t = terrain;
    this.root = new Container();
    this.rows = [];
    this.lastCull = { x: NaN, y: NaN, w: 0, h: 0 };
    this.build();
  }

  rowIndex(j) {
    return Math.max(0, Math.min(this.rows.length - 1, j + PAD));
  }

  build() {
    const t = this.t;
    for (let r = 0; r < t.h + PAD * 2; r++) {
      const c = new Container();
      c.blocks = new Container();
      c.ents = new Container();
      c.ents.sortableChildren = true;
      c.addChild(c.blocks, c.ents);
      c.items = [];
      c.minY = Infinity;
      c.maxY = -Infinity;
      this.rows.push(c);
      this.root.addChild(c);
    }
    const add = (j, name, x, y) => {
      const s = new Sprite(this.atlas.tex(name));
      s.x = Math.round(x);
      s.y = Math.round(y);
      const c = this.rows[this.rowIndex(j)];
      c.blocks.addChild(s);
      c.items.push(s);
      s.bx0 = s.x;
      s.bx1 = s.x + s.texture.width;
      c.minY = Math.min(c.minY, s.y);
      c.maxY = Math.max(c.maxY, s.y + s.texture.height);
      return s;
    };
    const v = (i, j, k = 0) => (((i * 7 + j * 13 + k * 5) % VARIANTS) + VARIANTS) % VARIANTS;

    for (let j = 0; j < t.h; j++) {
      // 1) 바닥 윗면, 테두리, 그림자
      for (let i = 0; i < t.w; i++) {
        if (t.isVoid(i, j)) continue;
        const id = t.idx(i, j);
        const T = t.top[id];
        const mat = MAT_NAMES[t.mat[id]];
        const topName = mat === 'dirt' ? 'path' : mat === 'grass' && T >= 1 ? 'grassH' : mat;
        const x = SX(i);
        const y = SY(j, T);
        add(j, `top_${topName}_${v(i, j)}`, x, y);
        const north = t.topAt(i, j - 1);
        if (Number.isNaN(north) || north < T) add(j, 'edge_h', x, y);
        const west = t.topAt(i - 1, j);
        const east = t.topAt(i + 1, j);
        if (Number.isNaN(west) || west < T) add(j, 'edge_v', x, y);
        if (Number.isNaN(east) || east < T) add(j, 'edge_v', x + TILE - 1, y);
        if (!Number.isNaN(north) && north > T) add(j, 'shade_strip', x, y);
        if (!Number.isNaN(west) && west > T) add(j, 'shade_strip_v', x, y);
      }
      // 2) 앞면 (남쪽이 더 낮을 때)
      for (let i = 0; i < t.w; i++) {
        if (t.isVoid(i, j)) continue;
        const id = t.idx(i, j);
        const T = t.top[id];
        const B = t.bottom[id];
        const mat = MAT_NAMES[t.mat[id]];
        const southVoid = t.isVoid(i, j + 1);
        const hs = southVoid ? B : t.topAt(i, j + 1);
        if (T <= hs) continue;
        let z = T;
        let first = true;
        let k = 0;
        while (z > hs + 1e-6) {
          const frac = z - Math.floor(z);
          const step = frac > 1e-6 ? frac : Math.min(1, z - hs);
          const hpx = step >= 1 ? LEVEL : LEVEL / 2;
          const kind = z <= 0 ? 'under' : mat === 'stone' ? 'stone' : 'dirt';
          const pre = first && kind !== 'under' ? 'wallt' : 'wall';
          add(j, `${pre}_${kind}_${hpx}_${v(i, j, k++)}`, SX(i), (j + 1) * TILE - z * LEVEL);
          z -= step;
          first = false;
        }
        if (southVoid) add(j, `fringe_${v(i, j)}`, SX(i), (j + 1) * TILE - B * LEVEL);
      }
    }

    // 바닥 장식 (꽃, 풀)
    for (const d of t.decals) {
      const i = Math.floor(d.x);
      const j = Math.floor(d.y);
      const name = `prop_${d.type}_${d.v}`;
      const m = this.atlas.anchor(name);
      add(j, name, SX(d.x) - m.ax, SY(d.y, t.topAt(i, j)) - m.ay);
    }
    // 장식 (나무, 덤불, 바위) — 칸 중심 아래쪽에 발을 둠
    for (const p of t.props) {
      const name = `prop_${p.type}_${p.v}`;
      const m = this.atlas.anchor(name);
      const top = t.topAt(p.i, p.j);
      add(p.j, name, SX(p.i + 0.5) - m.ax, SY(p.j + 0.75, top) - m.ay);
    }
  }

  placeEntity(sprite, x, y) {
    const c = this.rows[this.rowIndex(Math.floor(y))];
    if (sprite.parent !== c.ents) c.ents.addChild(sprite);
    sprite.zIndex = y;
  }

  cull(vx, vy, vw, vh) {
    const L = this.lastCull;
    if (Math.abs(L.x - vx) < 4 && Math.abs(L.y - vy) < 4 && L.w === vw && L.h === vh) return;
    L.x = vx;
    L.y = vy;
    L.w = vw;
    L.h = vh;
    const m = 40;
    const x0 = vx - m;
    const x1 = vx + vw + m;
    const y0 = vy - m;
    const y1 = vy + vh + m;
    for (const c of this.rows) {
      const vis = c.maxY >= y0 && c.minY <= y1;
      c.blocks.visible = vis;
      if (!vis) continue;
      for (const s of c.items) s.visible = s.bx1 >= x0 && s.bx0 <= x1;
    }
  }
}
