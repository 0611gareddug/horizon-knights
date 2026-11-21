// 지형과 캐릭터를 올바른 앞뒤 순서로 그리는 렌더러
// 대각선(x+y)마다 컨테이너를 하나씩 둔다: [블록들 ... , 캐릭터 레이어]
// -> 정렬 비용이 거의 없고, 화면 밖 대각선은 통째로 건너뛸 수 있다.
import { Container, Sprite } from 'pixi.js';
import { toScreenX, toScreenY } from '../core/iso.js';
import { MAT_NAMES } from '../world/terrain.js';
import { VARIANTS } from '../art/tiles.js';

const DIAG_PAD = 6;

export class WorldRenderer {
  constructor(atlas, terrain) {
    this.atlas = atlas;
    this.t = terrain;
    this.root = new Container();
    this.diags = [];
    this.diagOffset = DIAG_PAD;
    this.lastCull = { x: NaN, y: NaN, w: 0, h: 0 };
    this.build();
  }

  diagIndex(sum) {
    return Math.max(0, Math.min(this.diags.length - 1, sum + this.diagOffset));
  }

  build() {
    const t = this.t;
    const count = t.w + t.h - 1 + DIAG_PAD * 2;
    for (let d = 0; d < count; d++) {
      const blocks = new Container();
      const ents = new Container();
      ents.sortableChildren = true;
      const c = new Container();
      c.addChild(blocks, ents);
      c.blocks = blocks;
      c.ents = ents;
      c.items = [];
      c.minY = Infinity;
      c.maxY = -Infinity;
      this.diags.push(c);
      this.root.addChild(c);
    }

    const covers = (i, j, k, kTop) => {
      // 이웃 칸이 블록 [k, kTop] 옆면을 완전히 가리는지
      if (t.isVoid(i, j)) return false;
      const nt = t.topAt(i, j);
      const nb = t.bottom[t.idx(i, j)];
      return nt >= kTop && nb <= k;
    };

    const pushSprite = (sum, name, x, y, order) => {
      const s = new Sprite(this.atlas.tex(name));
      s.x = x;
      s.y = y;
      s.order = order;
      const c = this.diags[this.diagIndex(sum)];
      c.items.push(s);
      s.bx0 = x;
      s.bx1 = x + s.texture.width;
      c.minY = Math.min(c.minY, y);
      c.maxY = Math.max(c.maxY, y + s.texture.height);
    };

    for (let j = 0; j < t.h; j++)
      for (let i = 0; i < t.w; i++) {
        if (t.isVoid(i, j)) continue;
        const id = t.idx(i, j);
        const T = t.top[id];
        const B = t.bottom[id];
        const surf = MAT_NAMES[t.mat[id]];
        const sx = toScreenX(i, j);
        const full = Math.floor(T);
        const hasSlab = T - full > 0.01;
        const kMax = hasSlab ? full : full - 1;
        const v = (i * 7 + j * 13) % VARIANTS;
        for (let k = B; k <= kMax; k++) {
          const isSlab = hasSlab && k === full;
          const kTop = isSlab ? T : k + 1;
          const isTop = k === kMax;
          const exposed = isTop || !covers(i, j + 1, k, kTop) || !covers(i + 1, j, k, kTop);
          if (!exposed) continue;
          let mat;
          if (isTop) mat = surf;
          else if (k >= 0) mat = k === kMax - 1 && (surf === 'grass' || surf === 'path') ? 'dirt' : 'stone';
          else mat = 'under';
          if (mat === 'stone' && k < 0) mat = 'under';
          const hpx = isSlab ? 8 : 16;
          const vv = (((v + k * 3) % VARIANTS) + VARIANTS) % VARIANTS;
          const name = `blk_${mat}_${hpx}_${vv}`;
          pushSprite(i + j, name, sx - 16, toScreenY(i, j, kTop), i * 48 + (k + 16));
        }
        // 섬 아래 바위 고드름 (앞쪽이 트인 칸만)
        const frontOpen = t.isVoid(i + 1, j) || t.isVoid(i, j + 1) ||
          t.bottom[t.idx(i + 1, j)] > B || t.bottom[t.idx(i, j + 1)] > B;
        if (frontOpen) {
          pushSprite(i + j, `stal_${(i * 5 + j * 3) % VARIANTS}`, sx - 16, toScreenY(i, j, B) + 8, i * 48 + (B + 15));
        }
      }

    // 장식 (나무, 덤불, 바위)
    for (const p of t.props) {
      const name = `prop_${p.type}_${p.v}`;
      const m = this.atlas.anchor(name);
      const top = t.topAt(p.i, p.j);
      const x = toScreenX(p.i + 0.5, p.j + 0.5) - m.ax;
      const y = toScreenY(p.i + 0.5, p.j + 0.5, top) - m.ay;
      pushSprite(p.i + p.j, name, x, y, p.i * 48 + 47);
    }
    // 바닥 장식 (꽃, 풀) - 블록 바로 위, 캐릭터보다 먼저
    for (const d of t.decals) {
      const i = Math.floor(d.x);
      const j = Math.floor(d.y);
      const name = `prop_${d.type}_${d.v}`;
      const m = this.atlas.anchor(name);
      const top = t.topAt(i, j);
      const x = Math.round(toScreenX(d.x, d.y) - m.ax);
      const y = Math.round(toScreenY(d.x, d.y, top) - m.ay);
      pushSprite(i + j, name, x, y, i * 48 + 46);
    }

    for (const c of this.diags) {
      c.items.sort((a, b) => a.order - b.order);
      for (const s of c.items) c.blocks.addChild(s);
    }
  }

  // 캐릭터 스프라이트를 알맞은 대각선 레이어로 옮김
  placeEntity(sprite, x, y) {
    const sum = Math.floor(x) + Math.floor(y);
    const c = this.diags[this.diagIndex(sum)];
    if (sprite.parent !== c.ents) c.ents.addChild(sprite);
    sprite.zIndex = x + y;
  }

  // 화면 밖 스프라이트 숨기기 (view: 월드 화면좌표 기준 사각형)
  cull(vx, vy, vw, vh) {
    const L = this.lastCull;
    if (Math.abs(L.x - vx) < 4 && Math.abs(L.y - vy) < 4 && L.w === vw && L.h === vh) return;
    L.x = vx;
    L.y = vy;
    L.w = vw;
    L.h = vh;
    const margin = 48;
    const x0 = vx - margin;
    const x1 = vx + vw + margin;
    const y0 = vy - margin;
    const y1 = vy + vh + margin;
    for (const c of this.diags) {
      const vis = c.maxY >= y0 && c.minY <= y1;
      c.blocks.visible = vis;
      if (!vis) continue;
      for (const s of c.items) s.visible = s.bx1 >= x0 && s.bx0 <= x1;
    }
  }
}
