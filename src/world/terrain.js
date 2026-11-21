// 지형 데이터: 칸마다 윗면 높이, 바닥 깊이, 재질, 막힘 여부
export const MAT_NAMES = ['grass', 'dirt', 'path', 'stone', 'plank'];
export const MAT = Object.fromEntries(MAT_NAMES.map((n, i) => [n, i]));

export class Terrain {
  constructor(w, h) {
    this.w = w;
    this.h = h;
    this.top = new Float32Array(w * h).fill(NaN); // NaN = 허공
    this.bottom = new Int8Array(w * h);
    this.mat = new Uint8Array(w * h);
    this.solid = new Uint8Array(w * h); // 나무, 바위 등으로 막힌 칸
    this.props = []; // { type, v, i, j }
    this.decals = []; // { type, v, x, y }
    this.spawn = { x: w / 2, y: h / 2 };
  }

  idx(i, j) {
    return j * this.w + i;
  }

  inBounds(i, j) {
    return i >= 0 && j >= 0 && i < this.w && j < this.h;
  }

  topAt(i, j) {
    if (!this.inBounds(i, j)) return NaN;
    return this.top[this.idx(i, j)];
  }

  isVoid(i, j) {
    return Number.isNaN(this.topAt(i, j));
  }

  // 월드 좌표의 바닥 높이 (허공이면 -Infinity)
  groundAt(x, y) {
    const t = this.topAt(Math.floor(x), Math.floor(y));
    return Number.isNaN(t) ? -Infinity : t;
  }

  isSolid(i, j) {
    return this.inBounds(i, j) && this.solid[this.idx(i, j)] === 1;
  }
}
