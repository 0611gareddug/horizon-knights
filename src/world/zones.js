// 프롤로그 맵: 훈련 섬, 비행선 갑판
import { Terrain, MAT } from './terrain.js';
import { rng } from '../render/pixel.js';

// 가장자리에서 멀수록 바닥을 깊게 (떠 있는 섬 모양)
export function computeBottoms(t, seed = 1, maxDepth = 8) {
  const W = t.w;
  const H = t.h;
  const dist = new Int16Array(W * H).fill(-1);
  const q = [];
  for (let j = 0; j < H; j++)
    for (let i = 0; i < W; i++) {
      if (t.isVoid(i, j)) continue;
      if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => t.isVoid(i + a, j + b))) {
        dist[t.idx(i, j)] = 0;
        q.push([i, j]);
      }
    }
  for (let k = 0; k < q.length; k++) {
    const [i, j] = q[k];
    const d = dist[t.idx(i, j)];
    for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const ni = i + a;
      const nj = j + b;
      if (!t.inBounds(ni, nj) || t.isVoid(ni, nj) || dist[t.idx(ni, nj)] !== -1) continue;
      dist[t.idx(ni, nj)] = d + 1;
      q.push([ni, nj]);
    }
  }
  const r = rng(seed);
  for (let id = 0; id < W * H; id++) {
    if (Number.isNaN(t.top[id])) continue;
    t.bottom[id] = -Math.min(maxDepth, 1 + Math.floor(dist[id] * 0.9 + r() * 2));
  }
  return dist;
}

// ---------------- 훈련 섬 ----------------
// 북쪽: 둥근 훈련장 (울타리, 깃발, 허수아비 자리) / 남쪽: 섬 끝으로 이어지는 길
export function buildTraining() {
  const W = 24;
  const H = 40;
  const t = new Terrain(W, H);
  const r = rng(11);
  const cx = 12;
  for (let j = 0; j < H; j++)
    for (let i = 0; i < W; i++) {
      // 훈련장 타원
      const dx = (i + 0.5 - cx) / 10.5;
      const dy = (j + 0.5 - 10) / 8.5;
      const arena = dx * dx + dy * dy < 1;
      // 남쪽 길 (구불구불)
      const wob = Math.sin(j * 0.45) * 2.2;
      const half = 4.2 + Math.sin(j * 0.9) * 0.8;
      const road = j >= 15 && j <= 37 && Math.abs(i + 0.5 - cx - wob) < half;
      if (arena || road) t.top[t.idx(i, j)] = 0;
    }
  // 훈련장 바닥은 흙길
  for (let j = 0; j < H; j++)
    for (let i = 0; i < W; i++) {
      if (t.isVoid(i, j)) continue;
      const dx = (i + 0.5 - cx) / 7.5;
      const dy = (j + 0.5 - 10) / 6;
      if (dx * dx + dy * dy < 1) t.mat[t.idx(i, j)] = MAT.path;
    }
  computeBottoms(t, 3, 7);

  const prop = (type, i, j, v = 0, solid = true) => {
    if (t.isVoid(i, j)) return;
    t.props.push({ type, v, i, j });
    if (solid) t.solid[t.idx(i, j)] = 1;
  };
  // 울타리: 훈련장 둘레 (남쪽은 출입구)
  for (let a = 0; a < Math.PI * 2; a += 0.11) {
    const i = Math.floor(cx + Math.cos(a) * 8.6);
    const j = Math.floor(10 + Math.sin(a) * 7.2);
    if (Math.sin(a) > 0.75) continue; // 남쪽 입구
    if (!t.props.some((p) => p.i === i && p.j === j)) prop('fence', i, j);
  }
  prop('banner', 4, 4, 0);
  prop('banner', 19, 4, 1);
  prop('banner', 3, 13, 1);
  prop('banner', 20, 13, 0);
  prop('crate', 6, 3);
  prop('barrel', 7, 3);
  prop('barrel', 17, 3);
  // 길가 장식
  for (let j = 18; j < 37; j++)
    for (const side of [-1, 1]) {
      if (r() > 0.32) continue;
      const wob = Math.sin(j * 0.45) * 2.2;
      const i = Math.floor(cx + wob + side * (3.2 + r() * 1.2));
      if (t.isVoid(i, j) || t.isSolid(i, j)) continue;
      prop(r() < 0.5 ? 'tree' : r() < 0.5 ? 'bush' : 'rock', i, j, Math.floor(r() * 3));
    }
  for (let n = 0; n < 60; n++) {
    const i = Math.floor(r() * W);
    const j = Math.floor(r() * H);
    if (t.isVoid(i, j) || t.mat[t.idx(i, j)] !== MAT.grass || t.isSolid(i, j)) continue;
    const type = r() < 0.45 ? 'flowers' : 'tuft';
    t.decals.push({ type, v: Math.floor(r() * 4), x: i + 0.2 + r() * 0.6, y: j + 0.2 + r() * 0.6 });
  }
  t.spawn = { x: 12, y: 15 };
  t.marks = {
    kaira: { x: 12, y: 5.5 },
    dummies: [
      { x: 8.5, y: 8.5 },
      { x: 12.5, y: 7.5 },
      { x: 16.5, y: 8.5 },
    ],
    walkTo: { x: 12.5, y: 10.5 },
    edgeY: 37,
  };
  return t;
}

// ---------------- 비행선 갑판 ----------------
export function buildDeck() {
  const W = 16;
  const H = 26;
  const t = new Terrain(W, H);
  const cx = 8;
  for (let j = 0; j < H; j++) {
    // 뱃머리(북쪽)는 좁고 뾰족하게, 선미(남쪽)는 둥글게
    let half;
    if (j < 7) half = 1.5 + j * 0.75;
    else if (j > 21) half = 6.5 - (j - 21) * 1.1;
    else half = 6.5;
    for (let i = 0; i < W; i++) if (Math.abs(i + 0.5 - cx) < half) t.top[t.idx(i, j)] = 0;
  }
  for (let id = 0; id < W * H; id++) {
    if (Number.isNaN(t.top[id])) continue;
    t.mat[id] = MAT.plank;
    t.bottom[id] = -3;
  }
  const prop = (type, i, j, solid = true) => {
    if (t.isVoid(i, j)) return;
    t.props.push({ type, v: 0, i, j });
    if (solid) t.solid[t.idx(i, j)] = 1;
  };
  // 난간: 가장자리 칸
  for (let j = 0; j < H; j++)
    for (let i = 0; i < W; i++) {
      if (t.isVoid(i, j)) continue;
      const left = t.isVoid(i - 1, j);
      const right = t.isVoid(i + 1, j);
      const south = t.isVoid(i, j + 1);
      if (left || right) prop('railv', i, j);
      else if (south) prop('railh', i, j);
    }
  prop('mast', 8, 11);
  prop('wheel', 8, 20);
  prop('crate', 5, 15);
  prop('crate', 5, 16);
  prop('barrel', 11, 15);
  prop('barrel', 10, 6);
  t.spawn = { x: 8.5, y: 15.5 };
  t.marks = {
    bartol: { x: 8.5, y: 19.2 },
    elian: { x: 6.5, y: 12.8 },
    kaira: { x: 10.5, y: 9.5 },
    land: { x: 8.5, y: 15.5 },
  };
  return t;
}
