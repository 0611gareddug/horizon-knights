// 초원 섬 시험 구역 생성 (1단계 미리보기용)
// 나중에 수작업 구역 조각(JSON)으로 교체된다.
import { Terrain, MAT } from './terrain.js';
import { rng } from '../render/pixel.js';
import { PROP_VARIANTS } from '../art/props.js';

function hash2(x, y, s) {
  let h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function valueNoise(x, y, s) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi, s);
  const b = hash2(xi + 1, yi, s);
  const c = hash2(xi, yi + 1, s);
  const d = hash2(xi + 1, yi + 1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

export function buildMeadow(seed = 7) {
  const W = 44;
  const H = 44;
  const t = new Terrain(W, H);
  const r = rng(seed);
  const cx = 21;
  const cy = 22;

  // 1) 섬 모양
  for (let j = 0; j < H; j++)
    for (let i = 0; i < W; i++) {
      const dx = i + 0.5 - cx;
      const dy = (j + 0.5 - cy) * 1.05;
      const d = Math.hypot(dx, dy);
      const ang = Math.atan2(dy, dx);
      const radius = 16.5 + (valueNoise(Math.cos(ang) * 2.2 + 5, Math.sin(ang) * 2.2 + 5, seed) - 0.5) * 7;
      if (d < radius) t.top[t.idx(i, j)] = 0;
    }

  // 2) 언덕(1층)과 그 위 작은 언덕(2층), 계단(반 칸)
  const hill = { x: 27, y: 15, r: 7.2 };
  const hill2 = { x: 29, y: 13, r: 3.4 };
  for (let j = 0; j < H; j++)
    for (let i = 0; i < W; i++) {
      if (t.isVoid(i, j)) continue;
      const n = (valueNoise(i * 0.35, j * 0.35, seed + 3) - 0.5) * 2.2;
      const d1 = Math.hypot(i + 0.5 - hill.x, j + 0.5 - hill.y) + n;
      const d2 = Math.hypot(i + 0.5 - hill2.x, j + 0.5 - hill2.y) + n * 0.6;
      let h = 0;
      if (d1 < hill.r) h = 1;
      if (d2 < hill2.r) h = 2;
      t.top[t.idx(i, j)] = h;
    }
  // 계단: 언덕 남서쪽 가장자리 (앞쪽에서 오르기 쉽게)
  const stairCells = new Set();
  const addStair = (i, j, h) => {
    if (t.isVoid(i, j)) return;
    t.top[t.idx(i, j)] = h;
    stairCells.add(t.idx(i, j));
  };
  for (let k = 0; k < 3; k++) {
    // 1층 오르는 계단 (아래쪽 방향)
    for (let j = 0; j < H; j++) {
      const i = 24 + k;
      // 언덕 아래 가장자리 찾기
      if (t.topAt(i, j) === 1 && t.topAt(i, j + 1) === 0) {
        addStair(i, j + 1, 0.5);
        break;
      }
    }
  }
  for (let k = 0; k < 2; k++) {
    for (let i = 0; i < W; i++) {
      const j = 13 + k;
      if (t.topAt(i, j) === 2 && t.topAt(i - 1, j) === 1) {
        addStair(i - 1, j, 1.5);
        break;
      }
    }
  }

  // 3) 길 (시작 지점 -> 계단)
  t.spawn = { x: 15.5, y: 29.5 };
  const pathPts = [];
  let px = 14;
  let py = 31;
  for (let s = 0; s < 40; s++) {
    pathPts.push([px, py]);
    const tx = 25;
    const ty = 22;
    const dx = Math.sign(tx - px);
    const dy = Math.sign(ty - py);
    if (dx === 0 && dy === 0) break;
    if (dx !== 0 && (r() < 0.55 || dy === 0)) px += dx;
    else py += dy;
  }
  for (const [x, y] of pathPts)
    for (const [ox, oy] of [[0, 0], [1, 0], [0, 1]]) {
      const i = x + ox;
      const j = y + oy;
      if (!t.isVoid(i, j) && t.topAt(i, j) === 0) t.mat[t.idx(i, j)] = MAT.path;
    }
  // 계단 재질은 돌
  for (const id of stairCells) t.mat[id] = MAT.stone;

  // 4) 바닥 깊이 (가장자리에서 멀수록 깊게 -> 떠 있는 섬 모양)
  const dist = new Int16Array(W * H).fill(-1);
  const q = [];
  for (let j = 0; j < H; j++)
    for (let i = 0; i < W; i++) {
      if (t.isVoid(i, j)) continue;
      const edge = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => t.isVoid(i + a, j + b));
      if (edge) {
        dist[t.idx(i, j)] = 0;
        q.push([i, j]);
      }
    }
  while (q.length) {
    const [i, j] = q.shift();
    const d = dist[t.idx(i, j)];
    for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const ni = i + a;
      const nj = j + b;
      if (!t.inBounds(ni, nj) || t.isVoid(ni, nj) || dist[t.idx(ni, nj)] !== -1) continue;
      dist[t.idx(ni, nj)] = d + 1;
      q.push([ni, nj]);
    }
  }
  for (let id = 0; id < W * H; id++) {
    if (Number.isNaN(t.top[id])) continue;
    const d = dist[id];
    const n = hash2(id, 3, seed);
    t.bottom[id] = -Math.min(9, 1 + Math.floor(d * 0.9 + n * 2.2));
  }

  // 5) 장식: 나무, 덤불, 바위, 꽃, 풀
  const nearSpawn = (i, j, rad) => Math.hypot(i + 0.5 - t.spawn.x, j + 0.5 - t.spawn.y) < rad;
  const free = (i, j) =>
    !t.isVoid(i, j) &&
    t.mat[t.idx(i, j)] === MAT.grass &&
    !stairCells.has(t.idx(i, j)) &&
    !t.isSolid(i, j) &&
    Number.isInteger(t.topAt(i, j));
  const nearStairs = (i, j) => {
    for (const id of stairCells) {
      const si = id % W;
      const sj = Math.floor(id / W);
      if (Math.abs(si - i) <= 1 && Math.abs(sj - j) <= 2) return true;
    }
    return false;
  };
  const place = (type, count, minGap, extra = () => true) => {
    let tries = 0;
    let placed = 0;
    while (placed < count && tries++ < count * 40) {
      const i = Math.floor(r() * W);
      const j = Math.floor(r() * H);
      if (!free(i, j) || nearSpawn(i, j, 3.5) || nearStairs(i, j) || !extra(i, j)) continue;
      let ok = true;
      for (const p of t.props)
        if (Math.abs(p.i - i) < minGap && Math.abs(p.j - j) < minGap) {
          ok = false;
          break;
        }
      if (!ok) continue;
      t.props.push({ type, v: Math.floor(r() * PROP_VARIANTS[type]), i, j });
      t.solid[t.idx(i, j)] = 1;
      placed++;
    }
  };
  // 나무는 가장자리 쪽에 많이
  place('tree', 18, 3, (i, j) => dist[t.idx(i, j)] < 6 || r() < 0.25);
  place('bush', 12, 2);
  place('rock', 9, 2);

  for (let n = 0; n < 70; n++) {
    const i = Math.floor(r() * W);
    const j = Math.floor(r() * H);
    if (!free(i, j)) continue;
    const type = r() < 0.4 ? 'flowers' : 'tuft';
    t.decals.push({ type, v: Math.floor(r() * PROP_VARIANTS[type]), x: i + 0.2 + r() * 0.6, y: j + 0.2 + r() * 0.6 });
  }
  return t;
}
